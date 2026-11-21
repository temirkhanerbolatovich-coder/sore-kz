// Ссылка входа в кабинет из чата (задача #19). Хозяина определяет привязка чата, а не слова в чате.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOGIN_TTL_SECONDS, newNonce, signLoginToken } from "@/lib/bot/login-token";
import { findLinkedShop, siteUrl } from "@/lib/bot/shop-link";
import { checkRateLimit, hashedRateKey } from "@/lib/rate-limit";

export const botLoginSecret = () => process.env.BOT_LOGIN_SECRET?.trim() || null;

export type LoginLink =
  | { ok: true; url: string }
  | { ok: false; reason: "disabled" | "not-linked" | "no-email" | "rate-limited" | "unavailable" };

/**
 * Ссылка /auth/bot?t=… на 5 минут для владельца магазина, привязанного к чату.
 * Только для владельцев с почтой: вход ставит сессию через magic link Supabase (вопрос #24 открыт).
 */
export async function createLoginLink(db: SupabaseClient, chatId: number, now = Date.now()): Promise<LoginLink> {
  const secret = botLoginSecret();
  if (!secret) return { ok: false, reason: "disabled" };
  const limit = await checkRateLimit(hashedRateKey("bot-login", String(chatId)), 3600, 10);
  if (limit === 429) return { ok: false, reason: "rate-limited" };
  if (limit !== 200) return { ok: false, reason: "unavailable" };

  const shop = await findLinkedShop(db, chatId);
  if (!shop) return { ok: false, reason: "not-linked" };
  const { data, error } = await db.auth.admin.getUserById(shop.owner_id);
  if (error) return { ok: false, reason: "unavailable" };
  if (!data.user?.email) return { ok: false, reason: "no-email" };

  const token = signLoginToken({ owner: shop.owner_id, exp: Math.floor(now / 1000) + LOGIN_TTL_SECONDS, nonce: newNonce() }, secret);
  return { ok: true, url: `${siteUrl()}/auth/bot?t=${token}` };
}

/** Гасит nonce. false: ссылку уже открывали (или база недоступна — тогда тоже не пускаем). */
export async function consumeNonce(db: SupabaseClient, nonce: string): Promise<boolean> {
  const { error } = await db.from("bot_login_nonces").insert({ nonce });
  return !error;
}
