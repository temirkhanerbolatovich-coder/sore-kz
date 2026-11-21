import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
// Порт 3000 часто занят другими сервисами (на этой машине там был чужой Grafana), поэтому E2E живёт на 3100.
const port = process.env.E2E_PORT ?? "3100";
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "tests/e2e", workers: 1, timeout: 90_000,
  use: { baseURL, channel: process.env.PLAYWRIGHT_CHANNEL, viewport: { width: 390, height: 844 }, trace: "retain-on-failure" },
  // reuseExistingServer выключен: иначе тесты молча пойдут в чужой сервер на занятом порту.
  webServer: {
    command: `npm run start -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    // Подставной Telegram (tests/e2e/telegram-mock.ts): боту и мониторингу ошибок настоящий Telegram не нужен.
    env: {
      TELEGRAM_BOT_TOKEN: "e2e-token",
      TELEGRAM_BOT_USERNAME: "sore_e2e_bot",
      TELEGRAM_API_BASE: "http://127.0.0.1:3199",
      TELEGRAM_WEBHOOK_SECRET: "e2e-webhook-secret",
      TELEGRAM_NOTIFY_SECRET: "e2e-notify-secret",
      ADMIN_TELEGRAM_CHAT_ID: "999",
      BOT_LOGIN_SECRET: "e2e-bot-login-secret-0123456789abcdef",
    },
  },
});
