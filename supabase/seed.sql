-- Демо-магазин для питча: sore.kz/demo (открывается по кнопке «Посмотреть демо»).
--
-- Перед запуском:
--   1. В Supabase → Authentication → Users → Add user создайте отдельный аккаунт
--      (например demo@sore.kz). Не используйте свой рабочий: у аккаунта один магазин.
--   2. Впишите его email ниже и выполните скрипт в SQL Editor.
--   3. Номер WhatsApp ниже замените на тот, где хотите получать тестовые заказы на питче.
-- Скрипт можно запускать повторно: товары демо-магазина пересоздаются.

do $$
declare
  v_email    text := 'demo@sore.kz';      -- email демо-аккаунта
  v_whatsapp text := '77010000000';        -- ваш номер для тестового заказа
  v_owner uuid;
  v_shop  uuid;
begin
  select id into v_owner from auth.users where email = v_email;
  if v_owner is null then
    raise exception 'Пользователь % не найден. Создайте его в Authentication → Users.', v_email;
  end if;

  insert into public.shops (owner_id, name, slug, whatsapp, city)
  values (v_owner, 'Сладкий дом Алии', 'demo', v_whatsapp, 'Алматы')
  on conflict (slug) do update
    set name = excluded.name, whatsapp = excluded.whatsapp, city = excluded.city, owner_id = excluded.owner_id
  returning id into v_shop;

  delete from public.products where shop_id = v_shop;

  insert into public.products
    (shop_id, title, description_ru, description_kz, category, price, photo_url, in_stock, sort)
  values
    (v_shop, 'Торт «Прага» 1 кг',
      'Шоколадный бисквит с нежным кремом и глянцевой глазурью. Хорошо подходит для дня рождения.',
      'Нәзік кремі бар шоколадты бисквит және жылтыр глазурь. Туған күнге жарасады.',
      'Торты', 12000, '/demo/prague.svg', true, 0),
    (v_shop, 'Капкейки, набор 6 шт',
      'Шесть капкейков с разными кремовыми шапочками. Удобно взять к чаю.',
      'Әртүрлі кремді алты капкейк. Шайға ыңғайлы.',
      'Десерты', 4500, '/demo/cupcakes.svg', true, 1),
    (v_shop, 'Макаронс, 12 шт',
      'Набор разноцветных миндальных пирожных с нежной начинкой.',
      'Нәзік қосындысы бар түрлі-түсті бадам пирожныйлары.',
      'Десерты', 6800, '/demo/macarons.svg', true, 2),
    (v_shop, 'Чизкейк «Нью-Йорк»',
      'Классический плотный чизкейк с ягодой на песочной основе.',
      'Құмды негіздегі жидегі бар классикалық тығыз чизкейк.',
      'Торты', 9500, '/demo/cheesecake.svg', false, 3),
    (v_shop, 'Эклеры, 8 шт',
      'Заварные пирожные с кремом и глазурью разных вкусов.',
      'Әртүрлі дәмдегі кремі мен глазурі бар заварной пирожныйлар.',
      'Десерты', 5200, '/demo/eclairs.svg', true, 4),
    (v_shop, 'Медовик 1,2 кг',
      'Тонкие медовые коржи, пропитанные сметанным кремом.',
      'Қаймақ кремімен сіңдірілген жұқа балды қабаттар.',
      'Торты', 10500, '/demo/medovik.svg', true, 5),
    (v_shop, 'Подарочный набор сладостей',
      'Коробка с ассорти из наших десертов. Подпишем открытку по вашему тексту.',
      'Десерттеріміздің ассортиі бар қорап. Ашық хатты сіздің мәтініңізбен жазамыз.',
      'Наборы', 14500, '/demo/box.svg', true, 6),
    (v_shop, 'Тирамису 6 порций',
      'Порционный десерт с кремом маскарпоне и какао.',
      'Маскарпоне кремі мен какаосы бар порциялық десерт.',
      'Десерты', 7800, '/demo/tiramisu.svg', true, 7);
end $$;
