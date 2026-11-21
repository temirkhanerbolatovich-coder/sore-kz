-- Сначала резервируем общий лимит, потом вызываем платный провайдер.
create index ai_generations_created_at_idx on public.ai_generations(created_at);

drop function public.reserve_ai(uuid, integer);
create function public.reserve_ai(p_shop uuid, p_limit integer, p_global_limit bigint default 300)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_now timestamptz;
begin
  if p_limit is null or p_limit not between 1 and 1000 or p_global_limit is null or p_global_limit <= 0 then
    raise exception 'invalid limit';
  end if;

  perform 1 from public.shops where id = p_shop for update;
  if not found then raise exception 'shop unavailable'; end if;

  -- Все серверы делят один потолок. Проверка и вставка проходят под одной блокировкой.
  perform pg_advisory_xact_lock(hashtextextended('dukenai:ai-quota', 0));
  v_now := clock_timestamp();
  if (select count(*) from public.ai_generations where created_at >= v_now - interval '24 hours') >= p_global_limit then
    raise exception 'ai global limit exceeded';
  end if;
  if (select count(*) from public.ai_generations where shop_id = p_shop and created_at >= v_now - interval '24 hours') >= p_limit then
    raise exception 'ai limit exceeded';
  end if;

  insert into public.ai_generations(shop_id, created_at) values (p_shop, v_now) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_ai(uuid, integer, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai(uuid, integer, bigint) to service_role;
