/**
 * Настройка Telegram-бота и уведомлений о заказах.
 *
 *   npm run telegram:setup
 *
 * Нужны переменные окружения (.env.local или Vercel):
 *   TELEGRAM_BOT_TOKEN        токен от @BotFather
 *   TELEGRAM_WEBHOOK_SECRET   любая длинная случайная строка (проверка запросов Telegram)
 *   TELEGRAM_NOTIFY_SECRET    любая длинная случайная строка (проверка запросов от базы)
 *   NEXT_PUBLIC_SITE_URL      публичный адрес сайта (https://…), куда Telegram и база будут слать запросы
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Скрипт: проверяет токен, регистрирует webhook у Telegram (сообщения и нажатия кнопок), ставит меню команд
 * бота SÖRE и сохраняет адрес и секрет уведомлений в базе.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Не задана переменная ${name}`);
  return v;
}

async function main() {
  const token = need("TELEGRAM_BOT_TOKEN");
  const webhookSecret = need("TELEGRAM_WEBHOOK_SECRET");
  const notifySecret = need("TELEGRAM_NOTIFY_SECRET");
  const site = need("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
  if (!site.startsWith("https://")) throw new Error("Telegram принимает webhook только по https. Проверьте NEXT_PUBLIC_SITE_URL.");
  const base = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

  const call = async (method: string, body?: unknown) => {
    const res = await fetch(`${base}/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
    if (!json.ok) throw new Error(`${method}: ${json.description ?? res.status}`);
    return json.result;
  };

  const me = (await call("getMe")) as { username: string };
  console.log(`Бот: @${me.username}`);
  await call("setWebhook", { url: `${site}/api/telegram/webhook`, secret_token: webhookSecret, allowed_updates: ["message", "callback_query"], drop_pending_updates: true });
  console.log(`Webhook: ${site}/api/telegram/webhook`);
  const { BOT_COMMANDS } = await import("@/lib/bot/texts");
  await call("setMyCommands", { commands: BOT_COMMANDS });
  await call("setMyName", { name: "SÖRE" }).catch((e) => console.warn(`Имя бота не обновлено: ${e instanceof Error ? e.message : e}`));
  console.log("Меню команд бота обновлено.");

  const admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { error } = await admin.rpc("set_notify_config", { p_url: `${site}/api/telegram/notify`, p_secret: notifySecret });
  if (error) throw new Error(`Не удалось сохранить настройки уведомлений в базе: ${error.message}`);
  console.log("Уведомления о заказах включены в базе.");
  console.log(`\nОсталось: убедитесь, что в Vercel заданы TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME=${me.username}, TELEGRAM_WEBHOOK_SECRET и TELEGRAM_NOTIFY_SECRET.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
