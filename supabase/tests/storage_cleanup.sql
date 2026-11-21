-- Поиск осиротевших фото (0022, задача #30) на подготовленных данных.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into auth.users(id,email) values ('5c1ea000-0000-4000-8000-000000000001','storage-cleanup-test@example.test');
insert into public.shops(id,owner_id,name,slug,whatsapp,avatar_url) values
('5c1ea000-0000-4000-8000-000000000002','5c1ea000-0000-4000-8000-000000000001','Cleanup','storage-cleanup-test','77011111111',
 'http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/avatar.png');
insert into public.products(shop_id,title,price,photo_url) values
('5c1ea000-0000-4000-8000-000000000002','Used',100,'http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/used.jpg');
insert into public.products(shop_id,title,price,photo_url,source_photo_url,bbox) values
('5c1ea000-0000-4000-8000-000000000002','From shelf',100,
 'http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/crop.jpg',
 'http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/shelf.jpg',
 '{"x1":0.1,"y1":0.1,"x2":0.5,"y2":0.5}');
insert into public.bot_drafts(id,chat_id,shop_id,payload) values
('5c1ea000-0000-4000-8000-000000000003',1,'5c1ea000-0000-4000-8000-000000000002',
 '{"source_photo_url":"http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/draft-src.jpg",
   "items":[{"photo_url":"http://127.0.0.1:54321/storage/v1/object/public/product-photos/5c1ea000-0000-4000-8000-000000000001/draft-crop.jpg"},{"photo_url":null}]}');

insert into storage.objects(bucket_id,name,created_at)
select 'product-photos','5c1ea000-0000-4000-8000-000000000001/'||f, now() - age
from (values
  ('orphan.jpg', interval '2 days'), ('orphan_s.jpg', interval '2 days'),
  ('fresh.jpg', interval '30 minutes'), ('fresh_s.jpg', interval '30 minutes'),
  ('used.jpg', interval '3 days'), ('used_s.jpg', interval '3 days'),
  ('crop.jpg', interval '3 days'), ('crop_s.jpg', interval '3 days'),
  ('shelf.jpg', interval '3 days'), ('shelf_s.jpg', interval '3 days'),
  ('avatar.png', interval '3 days'), ('avatar_s.jpg', interval '3 days'),
  ('draft-src.jpg', interval '2 days'), ('draft-src_s.jpg', interval '2 days'),
  ('draft-crop.jpg', interval '2 days'), ('draft-crop_s.jpg', interval '2 days')
) as t(f, age);

create temp view cleanup_orphans as
  select replace(name, '5c1ea000-0000-4000-8000-000000000001/', '') as f
  from public.storage_orphan_photos() where name like '5c1ea000-0000-4000-8000-000000000001/%';

select is((select string_agg(f, ',' order by f collate "C") from cleanup_orphans),'orphan.jpg,orphan_s.jpg',
  'only old files without references are orphans: products, shelf, avatar, bot drafts and thumbnails are kept');
select is((select count(*)::integer from public.storage_orphan_photos(interval '1 hour', 1)),1,'limit is respected');
select is((select count(*)::integer from public.storage_orphan_photos(interval '0 seconds') where name like '5c1ea000-%fresh%'),0,
  'files younger than an hour are never orphans');

delete from public.bot_drafts where id='5c1ea000-0000-4000-8000-000000000003';
select is((select string_agg(f, ',' order by f collate "C") from cleanup_orphans),'draft-crop.jpg,draft-crop_s.jpg,draft-src.jpg,draft-src_s.jpg,orphan.jpg,orphan_s.jpg',
  'files of an expired bot draft become orphans');

set local role anon;
select throws_like($$select * from public.storage_orphan_photos()$$,'%permission denied%','anonymous cannot list orphans');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','5c1ea000-0000-4000-8000-000000000001',true);
select throws_like($$select * from public.storage_orphan_photos()$$,'%permission denied%','seller cannot list orphans');
reset role;

select * from finish();
rollback;
