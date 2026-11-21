-- Создание заказа одной транзакцией. Цены и названия берутся из базы,
-- а не от клиента, поэтому подменить сумму в браузере нельзя.
-- Заодно пишется событие order_click для статистики.

create or replace function public.create_order(
  p_shop uuid,
  p_items jsonb,
  p_name text,
  p_phone text,
  p_address text,
  p_comment text
)
returns table(order_number bigint, order_total integer, order_items jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb;
  v_total integer;
  v_number bigint;
begin
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 80 then
    raise exception 'invalid name';
  end if;
  if p_phone is null or p_phone !~ '^[0-9]{10,15}$' then
    raise exception 'invalid phone';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'invalid items';
  end if;

  select
    jsonb_agg(jsonb_build_object('id', pr.id, 'title', pr.title, 'price', pr.price, 'qty', q.qty)),
    sum(pr.price * q.qty)::integer
  into v_items, v_total
  from jsonb_to_recordset(p_items) as q(id uuid, qty integer)
  join public.products pr
    on pr.id = q.id and pr.shop_id = p_shop and pr.in_stock
  where q.qty between 1 and 99;

  if v_items is null or jsonb_array_length(v_items) <> jsonb_array_length(p_items) then
    raise exception 'items unavailable';
  end if;

  insert into public.orders (shop_id, items, total, customer_name, customer_phone, address, comment)
  values (
    p_shop, v_items, v_total, trim(p_name), p_phone,
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_comment, '')), '')
  )
  returning number into v_number;

  insert into public.events (shop_id, type) values (p_shop, 'order_click');

  return query select v_number, v_total, v_items;
end;
$$;

revoke all on function public.create_order(uuid, jsonb, text, text, text, text) from public;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text) to anon, authenticated;
