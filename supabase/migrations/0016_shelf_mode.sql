-- Режим «фото полки»: одна фотография полки даёт несколько товаров.
-- bbox: рамка товара на исходном снимке в долях кадра (0..1), source_photo_url: сам снимок полки,
-- sku: артикул продавца (повторный импорт прайса обновляет товар, а не дублирует),
-- price_needs_review: цена прочитана ИИ с ценника или взята из файла и требует проверки продавцом.
-- Чтение товаров остаётся публичным (витрина): рамка и снимок полки показываются покупателю,
-- артикул виден так же, как название и цена. Запись по-прежнему только владельцу магазина (RLS).

create or replace function public.valid_bbox(b jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when b is null then true
    when jsonb_typeof(b) <> 'object' then false
    when not (b ?& array['x1', 'y1', 'x2', 'y2']) then false
    when (select count(*) from jsonb_object_keys(b)) <> 4 then false
    when jsonb_typeof(b->'x1') <> 'number' or jsonb_typeof(b->'y1') <> 'number'
      or jsonb_typeof(b->'x2') <> 'number' or jsonb_typeof(b->'y2') <> 'number' then false
    else (b->>'x1')::numeric >= 0 and (b->>'y1')::numeric >= 0
      and (b->>'x2')::numeric <= 1 and (b->>'y2')::numeric <= 1
      and (b->>'x1')::numeric < (b->>'x2')::numeric
      and (b->>'y1')::numeric < (b->>'y2')::numeric
  end
$$;

alter table public.products
  add column bbox jsonb,
  add column source_photo_url text,
  add column sku text,
  add column price_needs_review boolean not null default false;

alter table public.products add constraint products_bbox_valid check (public.valid_bbox(bbox));
alter table public.products add constraint products_shelf_fields check (
  (sku is null or (char_length(sku) between 1 and 100 and sku = btrim(sku)))
  and (source_photo_url is null or char_length(source_photo_url) <= 2000)
  -- Рамка без снимка бессмысленна: покупателю нечего показать.
  and (bbox is null or source_photo_url is not null)
);

-- Артикул уникален внутри магазина; товары без артикула не ограничены.
create unique index products_shop_sku_key on public.products (shop_id, sku) where sku is not null;
