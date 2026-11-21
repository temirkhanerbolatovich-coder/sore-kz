// Привязка Telegram-чата к магазину. Хозяина определяет только shop_telegram.chat_id (docs/BOT_CONTRACT.md, п. 2.3).
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashedRateKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateShopFromRoute } from "@/lib/shop-data";

export type LinkedShop = { id: string; slug: string; name: string; owner_id: string; pro_until: string | null };

export const admin = (): SupabaseClient => createAdminClient();

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://dukenai.vercel.app").replace(/\/$/, "");
export const storefrontUrl = (slug: string) => `${siteUrl()}/${slug}`;

/** Магазин, к которому привязан чат. Чат без привязки ничего не может сделать от имени магазина. */
export async function findLinkedShop(db: SupabaseClient, chatId: number): Promise<LinkedShop | null> {
  const { data: link } = await db
    .from("shop_telegram")
    .select("shop_id")
    .eq("chat_id", chatId)
    .order("linked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!link) return null;
  const { data: shop } = await db.from("shops").select("id,slug,name,owner_id,pro_until").eq("id", link.shop_id).maybeSingle();
  return (shop as LinkedShop | null) ?? null;
}

/** /start КОД: одноразовый код из кабинета меняется на chat_id. Возвращает название магазина или null. */
export async function linkByCode(db: SupabaseClient, chatId: number, code: string): Promise<string | null> {
  const { data: row } = await db.from("shop_telegram").select("shop_id").eq("link_code", code).maybeSingle();
  if (!row) return null;
  await db.from("shop_telegram").update({ chat_id: chatId, linked_at: new Date().toISOString(), link_code: null }).eq("shop_id", row.shop_id);
  const { data: shop } = await db.from("shops").select("name").eq("id", row.shop_id).maybeSingle();
  return shop?.name ?? "";
}

export async function unlinkChat(db: SupabaseClient, chatId: number): Promise<void> {
  await db.from("shop_telegram").update({ chat_id: null, linked_at: null }).eq("chat_id", chatId);
}

/** Ключ лимита по чату: в базе только хэш, не сам chat_id. */
export const chatRateKey = (chatId: number) => hashedRateKey("bot", String(chatId));

/** Сброс кэша витрины. Вне Next.js (локальный polling) кэша нет, ошибку глотаем. */
export function refreshStorefront(slug: string) {
  try {
    invalidateShopFromRoute(slug);
  } catch {
    // npm run bot: витрина в dev-режиме кэш не держит
  }
}
