-- Условия оплаты и доставки: свободный текст продавца (например «Kaspi-перевод, наличными при встрече»).
-- Поля публичные, как остальной блок «О магазине»; онлайн-оплаты в приложении нет, это только информация для покупателя.
alter table public.shops
  add column payment_info text check (payment_info is null or char_length(payment_info) <= 300),
  add column delivery_info text check (delivery_info is null or char_length(delivery_info) <= 300);

-- Продавец меняет только свои поля (RLS owns_shop уже ограничивает строки).
grant update(payment_info, delivery_info) on public.shops to authenticated;
