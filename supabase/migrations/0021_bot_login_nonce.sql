-- Вход в кабинет из бота одной кнопкой (docs/BOT_CONTRACT.md, раздел 3; задача #19).
-- Ссылка подписана HMAC и живёт 5 минут, а её nonce гасится здесь при первом открытии:
-- повторное открытие пересланной ссылки отклоняется. Таблица только для сервиса.

create table public.bot_login_nonces (
  nonce text primary key check (char_length(nonce) between 16 and 64),
  created_at timestamptz not null default now()
);
alter table public.bot_login_nonces enable row level security;
revoke all on public.bot_login_nonces from anon, authenticated;

-- Ссылка живёт 5 минут, поэтому погашенные nonce дольше суток хранить незачем.
create or replace function private.purge_old_data() returns void
language plpgsql set search_path = '' as $$
begin
  delete from private.rate_limits where window_start < now() - interval '24 hours';
  delete from public.events where created_at < now() - interval '90 days';
  delete from public.ai_generations where created_at < now() - interval '30 days';
  delete from public.bot_updates where created_at < now() - interval '7 days';
  delete from public.bot_drafts where created_at < now() - interval '24 hours';
  delete from public.bot_login_nonces where created_at < now() - interval '24 hours';
end $$;
revoke all on function private.purge_old_data() from public, anon, authenticated;
