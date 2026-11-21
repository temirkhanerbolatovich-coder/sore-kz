-- Импорт прайса (xlsx/csv) одной транзакцией.
-- Строки уже разобраны и проверены сервером (src/lib/catalog-file.ts); здесь только запись.
-- security invoker: функция работает с правами продавца, RLS и триггер лимита товаров действуют как обычно.
-- Строка с артикулом, который уже есть в магазине, обновляет товар; пустые поля файла не затирают данные продавца.
-- Новая строка, на которую не хватило бесплатного лимита (триггер guard_product_limit), не валит импорт:
-- она попадает в отчёт с причиной 'limit'. Любая другая ошибка строки даёт причину 'invalid'.
create function public.import_products(p_shop uuid, p_rows jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_row jsonb;
  v_line integer;
  v_title text;
  v_price integer;
  v_sku text;
  v_desc text;
  v_desc_kz text;
  v_category text;
  v_in_stock boolean;
  v_id uuid;
  v_sort integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if not public.owns_shop(p_shop) then raise exception 'not owner'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 2000 then
    raise exception 'invalid rows';
  end if;
  -- Второй импорт того же магазина в это время получает понятную ошибку, а не гонку за артикулами.
  if not pg_try_advisory_xact_lock(hashtextextended('sore:import:' || p_shop::text, 0)) then
    raise exception 'import in progress';
  end if;

  select coalesce(max(sort), -1) + 1 into v_sort from public.products where shop_id = p_shop;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := case when jsonb_typeof(v_row->'row') = 'number' then (v_row->>'row')::numeric::integer end;
    begin
      -- Разбор полей внутри блока: битая строка уходит в отчёт, а не обрывает весь импорт.
      v_title := v_row->>'title';
      v_price := (v_row->>'price')::integer;
      v_sku := nullif(btrim(coalesce(v_row->>'sku', '')), '');
      v_desc := nullif(btrim(coalesce(v_row->>'description', '')), '');
      v_desc_kz := nullif(btrim(coalesce(v_row->>'description_kz', '')), '');
      v_category := nullif(btrim(coalesce(v_row->>'category', '')), '');
      v_in_stock := case jsonb_typeof(v_row->'in_stock') when 'boolean' then (v_row->>'in_stock')::boolean end;
      v_id := null;
      if v_sku is not null then
        update public.products p set
          title = v_title,
          price = v_price,
          price_mode = case when v_price = 0 then 'request' when p.price_mode = 'from' then 'from' else 'fixed' end,
          description_ru = coalesce(v_desc, p.description_ru),
          description_kz = coalesce(v_desc_kz, p.description_kz),
          category = coalesce(v_category, p.category),
          in_stock = coalesce(v_in_stock, p.in_stock),
          price_needs_review = false
        where p.shop_id = p_shop and p.sku = v_sku
        returning p.id into v_id;
      end if;

      if v_id is not null then
        v_updated := v_updated + 1;
      else
        insert into public.products (shop_id, title, price, price_mode, description_ru, description_kz, category, in_stock, sku, sort)
        values (p_shop, v_title, v_price, case when v_price = 0 then 'request' else 'fixed' end,
                v_desc, v_desc_kz, v_category, coalesce(v_in_stock, true), v_sku, v_sort);
        v_sort := v_sort + 1;
        v_created := v_created + 1;
      end if;
    exception when others then
      v_skipped := v_skipped || jsonb_build_object(
        'row', v_line,
        'reason', case when sqlerrm = 'free product limit' then 'limit' else 'invalid' end
      );
    end;
  end loop;

  return jsonb_build_object('created', v_created, 'updated', v_updated, 'skipped', v_skipped);
end $$;

revoke all on function public.import_products(uuid, jsonb) from public, anon;
grant execute on function public.import_products(uuid, jsonb) to authenticated;
