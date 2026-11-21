import { expect, test } from "vitest";
import { invalidEnvironmentNames, publicEnvSchema, serverEnvSchema } from "@/lib/env";

const required = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "your-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-value",
};

test("минимальная конфигурация принимает локальный Supabase и пустые необязательные настройки", () => {
  expect(invalidEnvironmentNames({ ...required, GEMINI_API_KEY: "", CSP_ENFORCE: "" })).toEqual([]);
  expect(publicEnvSchema.parse(required)).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
  expect(serverEnvSchema.parse(required)).not.toHaveProperty("NEXT_PUBLIC_SUPABASE_ANON_KEY");
});

test("проверка сообщает об обязательных переменных и неверных значениях по имени", () => {
  expect(invalidEnvironmentNames({
    NEXT_PUBLIC_SUPABASE_URL: "ftp://localhost",
    AI_DAILY_LIMIT: "-1",
    CSP_ENFORCE: "invalid-value",
    NEXT_PUBLIC_GOOGLE_LOGIN: "2",
  })).toEqual([
    "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_GOOGLE_LOGIN",
    "SUPABASE_SERVICE_ROLE_KEY", "CSP_ENFORCE", "AI_DAILY_LIMIT",
  ]);
});

test("без токена Telegram выключен, с токеном требуются оба секрета", () => {
  const enabled = { ...required, TELEGRAM_BOT_TOKEN: "test-token" };
  expect(invalidEnvironmentNames(enabled)).toEqual(["TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_NOTIFY_SECRET"]);
  expect(invalidEnvironmentNames({
    ...enabled, TELEGRAM_WEBHOOK_SECRET: "test-webhook", TELEGRAM_NOTIFY_SECRET: "test-notify",
  })).toEqual([]);
});
