/**
 * Бот SÖRE локально, без публичного адреса (long polling):
 *
 *   npm run bot
 *
 * Нужны TELEGRAM_BOT_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY и ключ ИИ в .env.local.
 * Внимание: polling снимает webhook у этого токена. Для боевого бота используйте отдельный тестовый токен
 * от @BotFather, а после проверки верните webhook командой npm run telegram:setup.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не задан. Впишите токен от @BotFather в .env.local.");
  const { GrammyError } = await import("grammy");
  const { createSoreBot } = await import("@/lib/bot/sore-bot");
  const { BOT_COMMANDS } = await import("@/lib/bot/texts");

  const bot = createSoreBot(token);
  const stop = () => void bot.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    await bot.api.setMyCommands(BOT_COMMANDS);
    await bot.start({
      allowed_updates: ["message", "callback_query"],
      onStart: (me) => console.log(`✅ SÖRE @${me.username} запущен (long polling). Остановить: Ctrl+C`),
    });
  } catch (error) {
    if (error instanceof GrammyError && error.error_code === 401) throw new Error("Telegram не принял токен (401). Проверьте TELEGRAM_BOT_TOKEN.");
    if (error instanceof GrammyError && error.error_code === 409) throw new Error("409: этот токен уже опрашивает другой процесс. Остановите его.");
    throw error;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
