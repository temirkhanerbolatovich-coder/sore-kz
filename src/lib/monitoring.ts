import { sendTelegram } from "@/lib/telegram";

// Защита от лавины одинаковых сообщений в рамках одного экземпляра сервера.
const recent = new Map<string, number>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
let windowStart = 0;
let sentInWindow = 0;

/**
 * Присылает владельцу сервиса сообщение об ошибке в Telegram (ADMIN_TELEGRAM_CHAT_ID).
 * Тихо ничего не делает, если бот или чат не настроены. Одинаковые ошибки повторяются не чаще раза в минуту.
 */
export async function reportError(source: "server" | "client", error: unknown, context = ""): Promise<boolean> {
  const chat = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return false;

  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  const key = `${source}|${context}|${message}`;
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    sentInWindow = 0;
  }
  const last = recent.get(key);
  if ((last && now - last < WINDOW_MS) || sentInWindow >= MAX_PER_WINDOW) return false;
  recent.set(key, now);
  sentInWindow++;
  if (recent.size > 200) recent.clear();

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return sendTelegram(chat, `<b>Ошибка SÖRE</b> (${source})\n${esc(message)}${context ? `\n${esc(context.slice(0, 200))}` : ""}${site ? `\n${esc(site)}` : ""}`);
}
