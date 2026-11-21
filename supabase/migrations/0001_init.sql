-- DukenAI: начальная схема, RLS и хранилище фото.
-- Выполните в Supabase → SQL Editor (или через supabase db push).

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,15}$'),
  city text,
  avatar_url text,
  created_at timestamptz not null default now()
);
create index shops_owner_idx on public.shops(owner_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description_ru text,
  description_kz text,
  category text,
  price integer not null check (price >= 0),
  photo_url text,
  in_stock boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index products_shop_idx on public.products(shop_id, sort);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001),
  shop_id uuid not null references public.shops(id) on delete cascade,
  items jsonb not null,
  total integer not null check (total >= 0),
  customer_name text not null,
  customer_phone text not null,
  address text,
  comment text,
  status text not null default 'new' check (status in ('new', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index orders_shop_idx on public.orders(shop_id, created_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  type text not null check (type in ('view', 'order_click')),
  created_at timestamptz not null default now()
);
create index events_shop_idx on public.events(shop_id, created_at desc);

-- Учёт ИИ-генераций для дневного лимита
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index ai_generations_idx on public.ai_generations(shop_id, created_at desc);

-- Проверка владельца без рекурсии политик
create or replace function public.owns_shop(shop uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shops where id = shop and owner_id = auth.uid());
$$;

alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.events enable row level security;
alter table public.ai_generations enable row level security;

-- shops: читают все, меняет только владелец
create policy "shops_public_read" on public.shops for select using (true);
create policy "shops_owner_insert" on public.shops for insert to authenticated with check (owner_id = auth.uid());
create policy "shops_owner_update" on public.shops for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shops_owner_delete" on public.shops for delete to authenticated using (owner_id = auth.uid());

-- products: читают все, меняет владелец магазина
create policy "products_public_read" on public.products for select using (true);
create policy "products_owner_write" on public.products for all to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));

-- orders: создаёт любой клиент, читает и меняет только владелец
create policy "orders_public_insert" on public.orders for insert to anon, authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id));
create policy "orders_owner_read" on public.orders for select to authenticated using (public.owns_shop(shop_id));
create policy "orders_owner_update" on public.orders for update to authenticated
  using (public.owns_shop(shop_id)) with check (public.owns_shop(shop_id));

-- events: пишет любой, читает владелец
create policy "events_public_insert" on public.events for insert to anon, authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id));
create policy "events_owner_read" on public.events for select to authenticated using (public.owns_shop(shop_id));

-- ai_generations: только владелец
create policy "ai_owner_read" on public.ai_generations for select to authenticated using (public.owns_shop(shop_id));
create policy "ai_owner_insert" on public.ai_generations for insert to authenticated with check (public.owns_shop(shop_id));

-- Хранилище фото товаров: публичное чтение, запись в свою папку <user_id>/...
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "photos_public_read" on storage.objects for select using (bucket_id = 'product-photos');
create policy "photos_owner_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_owner_update" on storage.objects for update to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-photos' and (storage.foldername(name))[1] = auth.uid()::text);
