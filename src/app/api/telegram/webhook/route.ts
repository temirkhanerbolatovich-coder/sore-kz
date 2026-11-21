import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { Bot } from "grammy";
import type { Update } from "grammy/types";
import { createSoreBot } from "@/lib/bot/sore-bot";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook бота SÖRE. Проверяет секрет, отбрасывает повторную доставку (bot_updates) и отдаёт апдейт боту
 * (src/lib/bot/sore-bot.ts). Долгая работа (ИИ по фото полки) идёт в after(): Telegram сразу получает 200.
 */
export const maxDuration = 120;

let bot: Bot | null = null;

function getBot(token: string): Bot {
  bot ??= createSoreBot(token, {
    runInBackground: (task) =>
      after(async () => {
        try {
          await task();
        } catch (error) {
          console.error("[bot] Фоновая задача упала:", error instanceof Error ? error.message : error);
        }
      }),
  });
  return bot;
}

/** false: этот update_id уже обрабатывали (Telegram повторил доставку). Сбой базы не блокирует бота. */
async function firstDelivery(updateId: unknown): Promise<boolean> {
  if (typeof updateId !== "number" || !Number.isSafeInteger(updateId)) return true;
  const { data, error } = await createAdminClient()
    .from("bot_updates")
    .upsert({ update_id: updateId }, { onConflict: "update_id", ignoreDuplicates: true })
    .select("update_id");
  if (error) {
    console.error("bot_updates unavailable:", error.message);
    return true;
  }
  return data.length > 0;
}

export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const update = (await request.json().catch(() => null)) as Update | null;
  // Для чужих и непонятных апдейтов отвечаем 200, чтобы Telegram не пересылал их повторно.
  if (!token || !update || typeof update !== "object") return NextResponse.json({ ok: true });
  if (!(await firstDelivery(update.update_id))) return NextResponse.json({ ok: true, duplicate: true });

  try {
    const instance = getBot(token);
    // Без TELEGRAM_BOT_USERNAME данных о боте нет: один раз спрашиваем их у Telegram (getMe).
    if (!instance.isInited()) await instance.init();
    await instance.handleUpdate(update);
  } catch (error) {
    console.error("[bot] handleUpdate failed:", error instanceof Error ? error.message : error);
  }
  return NextResponse.json({ ok: true });
}
