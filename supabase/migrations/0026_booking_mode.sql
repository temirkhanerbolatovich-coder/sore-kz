-- Режим «запись» для салонов, барбершопов и мастеров: витрина показывает услуги, покупатель оставляет заявку на дату и время,
-- а подтверждает её продавец в WhatsApp. Слотов и расписания нет; заявка проходит через те же заказы (create_order).
alter table public.shops add column booking_mode boolean not null default false;

grant update(booking_mode) on public.shops to authenticated;
