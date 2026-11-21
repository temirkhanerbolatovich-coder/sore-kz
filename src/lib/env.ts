import { z } from "zod";

const setting = z.string().trim().min(1);
const httpUrl = z.url({ protocol: /^https?$/ });
const flag = z.enum(["0", "1"]);
const positiveInteger = z.string().regex(/^[1-9]\d*$/).refine((value) => Number.isSafeInteger(Number(value)));

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: setting,
  NEXT_PUBLIC_SITE_URL: httpUrl.optional(),
  NEXT_PUBLIC_CONTACT_EMAIL: z.email().optional(),
  NEXT_PUBLIC_GOOGLE_LOGIN: flag.optional(),
  NEXT_PUBLIC_EMAIL_CODE: flag.optional(),
  NEXT_PUBLIC_SUPPORT_WHATSAPP: z.string().regex(/^\d{10,15}$/).optional(),
  NEXT_PUBLIC_UMAMI_ID: z.uuid().optional(),
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: setting,
  DEMO_SLUG: setting.optional(),
  CSP_ENFORCE: flag.optional(),
  AI_DAILY_LIMIT: positiveInteger.optional(),
  AI_GLOBAL_DAILY_LIMIT: positiveInteger.optional(),
  AI_PROVIDERS: setting.optional(),
  AI_MODEL: setting.optional(),
  GEMINI_API_KEY: setting.optional(),
  GEMINI_MODELS: setting.optional(),
  OPENROUTER_API_KEY: setting.optional(),
  OPENROUTER_MODELS: setting.optional(),
  ANTHROPIC_API_KEY: setting.optional(),
  TELEGRAM_BOT_TOKEN: setting.optional(),
  TELEGRAM_BOT_USERNAME: setting.optional(),
  TELEGRAM_WEBHOOK_SECRET: setting.optional(),
  TELEGRAM_NOTIFY_SECRET: setting.optional(),
  TELEGRAM_API_BASE: httpUrl.optional(),
  BOT_LOGIN_SECRET: z.string().trim().min(32).optional(),
  CRON_SECRET: z.string().trim().min(16).optional(),
  ADMIN_TELEGRAM_CHAT_ID: z.string().regex(/^-?\d+$/).optional(),
}).superRefine((env, ctx) => {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  for (const name of ["TELEGRAM_WEBHOOK_SECRET", "TELEGRAM_NOTIFY_SECRET"] as const) {
    if (!env[name]) ctx.addIssue({ code: "custom", path: [name], message: "Требуется при заданном TELEGRAM_BOT_TOKEN" });
  }
});

/** Returns only variable names so invalid credentials cannot leak into startup logs. */
export function invalidEnvironmentNames(env: Record<string, string | undefined>): string[] {
  const config = Object.fromEntries(Object.entries(env).map(([name, value]) => [name, value?.trim() || undefined]));
  const results = [publicEnvSchema.safeParse(config), serverEnvSchema.safeParse(config)];
  return [...new Set(results.flatMap((result) => result.success ? [] : result.error.issues.map((issue) => issue.path.join("."))))];
}
