-- Скрытие товара: продавец убирает товар с витрины, не удаляя его и не меняя наличие.
-- Скрытый товар не виден публично (RLS), не попадает в sitemap и не принимается в заказ.
-- Владелец видит свои скрытые товары через политику products_owner_write.

alter table public.products add column is_hidden boolean not null default false;
create index products_shop_visible_idx on public.products (shop_id) where not is_hidden;

drop policy "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (not is_hidden);

-- create_order: та же функция (подпись и результат не меняются), но скрытый товар недоступен для заказа.
create or replace function public.create_order(
  p_shop uuid, p_items jsonb, p_name text, p_phone text, p_address text, p_comment text,
  p_needed_date date default null, p_needed_time text default null
)
returns table(order_number bigint, order_total integer, order_items jsonb, order_code text)
language plpgsql security definer set search_path = '' as $$
declare
  shop_orders_per_hour constant integer := 30;
  v_items jsonb; v_total bigint; v_number bigint; v_lead integer; v_today date; v_code text;
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
  if p_shop is null then raise exception 'shop unavailable'; end if;
  perform private.consume_rate('shop-orders:' || p_shop::text, 3600, shop_orders_per_hour);

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
  join public.products pr on pr.id = q.id and pr.shop_id = p_shop and pr.in_stock and not pr.is_hidden and pr.price_mode = 'fixed'
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
            p_needed_date, nullif(trim(p_needed_time), ''))
    returning public_code into v_code;
  update public.shops set next_order_number = v_number + 1 where id = p_shop;
  insert into public.events(shop_id, type) values (p_shop, 'order_click');
  return query select v_number, v_total::integer, v_items, v_code;
end $$;
