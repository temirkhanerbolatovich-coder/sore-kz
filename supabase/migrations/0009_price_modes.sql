-- Услуги и товары без фиксированной цены: «от N ₸» и «по запросу».
-- Такие позиции не попадают в корзину и заказ, клиент пишет продавцу в WhatsApp (см. record_inquiry).
alter table public.products
  add column price_mode text not null default 'fixed' check (price_mode in ('fixed', 'from', 'request'));
-- Цена 0 допустима только для «по запросу». NOT VALID: старые строки не перепроверяются.
alter table public.products add constraint products_price_mode_price
  check (price_mode = 'request' or price > 0) not valid;

-- Сервер больше не принимает в заказ позиции без фиксированной цены, даже если их подсунули в запрос.
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
  join public.products pr on pr.id=q.id and pr.shop_id=p_shop and pr.in_stock and pr.price_mode='fixed';
  if v_items is null or jsonb_array_length(v_items)<>jsonb_array_length(p_items) then raise exception 'items unavailable'; end if;
  if v_total>2147483647 then raise exception 'total too large'; end if;
  insert into public.orders(number,shop_id,items,total,customer_name,customer_phone,address,comment)
    values(v_number,p_shop,v_items,v_total,trim(p_name),p_phone,nullif(trim(p_address),''),nullif(trim(p_comment),''));
  update public.shops set next_order_number=v_number+1 where id=p_shop;
  insert into public.events(shop_id,type) values(p_shop,'order_click');
  return query select v_number,v_total::integer,v_items;
end $$;

-- Учёт обращений по товарам «от»/«по запросу»: считается как нажатие «Заказать» (order_click).
create function public.record_inquiry(p_shop uuid, p_product uuid, p_client uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.owns_shop(p_shop) then return; end if;
  if p_client is null then raise exception 'invalid client'; end if;
  if not exists (select 1 from public.products where id = p_product and shop_id = p_shop and price_mode <> 'fixed') then
    raise exception 'product unavailable';
  end if;
  perform private.consume_rate('inquiry:' || p_client::text, 60, 10);
  insert into public.events(shop_id, type) values (p_shop, 'order_click');
end $$;
revoke all on function public.record_inquiry(uuid, uuid, uuid) from public;
grant execute on function public.record_inquiry(uuid, uuid, uuid) to anon, authenticated;

