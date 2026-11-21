-- Уведомление продавцу в Telegram об обращении «Узнать цену» (товары «от» и «по запросу»).
-- Учёт обращения не меняется. Дополнительно сообщаем серверу приложения (адрес и секрет те же, что у уведомлений о заказах):
-- в теле id магазина и товара, текст собирает сервер. Чтобы не засыпать продавца:
--   не чаще одного уведомления на покупателя и товар за 10 минут, и не больше 20 в час на магазин.
-- Сбой уведомления (нет адреса, лимит, ошибка сети) никогда не мешает учёту обращения.
create or replace function public.record_inquiry(p_shop uuid, p_product uuid, p_client uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_url text; v_secret text;
begin
  if public.owns_shop(p_shop) then return; end if;
  if p_client is null then raise exception 'invalid client'; end if;
  if not exists (select 1 from public.products where id = p_product and shop_id = p_shop and price_mode <> 'fixed') then
    raise exception 'product unavailable';
  end if;
  perform private.consume_rate('inquiry:' || p_client::text, 60, 10);
  insert into public.events(shop_id, type) values (p_shop, 'order_click');

  begin
    perform private.consume_rate('inquiry-notify:' || p_client::text || ':' || p_product::text, 600, 1);
    perform private.consume_rate('inquiry-notify-shop:' || p_shop::text, 3600, 20);
    select value into v_url from private.app_config where key = 'notify_url';
    select value into v_secret from private.app_config where key = 'notify_secret';
    if v_url is not null then
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', coalesce(v_secret, '')),
        body := jsonb_build_object('inquiry', jsonb_build_object('shop_id', p_shop, 'product_id', p_product)),
        timeout_milliseconds := 5000);
    end if;
  exception when others then
    null;
  end;
end $$;
