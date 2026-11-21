-- API clients cannot choose the server-owned order counter during shop creation.
revoke insert on public.shops from authenticated;
grant insert(owner_id,name,slug,whatsapp,city,avatar_url) on public.shops to authenticated;
alter table public.shops add constraint shops_city_length check (char_length(city)<=60) not valid;
alter table public.products add constraint products_text_lengths check (
  char_length(description_ru)<=1000 and char_length(description_kz)<=1000 and char_length(category)<=60
) not valid;
alter table public.orders add constraint orders_details_length check (
  char_length(customer_name) between 1 and 80 and customer_phone ~ '^[0-9]{10,15}$'
  and char_length(address)<=200 and char_length(comment)<=300
) not valid;
-- NOT VALID keeps existing installations migratable; new/updated rows are checked.
