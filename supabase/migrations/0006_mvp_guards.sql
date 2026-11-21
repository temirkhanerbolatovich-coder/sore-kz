-- Serialize quotas on their owning shop. Existing order numbers are preserved.
alter table public.orders alter column number drop identity;
create unique index orders_shop_number_unique on public.orders(shop_id, number);
alter table public.shops add column next_order_number bigint not null default 1;
update public.shops s set next_order_number = coalesce((select max(number) + 1 from public.orders where shop_id=s.id), 1);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.rate_limits (
  key text primary key, window_start timestamptz not null, hits integer not null
);
create function private.consume_rate(p_key text, p_seconds integer, p_limit integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_hits integer;
begin
  insert into private.rate_limits as r values(p_key, clock_timestamp(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < clock_timestamp() - make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
    window_start = case when r.window_start < clock_timestamp() - make_interval(secs=>p_seconds) then clock_timestamp() else r.window_start end
  returning hits into v_hits;
  if v_hits > p_limit then raise exception 'rate limit exceeded'; end if;
end $$;
revoke all on function private.consume_rate(text,integer,integer) from public;

create function public.guard_shop() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and (new.slug <> old.slug or new.owner_id <> old.owner_id) then
    raise exception 'shop identity is immutable';
  end if;
  if tg_op='INSERT' and current_user in ('anon','authenticated') and new.slug in
    ('login','dashboard','auth','api','demo','admin','app','www','static','about','terms') then
    raise exception 'reserved slug';
  end if;
  return new;
end $$;
create trigger guard_shop before insert or update on public.shops for each row execute function public.guard_shop();
revoke update on public.shops from authenticated;
grant update(name,whatsapp,city,avatar_url) on public.shops to authenticated;
revoke update on public.orders from authenticated;
grant update(status) on public.orders to authenticated;

create function public.guard_product_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.shop_id=old.shop_id then return new; end if;
  perform 1 from public.shops where id=new.shop_id for update;
  if (select count(*) from public.products where shop_id=new.shop_id) >= 15 then
    raise exception 'free product limit';
  end if;
  return new;
end $$;
create trigger product_limit before insert or update of shop_id on public.products for each row execute function public.guard_product_limit();

update storage.buckets set file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='product-photos';

drop policy events_public_insert on public.events;
create function public.record_view(p_shop uuid, p_client uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.owns_shop(p_shop) then return; end if;
  if p_client is null then raise exception 'invalid client'; end if;
  perform private.consume_rate('view:'||p_client::text,60,20);
  insert into public.events(shop_id,type) values(p_shop,'view');
end $$;
revoke all on function public.record_view(uuid,uuid) from public;
grant execute on function public.record_view(uuid,uuid) to anon,authenticated;

create or replace function public.create_order(p_shop uuid,p_items jsonb,p_name text,p_phone text,p_address text,p_comment text)
returns table(order_number bigint,order_total integer,order_items jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_items jsonb; v_total bigint; v_number bigint;
begin
  if p_name is null or length(trim(p_name))=0 or length(p_name)>80 then raise exception 'invalid name'; end if;
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then raise exception 'invalid phone'; end if;
  if length(p_address)>200 or length(p_comment)>300 then raise exception 'invalid details'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'invalid items'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid items'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) q where
    jsonb_typeof(q->'qty') is distinct from 'number' or (q->>'qty') !~ '^[0-9]{1,2}$'
    or (q->>'qty')::integer not between 1 and 99) then raise exception 'invalid quantity'; end if;
  if (select count(distinct q->>'id') from jsonb_array_elements(p_items) q) <> jsonb_array_length(p_items) then raise exception 'invalid items'; end if;
  perform private.consume_rate('order:'||p_phone,3600,10);
  -- Shop lock serializes numbering and cooperates with the product quota trigger.
  select next_order_number into v_number from public.shops where id=p_shop for update;
  if not found then raise exception 'shop unavailable'; end if;
  select jsonb_agg(jsonb_build_object('id',pr.id,'title',pr.title,'price',pr.price,'qty',q.qty) order by q.ord),
    sum(pr.price::bigint*q.qty) into v_items,v_total
  from (select (value->>'id')::uuid id,(value->>'qty')::integer qty, ordinality ord from jsonb_array_elements(p_items) with ordinality) q
  join public.products pr on pr.id=q.id and pr.shop_id=p_shop and pr.in_stock;
  if v_items is null or jsonb_array_length(v_items)<>jsonb_array_length(p_items) then raise exception 'items unavailable'; end if;
  if v_total>2147483647 then raise exception 'total too large'; end if;
  insert into public.orders(number,shop_id,items,total,customer_name,customer_phone,address,comment)
    values(v_number,p_shop,v_items,v_total,trim(p_name),p_phone,nullif(trim(p_address),''),nullif(trim(p_comment),''));
  update public.shops set next_order_number=v_number+1 where id=p_shop;
  insert into public.events(shop_id,type) values(p_shop,'order_click');
  return query select v_number,v_total::integer,v_items;
end $$;

-- Only a server role may reserve/release AI usage; clients cannot erase quota records.
drop policy ai_owner_insert on public.ai_generations;
drop policy ai_owner_delete on public.ai_generations;
create function public.reserve_ai(p_shop uuid,p_limit integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_limit not between 1 and 1000 then raise exception 'invalid limit'; end if;
  perform 1 from public.shops where id=p_shop for update;
  if not found then raise exception 'shop unavailable'; end if;
  if (select count(*) from public.ai_generations where shop_id=p_shop and created_at>now()-interval '24 hours') >= p_limit then raise exception 'ai limit exceeded'; end if;
  insert into public.ai_generations(shop_id) values(p_shop) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_ai(uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai(uuid,integer) to service_role;
