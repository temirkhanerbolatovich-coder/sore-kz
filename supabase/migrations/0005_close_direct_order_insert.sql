-- Заказы создаются только через create_order (security definer), который считает цены на сервере.
-- Прямая вставка в orders от анонима позволяла бы подставить любую сумму, поэтому закрываем её.
drop policy if exists "orders_public_insert" on public.orders;
