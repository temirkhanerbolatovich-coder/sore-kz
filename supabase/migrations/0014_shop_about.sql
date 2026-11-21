-- «О магазине»: короткое описание, адрес, график и ник в Instagram. Поля публичные, как и остальная витрина.
alter table public.shops
  add column about text check (about is null or char_length(about) <= 300),
  add column address text check (address is null or char_length(address) <= 120),
  add column hours text check (hours is null or char_length(hours) <= 120),
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');

-- Продавец меняет только свои поля (RLS owns_shop уже ограничивает строки).
grant update(about, address, hours, instagram) on public.shops to authenticated;
