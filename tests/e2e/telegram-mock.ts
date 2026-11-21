import http from "node:http";

export type TelegramMessage = { chat_id: number | string; text: string; reply_markup?: { inline_keyboard: { text: string; url?: string; callback_data?: string }[][] } };

/** Подставной Telegram Bot API: записывает все sendMessage, чтобы тесты могли их проверить. */
export function startTelegramMock(port: number) {
  const messages: TelegramMessage[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      if (req.url?.endsWith("/sendMessage")) {
        try {
          messages.push(JSON.parse(body));
        } catch {
          /* игнорируем мусор */
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, result: {} }));
    });
  });
  return new Promise<{ messages: TelegramMessage[]; close: () => Promise<void> }>((resolve) => {
    server.listen(port, "127.0.0.1", () =>
      resolve({ messages, close: () => new Promise<void>((done) => server.close(() => done())) }),
    );
  });
}

export const TELEGRAM_MOCK_PORT = 3199;
export const WEBHOOK_SECRET = "e2e-webhook-secret";
export const NOTIFY_SECRET = "e2e-notify-secret";
export const ADMIN_CHAT = 999;
export const BOT_LOGIN_SECRET = "e2e-bot-login-secret-0123456789abcdef";
