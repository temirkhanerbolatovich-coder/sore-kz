"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/shop";
import { createAdminClient } from "@/lib/supabase/admin";
import { telegramConfigured } from "@/lib/telegram";
import { getUiLang, tr } from "@/lib/ui-lang";

/** Создаёт одноразовый код привязки и возвращает ссылку на бота: t.me/<бот>?start=<код>. */
export async function startTelegramLink(): Promise<{ url?: string; error?: string }> {
  const lang = await getUiLang();
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  if (!telegramConfigured() || !bot) return { error: tr(lang, "Telegram-бот ещё не настроен.", "Telegram-бот әлі бапталмаған.") };
  const { shop } = await requireShop();
  const code = randomBytes(12).toString("base64url");
  const { error } = await createAdminClient().from("shop_telegram").upsert({ shop_id: shop.id, link_code: code }, { onConflict: "shop_id" });
  if (error) return { error: tr(lang, "Не удалось создать ссылку. Попробуйте ещё раз.", "Сілтеме жасау мүмкін болмады. Қайталап көріңіз.") };
  return { url: `https://t.me/${bot.replace(/^@/, "")}?start=${code}` };
}

export async function unlinkTelegram(): Promise<{ error?: string }> {
  const lang = await getUiLang();
  const { shop } = await requireShop();
  const { error } = await createAdminClient().from("shop_telegram").update({ chat_id: null, linked_at: null, link_code: null }).eq("shop_id", shop.id);
  if (error) return { error: tr(lang, "Не удалось отключить. Попробуйте ещё раз.", "Өшіру мүмкін болмады. Қайталап көріңіз.") };
  revalidatePath("/dashboard/settings");
  return {};
}
