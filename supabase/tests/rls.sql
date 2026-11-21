begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(122);
insert into auth.users(id,email) values ('a0000000-0000-4000-8000-000000000001','rls-a@example.test'),('b0000000-0000-4000-8000-000000000001','rls-b@example.test');
insert into public.shops(id,owner_id,name,slug,whatsapp) values
('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000001','Shop A','rls-shop-a','77011111111'),
('b0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000001','Shop B','rls-shop-b','77022222222');
insert into public.products(id,shop_id,title,price,in_stock) values
('a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000002','A',100,true),
('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002','B',200,true),
('a0000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000002','Sold out',100,false);
insert into public.products(id,shop_id,title,price,price_mode) values
('a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000002','Ask me',0,'request'),
('a0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000002','From price',15000,'from');
insert into public.products(id,shop_id,title,price,is_hidden) values('b0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000002','Hidden',100,true);
insert into public.ai_generations(shop_id) values('b0000000-0000-4000-8000-000000000002');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)::integer from public.shops where slug like 'rls-shop-%'),2,'anonymous reads storefronts');
select is((select count(*)::integer from public.products where title in ('A','B','Sold out')),3,'anonymous reads products');
select is((select count(*)::integer from public.products where title='Hidden'),0,'anonymous does not see hidden products');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000008","qty":1}]','Buyer','77033333333','','')$$,'%items unavailable%','hidden product cannot be ordered');
select is((select count(*)::integer from public.orders),0,'anonymous cannot read orders');
select is((select count(*)::integer from public.events),0,'anonymous cannot read events');
select is((select count(*)::integer from public.ai_generations),0,'anonymous cannot read AI usage');
select throws_like($$insert into public.orders(number,shop_id,items,total,customer_name,customer_phone) values(1,'a0000000-0000-4000-8000-000000000002','[]',0,'x','77011111111')$$,'%row-level security%','direct order insert denied');
select lives_ok($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":2}]','Buyer','77033333333','','')$$,'anonymous RPC works');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[]','Buyer','77033333333','','')$$,'%invalid items%','empty cart rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":100}]','Buyer','77033333333','','')$$,'%invalid quantity%','quantity over 99 rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":0}]','Buyer','77033333333','','')$$,'%invalid quantity%','zero quantity rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77033333333','','')$$,'%items unavailable%','foreign product rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000004","qty":1}]','Buyer','77033333333','','')$$,'%items unavailable%','sold out rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','bad','','')$$,'%invalid phone%','bad phone rejected');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000006","qty":1}]','Buyer','77033333333','','')$$,'%items unavailable%','price on request cannot be ordered');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000007","qty":1}]','Buyer','77033333333','','')$$,'%items unavailable%','from-price item cannot be ordered');
select throws_like($$insert into public.events(shop_id,type) values('a0000000-0000-4000-8000-000000000002','view')$$,'%row-level security%','direct events denied');
reset role;
select is((select total from public.orders where shop_id='b0000000-0000-4000-8000-000000000002'),400,'server computes total');
select is((select number::integer from public.orders where shop_id='b0000000-0000-4000-8000-000000000002'),1,'new shop starts at one');
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.orders where shop_id='b0000000-0000-4000-8000-000000000002'),0,'A cannot read B orders');
select is((select count(*)::integer from public.products where title='Hidden'),0,'A cannot see B hidden product');
with changed as (update public.shops set name='hacked' where id='b0000000-0000-4000-8000-000000000002' returning id) select is(count(*)::integer,0,'A cannot update B shop') from changed;
with changed as (update public.products set price=1 where id='b0000000-0000-4000-8000-000000000003' returning id) select is(count(*)::integer,0,'A cannot update B product') from changed;
select throws_like($$insert into storage.objects(bucket_id,name) values('product-photos','b0000000-0000-4000-8000-000000000001/hacked.jpg')$$,'%row-level security%','A cannot upload into B folder');
select throws_like($$update public.shops set slug='changed' where id='a0000000-0000-4000-8000-000000000002'$$,'%permission denied%','slug immutable through API');
select lives_ok($$select public.record_view('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005')$$,'owner view ignored');
reset role;
select is((select count(*)::integer from public.events where shop_id='a0000000-0000-4000-8000-000000000002'),0,'owner did not increase views');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin for i in 1..20 loop perform public.record_view('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005'); end loop; end $$;
select throws_like($$select public.record_view('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000005')$$,'%rate limit%','view quota enforced');
do $$begin for i in 1..10 loop perform public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77044444444','',''); end loop; end $$;
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77044444444','','')$$,'%rate limit%','order quota enforced');
select lives_ok($test$
  do $body$ begin
    for i in 1..20 loop
      perform public.create_order('a0000000-0000-4000-8000-000000000002',
        '[{"id":"a0000000-0000-4000-8000-000000000003","qty":1}]', 'Buyer', '7704000' || lpad(i::text, 4, '0'), '', '');
    end loop;
  end; $body$
$test$, 'shop accepts 30 orders in the hour');
select throws_like($$select public.create_order('a0000000-0000-4000-8000-000000000002','[{"id":"a0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77040000021','','')$$,'%rate limit exceeded%','shop rejects order 31 even with a fresh phone');
select lives_ok($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77040000021','','')$$,'shop quota does not affect other shops');
reset role;
update public.shops set accepting_orders = false where id = 'b0000000-0000-4000-8000-000000000002';
set local role anon;
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77040000022','','')$$,'%orders paused%','paused shop rejects orders');
reset role;
update public.shops set accepting_orders = true where id = 'b0000000-0000-4000-8000-000000000002';
set local role anon;
select lives_ok($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77040000023','','')$$,'resumed shop accepts orders again');
select lives_ok($$select public.record_inquiry('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000008')$$,'inquiry about a price-on-request item is recorded');
select lives_ok($$select public.record_inquiry('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000008')$$,'repeated inquiry about the same item is accepted, notification is throttled silently');
select throws_like($$select public.record_inquiry('a0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000008')$$,'%product unavailable%','inquiry rejected for a fixed-price item');
reset role;
insert into public.products(shop_id,title,price) select 'a0000000-0000-4000-8000-000000000002','Extra '||n,1 from generate_series(1,11) n;
select throws_like($$insert into public.products(shop_id,title,price) values('a0000000-0000-4000-8000-000000000002','Sixteenth',1)$$,'%free product limit%','SQL enforces 15 products');

-- Варианты, дата заказа и Telegram
reset role;
insert into public.products(id,shop_id,title,price,variants) values
('b0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','Cake',1,'[{"id":"k1","title":"1 кг","price":100},{"id":"k2","title":"2 кг","price":180}]');
select is((select price from public.products where id='b0000000-0000-4000-8000-000000000004'),100,'base price follows the cheapest variant');
select throws_like($$insert into public.products(shop_id,title,price,variants) values('b0000000-0000-4000-8000-000000000002','Bad',1,'[{"id":"x","title":"t","price":0}]')$$,'%violates check constraint%','invalid variant price rejected');
select throws_like($$insert into public.products(shop_id,title,price,price_mode,variants) values('b0000000-0000-4000-8000-000000000002','Bad2',0,'request','[{"id":"x","title":"t","price":5}]')$$,'%products_variants_price_mode%','variants are not allowed with price on request');
update public.shops set lead_days = 2 where id='b0000000-0000-4000-8000-000000000002';
insert into public.shop_telegram(shop_id,link_code,chat_id) values ('a0000000-0000-4000-8000-000000000002','CODEA',111),('b0000000-0000-4000-8000-000000000002','CODEB',222);
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select order_total from public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000004","qty":1,"variant":"k2"}]','Buyer','77055555555','','',(now() at time zone 'Asia/Almaty')::date + 5,'18:00')),180,'variant price is charged');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000004","qty":1}]','Buyer','77055555555','','',(now() at time zone 'Asia/Almaty')::date + 5,null)$$,'%items unavailable%','variant is required when the product has variants');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000004","qty":1,"variant":"zz"}]','Buyer','77055555555','','',(now() at time zone 'Asia/Almaty')::date + 5,null)$$,'%items unavailable%','unknown variant rejected');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1,"variant":"k1"}]','Buyer','77055555555','','',(now() at time zone 'Asia/Almaty')::date + 5,null)$$,'%items unavailable%','variant on a product without variants rejected');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77055555555','','')$$,'%date required%','date is required when the shop needs lead time');
select throws_like($$select public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Buyer','77055555555','','',(now() at time zone 'Asia/Almaty')::date,null)$$,'%date too early%','date inside the lead time rejected');
select throws_like($$select count(*) from public.shop_telegram$$,'%permission denied%','anonymous cannot read Telegram links');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.shop_telegram),1,'owner sees only own Telegram link status');
-- Одноразовые nonce входа из бота (0021): только сервис, продавец не может ни прочитать, ни погасить чужой.
select throws_like($$select count(*) from public.bot_login_nonces$$,'%permission denied%','seller cannot read bot login nonces');
select throws_like($$insert into public.bot_login_nonces(nonce) values ('seller-made-nonce-0001')$$,'%permission denied%','seller cannot burn a bot login nonce');
reset role;
set local role anon;
select throws_like($$select count(*) from public.bot_login_nonces$$,'%permission denied%','anonymous cannot read bot login nonces');
reset role;
insert into public.bot_login_nonces(nonce, created_at) values ('rls-old-nonce-000000001', now() - interval '2 days'),('rls-fresh-nonce-0000001', now());
select private.purge_old_data();
select is((select string_agg(nonce, ',') from public.bot_login_nonces where nonce like 'rls-%'),'rls-fresh-nonce-0000001','retention removes used bot login nonces after a day');

-- Открытые маршруты вызывают лимитер через service_role, обход через RPC запрещён.
select ok(not exists (
  select 1 from pg_proc p
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid = 'public.rate_limit_hit(text,integer,integer)'::regprocedure
    and a.grantee = 0 and a.privilege_type = 'EXECUTE'
), 'PUBLIC has no execute grant for rate limiter');
set local role anon;
select throws_like($$select public.rate_limit_hit('rls-report',60,1)$$,'%permission denied%','anonymous cannot use rate limiter');
reset role;
set local role authenticated;
select throws_like($$select public.rate_limit_hit('rls-report',60,1)$$,'%permission denied%','authenticated cannot use rate limiter');
reset role;
set local role service_role;
select is(public.rate_limit_hit('rls-report',60,1),true,'service role can start window');
select is(public.rate_limit_hit('rls-report',60,1),false,'rate limiter returns false after allowance');
reset role;

-- Очистка удаляет только записи старше соответствующего срока.
insert into private.rate_limits(key, window_start, hits) values
  ('rls-retention:old', now() - interval '25 hours', 1),
  ('rls-retention:fresh', now() - interval '23 hours', 1);
insert into public.events(id, shop_id, type, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'view', now() - interval '91 days'),
  ('c0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'view', now() - interval '89 days');
insert into public.ai_generations(id, shop_id, created_at) values
  ('c0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002', now() - interval '31 days'),
  ('c0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000002', now() - interval '29 days');
update public.orders set created_at = now() - interval '91 days'
where shop_id = 'b0000000-0000-4000-8000-000000000002' and number = 1;
select lives_ok($$select private.purge_old_data()$$, 'maintenance function runs');
select results_eq(
  $$select key from private.rate_limits where key like 'rls-retention:%' order by key$$,
  array['rls-retention:fresh'], 'only expired rate windows are deleted');
select results_eq(
  $$select id::text from public.events where id::text like 'c0000000-%' order by id$$,
  array['c0000000-0000-4000-8000-000000000002'], 'only events older than 90 days are deleted');
select results_eq(
  $$select id::text from public.ai_generations where id::text like 'c0000000-%' order by id$$,
  array['c0000000-0000-4000-8000-000000000004'], 'only AI usage older than 30 days is deleted');
select is((select count(*)::integer from public.orders where
  shop_id = 'b0000000-0000-4000-8000-000000000002' and number = 1), 1, 'old orders are preserved');

-- Общий предел учитывает попытки всех магазинов за последние 24 часа.
select ok(not has_function_privilege('anon', 'public.reserve_ai(uuid,integer,bigint)', 'EXECUTE'), 'anonymous cannot reserve AI');
select ok(not has_function_privilege('authenticated', 'public.reserve_ai(uuid,integer,bigint)', 'EXECUTE'), 'authenticated cannot reserve AI');
set local role service_role;
select set_config('dukenai.test_ai_limit', (
  select (count(*) + 1)::text from public.ai_generations where created_at >= now() - interval '24 hours'
), true);
insert into public.ai_generations(shop_id, created_at)
values ('a0000000-0000-4000-8000-000000000002', now() - interval '25 hours');
select lives_ok($$select public.reserve_ai('a0000000-0000-4000-8000-000000000002',20,current_setting('dukenai.test_ai_limit')::bigint)$$, 'reservation ignores usage outside 24 hours');
select throws_like($$select public.reserve_ai('b0000000-0000-4000-8000-000000000002',20,current_setting('dukenai.test_ai_limit')::bigint)$$, '%ai global limit exceeded%', 'reservations by different shops share a limit');
select throws_like($$select public.reserve_ai('a0000000-0000-4000-8000-000000000002',1,current_setting('dukenai.test_ai_limit')::bigint + 1)$$, '%ai limit exceeded%', 'per-shop limit still applies');
reset role;

-- «О магазине»: поля меняет только владелец, значения проверяются ограничениями базы.
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select lives_ok($$update public.shops set about='Печём торты', address='левый берег', hours='9:00–20:00', instagram='aliya.sweets' where id='a0000000-0000-4000-8000-000000000002'$$, 'owner updates shop info');
select is((select instagram from public.shops where id='a0000000-0000-4000-8000-000000000002'), 'aliya.sweets', 'shop info is saved');
select throws_like($$update public.shops set instagram='bad handle!' where id='a0000000-0000-4000-8000-000000000002'$$, '%shops_instagram_check%', 'invalid Instagram handle rejected');
select throws_like($$update public.shops set about=repeat('x',301) where id='a0000000-0000-4000-8000-000000000002'$$, '%shops_about_check%', 'about over 300 characters rejected');
select lives_ok($$update public.shops set payment_info='Kaspi-перевод', delivery_info='По городу 1500 ₸' where id='a0000000-0000-4000-8000-000000000002'$$, 'owner updates payment and delivery info');
select is((select payment_info from public.shops where id='a0000000-0000-4000-8000-000000000002'), 'Kaspi-перевод', 'payment info is saved');
select throws_like($$update public.shops set payment_info=repeat('x',301) where id='a0000000-0000-4000-8000-000000000002'$$, '%shops_payment_info_check%', 'payment info over 300 characters rejected');
select throws_like($$update public.shops set delivery_info=repeat('x',301) where id='a0000000-0000-4000-8000-000000000002'$$, '%shops_delivery_info_check%', 'delivery info over 300 characters rejected');
select lives_ok($$update public.shops set accepting_orders=false where id='a0000000-0000-4000-8000-000000000002'$$, 'owner can pause own shop orders');
select lives_ok($$update public.shops set accepting_orders=true where id='a0000000-0000-4000-8000-000000000002'$$, 'owner can resume own shop orders');
select lives_ok($$update public.shops set about='hijack' where id='b0000000-0000-4000-8000-000000000002'$$, 'update of a foreign shop is silently ignored');
reset role;
select is((select about from public.shops where id='b0000000-0000-4000-8000-000000000002'), null, 'foreign shop info is unchanged');

-- Статус заказа по коду: покупатель видит только безопасные поля.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)::integer from public.orders where public_code is not null), 0, 'anonymous cannot read order codes');
select set_config('dukenai.status_code', (select order_code from public.create_order('b0000000-0000-4000-8000-000000000002','[{"id":"b0000000-0000-4000-8000-000000000003","qty":1}]','Status Buyer','77055555556','','',(now() at time zone 'Asia/Almaty')::date + 30)), true);
select is(length(current_setting('dukenai.status_code')), 20, 'create_order returns a 20-character order code');
select is((select order_total from public.get_order_status(current_setting('dukenai.status_code'))), 200, 'status page shows the server total');
select is((select order_status from public.get_order_status(current_setting('dukenai.status_code'))), 'new', 'new order has status new');
select ok((select to_jsonb(s)::text from public.get_order_status(current_setting('dukenai.status_code')) s) not like '%77055555556%', 'status never contains the customer phone');
select is((select count(*)::integer from public.get_order_status('not-a-code')), 0, 'malformed code returns nothing');
select is((select count(*)::integer from public.get_order_status('0123456789abcdef0123')), 0, 'unknown code returns nothing');
select throws_like($$select count(*) from (select public.get_order_status(lpad(i::text, 20, '0')) from generate_series(1, 150) i) s$$, '%rate limit exceeded%', 'guessing codes hits the shared limit');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
select lives_ok($$update public.orders set status='done' where public_code=current_setting('dukenai.status_code')$$, 'seller marks the order done');
reset role;
set local role anon;
select is((select order_status from public.get_order_status(current_setting('dukenai.status_code'))), 'done', 'buyer sees the new status');
reset role;

insert into auth.users(id,email) values ('c0000000-0000-4000-8000-000000000001','rls-c@example.test');
insert into public.shops(id,owner_id,name,slug,whatsapp) values ('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','Shop C','rls-shop-c','77033333334');
-- 0016–0018: фото полки, Telegram продавца, импорт прайса.
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select lives_ok($$update public.products set bbox='{"x1":0.1,"y1":0.2,"x2":0.5,"y2":0.9}', source_photo_url='https://example.test/shelf.jpg', sku='A-1' where id='a0000000-0000-4000-8000-000000000003'$$,'owner sets bbox, shelf photo and sku');
select throws_like($$update public.products set bbox='{"x1":0.6,"y1":0.2,"x2":0.5,"y2":0.9}' where id='a0000000-0000-4000-8000-000000000003'$$,'%products_bbox_valid%','inverted bbox rejected');
select throws_like($$update public.products set bbox='{"x1":0,"y1":0,"x2":1.5,"y2":1}' where id='a0000000-0000-4000-8000-000000000003'$$,'%products_bbox_valid%','bbox outside the frame rejected');
select throws_like($$update public.products set bbox='{"x1":"0","y1":0,"x2":1,"y2":1}' where id='a0000000-0000-4000-8000-000000000003'$$,'%products_bbox_valid%','non-numeric bbox rejected');
select throws_like($$update public.products set bbox='{"x1":0,"y1":0,"x2":1,"y2":1,"z":1}' where id='a0000000-0000-4000-8000-000000000003'$$,'%products_bbox_valid%','bbox with extra keys rejected');
select throws_like($$update public.products set source_photo_url=null where id='a0000000-0000-4000-8000-000000000003'$$,'%products_shelf_fields%','bbox without shelf photo rejected');
select throws_like($$update public.products set sku='A-1' where id='a0000000-0000-4000-8000-000000000004'$$,'%products_shop_sku_key%','duplicate sku in one shop rejected');
select lives_ok($$update public.products set sku='X-1' where id='b0000000-0000-4000-8000-000000000003'$$,'update of a foreign product is silently filtered');
select is((select sku from public.products where id='b0000000-0000-4000-8000-000000000003'),null,'A cannot change B shelf fields');
select lives_ok($$update public.shops set telegram_username='shop_a_tg' where id='a0000000-0000-4000-8000-000000000002'$$,'owner sets Telegram username');
select throws_like($$update public.shops set telegram_username='@bad' where id='a0000000-0000-4000-8000-000000000002'$$,'%shops_telegram_username_format%','invalid Telegram username rejected');
select set_config('request.jwt.claim.sub','c0000000-0000-4000-8000-000000000001',true);
select is((public.import_products('c0000000-0000-4000-8000-000000000002','[{"row":2,"title":"A renamed","price":150,"sku":"A-1"},{"row":3,"title":"New","price":300,"sku":"N-1","in_stock":false},{"row":4,"title":"Bad","price":-5}]'::jsonb)->'skipped'),'[{"row":4,"reason":"invalid"}]'::jsonb,'import reports a broken row without failing');
select is((select title||':'||price||':'||coalesce(category,'-') from public.products where shop_id='c0000000-0000-4000-8000-000000000002' and sku='A-1'),'A renamed:150:-','import creates a product with title, price and sku');
select is((select in_stock from public.products where shop_id='c0000000-0000-4000-8000-000000000002' and sku='N-1'),false,'import creates a new product with its stock flag');
select is((public.import_products('c0000000-0000-4000-8000-000000000002','[{"row":2,"title":"New","price":0,"sku":"N-1"}]'::jsonb)->>'updated')::integer,1,'reimport updates instead of duplicating');
select is((select count(*)::integer||':'||min(price_mode)||':'||bool_and(in_stock = false)::text from public.products where shop_id='c0000000-0000-4000-8000-000000000002' and sku='N-1'),'1:request:true','reimport keeps one row, empty fields do not overwrite');
select throws_like($$select public.import_products('b0000000-0000-4000-8000-000000000002','[{"row":2,"title":"X","price":1}]')$$,'%not owner%','cannot import into another shop');
select set_config('sore.room',(select (15-count(*))::text from public.products where shop_id='c0000000-0000-4000-8000-000000000002'),true);
select is((select count(*)::integer from jsonb_array_elements(public.import_products('c0000000-0000-4000-8000-000000000002',(select jsonb_agg(jsonb_build_object('row',g,'title','L'||g,'price',10)) from generate_series(1,20) g))->'skipped') e where e->>'reason'='limit'),20-current_setting('sore.room')::integer,'rows beyond the free limit are reported, not fatal');
select is((select count(*)::integer from public.products where shop_id='c0000000-0000-4000-8000-000000000002'),15,'import never exceeds the free limit');
reset role;
set local role anon;
select throws_like($$select public.import_products('c0000000-0000-4000-8000-000000000002','[{"row":2,"title":"X","price":1}]')$$,'%permission denied%','anonymous cannot import');
reset role;
-- Таблицы бота (миграция 0019): клиентским ролям закрыты, работает только service_role.
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select throws_like($$select count(*) from public.bot_updates$$,'%permission denied%','anonymous cannot read bot_updates');
select throws_like($$select count(*) from public.bot_drafts$$,'%permission denied%','anonymous cannot read bot_drafts');
select throws_like($$insert into public.bot_updates(update_id) values(1)$$,'%permission denied%','anonymous cannot write bot_updates');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select throws_like($$select count(*) from public.bot_updates$$,'%permission denied%','seller cannot read bot_updates');
select throws_like($$select count(*) from public.bot_drafts$$,'%permission denied%','seller cannot read bot_drafts');
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub','',true);
select lives_ok($$insert into public.bot_updates(update_id) values(900001),(900001) on conflict (update_id) do nothing$$,'service role records a bot update, a repeat is ignored');
select is((select count(*)::integer from public.bot_updates where update_id=900001),1,'repeated update_id is stored once');
select lives_ok($$insert into public.bot_drafts(chat_id,shop_id,payload) values(900001,'b0000000-0000-4000-8000-000000000002','{"items":[]}')$$,'service role stores a shelf draft');
select is((public.import_products('b0000000-0000-4000-8000-000000000002','[{"row":2,"title":"From bot","price":500,"sku":"BOT-1"}]'::jsonb)->>'created')::integer,1,'service role imports a price list without auth.uid()');
reset role;
insert into public.bot_updates(update_id,created_at) values(900002,now()-interval '8 days');
insert into public.bot_drafts(chat_id,shop_id,payload,created_at) values(900002,'b0000000-0000-4000-8000-000000000002','{"items":[]}',now()-interval '25 hours');
select private.purge_old_data();
select is((select string_agg(update_id::text,',' order by update_id) from public.bot_updates where update_id in (900001,900002)),'900001','purge removes bot updates older than 7 days');
select is((select string_agg(chat_id::text,',' order by chat_id) from public.bot_drafts where chat_id in (900001,900002)),'900001','purge removes bot drafts older than 24 hours');

select * from finish();
rollback;
