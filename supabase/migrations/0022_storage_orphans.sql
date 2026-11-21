-- Уборка осиротевших фото в бакете product-photos (задача #30).
-- Файлы удаляет не база, а Storage API (маршрут /api/cron/storage-cleanup по Vercel Cron):
-- прямое удаление из storage.objects оставило бы сами файлы в хранилище. Здесь только поиск.
--
-- Файл используется, если на него ссылается products.photo_url, products.source_photo_url, shops.avatar_url
-- или живой черновик бота (bot_drafts.payload: source_photo_url и items[].photo_url). Миниатюра `<имя>_s.jpg`
-- используется вместе со своим оригиналом. Свежие файлы (моложе p_min_age, по умолчанию сутки) не трогаем:
-- продавец может ещё выбирать товары с фото полки, а бот загружать вырезки.

create function public.storage_orphan_photos(p_min_age interval default interval '24 hours', p_limit integer default 1000)
returns table(name text)
language sql stable security definer set search_path = '' as $$
  with refs as (
    select p.photo_url as url from public.products p
    union all select p.source_photo_url from public.products p
    union all select s.avatar_url from public.shops s
    union all select d.payload->>'source_photo_url' from public.bot_drafts d
    union all
    select i->>'photo_url'
    from public.bot_drafts d
    cross join lateral jsonb_array_elements(case when jsonb_typeof(d.payload->'items') = 'array' then d.payload->'items' else '[]'::jsonb end) i
  ),
  used as (
    select substring(url from '/storage/v1/object/public/product-photos/([^?#]+)') as path from refs where url is not null
  ),
  keep as (
    select path from used where path is not null
    union
    select regexp_replace(path, '\.[^./]+$', '_s.jpg') from used where path is not null
  )
  select o.name
  from storage.objects o
  where o.bucket_id = 'product-photos'
    and o.created_at < now() - greatest(p_min_age, interval '1 hour')
    and not exists (select 1 from keep k where k.path = o.name)
  order by o.created_at
  limit greatest(1, least(coalesce(p_limit, 1000), 1000));
$$;

revoke all on function public.storage_orphan_photos(interval, integer) from public, anon, authenticated;
grant execute on function public.storage_orphan_photos(interval, integer) to service_role;
