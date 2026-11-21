-- Удаляем только служебные записи, когда истёк срок хранения.
create function private.purge_old_data() returns void
language plpgsql set search_path = '' as $$
begin
  delete from private.rate_limits where window_start < now() - interval '24 hours';
  delete from public.events where created_at < now() - interval '90 days';
  delete from public.ai_generations where created_at < now() - interval '30 days';
end $$;
revoke all on function private.purge_old_data() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
    and current_setting('shared_preload_libraries') ~ '(^|,)[[:space:]]*pg_cron[[:space:]]*(,|$)' then
    create extension if not exists pg_cron;
    perform cron.schedule('dukenai-purge-old-data', '0 21 * * *', 'select private.purge_old_data()');
  end if;
end $$;
