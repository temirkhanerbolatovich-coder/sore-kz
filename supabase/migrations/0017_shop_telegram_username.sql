-- Telegram продавца для покупателей: кнопка «Написать в Telegram» на странице заказа.
-- Это публичный ник продавца (без @), а не привязка бота уведомлений (таблица shop_telegram).
alter table public.shops add column telegram_username text;
alter table public.shops add constraint shops_telegram_username_format
  check (telegram_username is null or telegram_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$');

-- Колонки магазина продавцу доступны только поимённо (см. 0004, 0010, 0014).
grant insert(telegram_username), update(telegram_username) on public.shops to authenticated;
