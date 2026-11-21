-- Кабинет рассчитан на один магазин на аккаунт: фиксируем это на уровне базы.
create unique index if not exists shops_owner_unique on public.shops(owner_id);
