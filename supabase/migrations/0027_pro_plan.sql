-- Платный тариф Pro (2 500 ₸/мес), пока вручную: клиент платит владельцу сервиса, владелец ставит срок командой `npm run plan`.
-- Столбец не входит в grant update/insert для authenticated, поэтому продавец сам его менять не может.
alter table public.shops add column pro_until timestamptz;

-- Лимит товаров магазина: 15 на Free, 500 пока действует Pro.
create function private.shop_product_limit(p_shop uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when pro_until is not null and pro_until > now() then 500 else 15 end
  from public.shops where id = p_shop
$$;
revoke all on function private.shop_product_limit(uuid) from public;

create or replace function public.guard_product_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.shop_id=old.shop_id then return new; end if;
  perform 1 from public.shops where id=new.shop_id for update;
  if (select count(*) from public.products where shop_id=new.shop_id) >= private.shop_product_limit(new.shop_id) then
    raise exception 'free product limit';
  end if;
  return new;
end $$;
