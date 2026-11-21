-- 1) Варианты товара (вес, размер), 2) дата и время заказа и срок предзаказа,
-- 3) Telegram-уведомления продавцу о новых заказах.

------------------------------------------------------------------------------
-- Варианты: [{"id":"1kg","title":"1 кг","price":12000}, ...]
------------------------------------------------------------------------------
create function public.valid_variants(v jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(v) = 'array'
    and jsonb_array_length(v) <= 10
    and not exists (
      select 1 from jsonb_array_elements(v) e
      where jsonb_typeof(e) <> 'object'
        or coalesce(e->>'id', '') !~ '^[a-zA-Z0-9_-]{1,20}$'
        or char_length(coalesce(e->>'title', '')) not between 1 and 40
        or coalesce(e->>'price', '') !~ '^[0-9]{1,9}$'
        or (e->>'price')::bigint < 1 or (e->>'price')::bigint > 100000000
    )
    and (select count(distinct e->>'id') from jsonb_array_elements(v) e) = jsonb_array_length(v);
$$;
grant execute on function public.valid_variants(jsonb) to anon, authenticated, service_role;

alter table public.products add column variants jsonb not null default '[]'::jsonb;
alter table public.products add constraint products_variants_valid check (public.valid_variants(variants));
-- Варианты имеют смысл только у товара с ценой, не у «по запросу».
alter table public.products add constraint products_variants_price_mode check (price_mode <> 'request' or variants = '[]'::jsonb);

-- Базовая цена товара с вариантами = самая низкая цена варианта (показывается как «от N ₸»).
create function public.products_sync_price() returns trigger language plpgsql as $$
begin
  if jsonb_array_length(new.variants) > 0 then
    select min((e->>'price')::integer) into new.price from jsonb_array_elements(new.variants) e;
  end if;
  return new;
end $$;
create trigger products_sync_price before insert or update of variants, price on public.products
  for each row execute function public.products_sync_price();

------------------------------------------------------------------------------
-- Дата и время заказа, срок предзаказа
------------------------------------------------------------------------------
alter table public.shops add column lead_days integer not null default 0 check (lead_days between 0 and 60);
grant update(lead_days) on public.shops to authenticated;
grant insert(lead_days) on public.shops to authenticated;

alter table public.orders add column needed_date date;
alter table public.orders add column needed_time text check (char_length(needed_time) <= 20);

drop function if exists public.create_order(uuid, jsonb, text, text, text, text);
create function public.create_order(
  p_shop uuid, p_items jsonb, p_name text, p_phone text, p_address text, p_comment text,
  p_needed_date date default null, p_needed_time text default null
)
returns table(order_number bigint, order_total integer, order_items jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_items jsonb; v_total bigint; v_number bigint; v_lead integer; v_today date;
begin
  if p_name is null or length(trim(p_name)) = 0 or length(p_name) > 80 then raise exception 'invalid name'; end if;
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then raise exception 'invalid phone'; end if;
  if length(p_address) > 200 or length(p_comment) > 300 or length(p_needed_time) > 20 then raise exception 'invalid details'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'invalid items'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'invalid items'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) q where
    jsonb_typeof(q->'qty') is distinct from 'number' or (q->>'qty') !~ '^[0-9]{1,2}$'
    or (q->>'qty')::integer not between 1 and 99) then raise exception 'invalid quantity'; end if;
  if (select count(distinct (q->>'id') || ':' || coalesce(q->>'variant', '')) from jsonb_array_elements(p_items) q)
     <> jsonb_array_length(p_items) then raise exception 'invalid items'; end if;
  perform private.consume_rate('order:' || p_phone, 3600, 10);

  -- Блокировка магазина сериализует нумерацию и лимиты.
  select next_order_number, lead_days into v_number, v_lead from public.shops where id = p_shop for update;
  if not found then raise exception 'shop unavailable'; end if;

  v_today := (now() at time zone 'Asia/Almaty')::date;
  if p_needed_date is not null and (p_needed_date < v_today + v_lead or p_needed_date > v_today + 365) then
    raise exception 'date too early';
  end if;
  if v_lead > 0 and p_needed_date is null then raise exception 'date required'; end if;

  select jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'title', case when v.title is null then pr.title else pr.title || ' · ' || v.title end,
      'price', coalesce(v.price, pr.price),
      'qty', q.qty,
      'variant', q.variant) order by q.ord),
    sum(coalesce(v.price, pr.price)::bigint * q.qty)
  into v_items, v_total
  from (select (value->>'id')::uuid id, (value->>'qty')::integer qty, nullif(value->>'variant', '') variant, ordinality ord
        from jsonb_array_elements(p_items) with ordinality) q
  join public.products pr on pr.id = q.id and pr.shop_id = p_shop and pr.in_stock and pr.price_mode = 'fixed'
  left join lateral (
    select e->>'title' as title, (e->>'price')::integer as price
    from jsonb_array_elements(pr.variants) e where e->>'id' = q.variant limit 1
  ) v on true
  where (jsonb_array_length(pr.variants) = 0 and q.variant is null)
     or (jsonb_array_length(pr.variants) > 0 and v.title is not null);

  if v_items is null or jsonb_array_length(v_items) <> jsonb_array_length(p_items) then raise exception 'items unavailable'; end if;
  if v_total > 2147483647 then raise exception 'total too large'; end if;

  insert into public.orders(number, shop_id, items, total, customer_name, customer_phone, address, comment, needed_date, needed_time)
    values (v_number, p_shop, v_items, v_total, trim(p_name), p_phone, nullif(trim(p_address), ''), nullif(trim(p_comment), ''),
            p_needed_date, nullif(trim(p_needed_time), ''));
  update public.shops set next_order_number = v_number + 1 where id = p_shop;
  insert into public.events(shop_id, type) values (p_shop, 'order_click');
  return query select v_number, v_total::integer, v_items;
end $$;
revoke all on function public.create_order(uuid, jsonb, text, text, text, text, date, text) from public;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text, date, text) to anon, authenticated;

------------------------------------------------------------------------------
-- Telegram: привязка чата продавца и уведомления о заказах
------------------------------------------------------------------------------
create table public.shop_telegram (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  link_code text unique,
  chat_id bigint,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.shop_telegram enable row level security;
-- Продавец видит только статус своей привязки; писать может лишь сервер (service_role).
revoke all on public.shop_telegram from anon, authenticated;
grant select(shop_id, linked_at, link_code) on public.shop_telegram to authenticated;
create policy shop_telegram_owner_read on public.shop_telegram for select to authenticated using (public.owns_shop(shop_id));

create extension if not exists pg_net with schema extensions;

create table private.app_config (key text primary key, value text not null);

create function public.set_notify_config(p_url text, p_secret text) returns void
language sql security definer set search_path = '' as $$
  insert into private.app_config(key, value) values ('notify_url', p_url), ('notify_secret', p_secret)
  on conflict (key) do update set value = excluded.value;
$$;
revoke all on function public.set_notify_config(text, text) from public, anon, authenticated;
grant execute on function public.set_notify_config(text, text) to service_role;

-- После вставки заказа сообщаем серверу приложения (только id заказа). Сбой уведомления никогда не мешает заказу.
create function private.notify_new_order() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  select value into v_url from private.app_config where key = 'notify_url';
  select value into v_secret from private.app_config where key = 'notify_secret';
  if v_url is not null then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(v_secret, '')),
      body := jsonb_build_object('order_id', new.id),
      timeout_milliseconds := 5000);
  end if;
  return new;
exception when others then
  return new;
end $$;
create trigger orders_notify after insert on public.orders for each row execute function private.notify_new_order();
