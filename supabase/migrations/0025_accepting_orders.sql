-- Переключатель «Принимаю заказы»: продавец может на время закрыть оформление (отпуск, нет сырья).
-- Витрина остаётся открытой, товары видны, но заказ оформить нельзя; обращения «Узнать цену» и вопросы в WhatsApp работают.
alter table public.shops add column accepting_orders boolean not null default true;

grant update(accepting_orders) on public.shops to authenticated;

-- Сервер не принимает заказ, даже если покупатель обошёл интерфейс и вызвал create_order напрямую.
-- Триггер, а не правка create_order: сама функция не меняется.
create function private.guard_orders_paused() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.shops where id = new.shop_id and not accepting_orders) then
    raise exception 'orders paused';
  end if;
  return new;
end $$;
create trigger orders_paused_guard before insert on public.orders
  for each row execute function private.guard_orders_paused();
