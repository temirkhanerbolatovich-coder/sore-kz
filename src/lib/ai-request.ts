import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownedPhotoPath, MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/lib/photos";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendTelegram } from "@/lib/telegram";
import { PRO_AI_DAILY_LIMIT, isPro } from "@/lib/types";
import type { Lang } from "@/lib/lang";

/**
 * Общее для ИИ-маршрутов (карточка по фото и фото полки): проверка фото продавца, квоты и уборка попытки.
 * Квота расходуется один раз на запрос, даже если на фото полки окажется 12 товаров.
 */

export type Failure = { ok: false; status: number; error: string };

const fail = (status: number, error: string): Failure => ({ ok: false, status, error });

export function aiLimits() {
  const configuredLimit = Number(process.env.AI_DAILY_LIMIT ?? 20);
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 && configuredLimit <= 1000 ? configuredLimit : 20;
  const globalSetting = process.env.AI_GLOBAL_DAILY_LIMIT?.trim() ?? "";
  const configuredGlobalLimit = Number(globalSetting);
  const globalLimit = /^[1-9]\d*$/.test(globalSetting) && Number.isSafeInteger(configuredGlobalLimit) ? configuredGlobalLimit : 300;
  return { limit, globalLimit };
}

async function notifyGlobalLimit(limit: number) {
  const chat = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!chat || !process.env.TELEGRAM_BOT_TOKEN) return;
  if (await checkRateLimit("ai-global-limit:alert", 86_400, 1) !== 200) return;
  const sent = await sendTelegram(chat, `SÖRE: исчерпан общий лимит ИИ за 24 часа (${limit}).`);
  if (!sent) console.error("AI quota alert delivery failed.");
}

/** Скачивает фото продавца из его папки в Storage и проверяет тип и размер. */
export async function loadOwnedPhoto(
  supabase: SupabaseClient,
  owner: string,
  photoUrl: unknown,
  message: string,
  lang: Lang = "ru",
): Promise<{ ok: true; photo: Blob } | Failure> {
  const photoPath = ownedPhotoPath(photoUrl, owner);
  if (!photoPath) return fail(400, message);
  const { data: photo, error } = await supabase.storage.from("product-photos").download(photoPath);
  if (error || !photo || photo.size > MAX_PHOTO_BYTES || !PHOTO_TYPES.includes(photo.type)) {
    return fail(400, lang === "kz" ? "5 МБ-қа дейінгі JPEG, PNG немесе WebP форматындағы өз жүктеген фотоңызды таңдаңыз." : "Выберите JPEG, PNG или WebP до 5 МБ из своих загруженных фото.");
  }
  return { ok: true, photo };
}

/**
 * Под одной блокировкой БД проверяет личную и общую квоты и резервирует попытку до обращения к провайдеру.
 * manual: что предложить продавцу вместо ИИ («заполните карточку вручную»).
 */
export async function reserveAi(
  supabase: SupabaseClient,
  shopId: string,
  manual: string,
  lang: Lang = "ru",
): Promise<{ ok: true; reserved: string; remaining: number; release: () => Promise<void> } | Failure> {
  const { limit: freeLimit, globalLimit } = aiLimits();
  // Pro даёт повышенную личную квоту; общий потолок сервиса остаётся прежним. Срок Pro публичен, как и вся строка магазина.
  const { data: plan } = await supabase.from("shops").select("pro_until").eq("id", shopId).maybeSingle();
  const limit = isPro(plan?.pro_until) ? Math.max(freeLimit, PRO_AI_DAILY_LIMIT) : freeLimit;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // Число генераций магазина используется для подсказки об оставшейся квоте.
  const { count } = await supabase
    .from("ai_generations")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId)
    .gte("created_at", since);
  const admin = createAdminClient();
  const { data: reserved, error } = await admin.rpc("reserve_ai", { p_shop: shopId, p_limit: limit, p_global_limit: globalLimit });
  if (error?.message === "ai global limit exceeded") {
    await notifyGlobalLimit(globalLimit);
    return fail(503, lang === "kz" ? `ЖИ бүгін шамадан тыс жүктелген, ${manual}.` : `ИИ сегодня перегружен, ${manual}.`);
  }
  if (error?.message === "ai limit exceeded") {
    const sentence = `${manual[0].toUpperCase()}${manual.slice(1)}`;
    return fail(429, lang === "kz" ? `Бүгінгі ЖИ шегі таусылды (${limit}). ${sentence} немесе ертең қайталап көріңіз.` : `Лимит ИИ на сегодня исчерпан (${limit}). ${sentence} или попробуйте завтра.`);
  }
  if (error || !reserved) return fail(500, lang === "kz" ? "ЖИ-ді іске қосу мүмкін болмады: сервис қолжетімсіз." : "Не удалось запустить ИИ: сервис недоступен.");
  return {
    ok: true,
    reserved,
    remaining: Math.max(0, limit - (count ?? 0) - 1),
    // Неудачная попытка не должна съедать лимит продавца.
    release: async () => {
      await admin.from("ai_generations").delete().eq("id", reserved);
    },
  };
}

/** Категории, уже заведённые в магазине: ИИ выбирает из них, чтобы товары не расползались по похожим названиям. */
export async function shopCategories(supabase: SupabaseClient, shopId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from("products").select("category").eq("shop_id", shopId);
    return [...new Set((data ?? []).map((p: { category: string | null }) => p.category).filter((c): c is string => Boolean(c)))];
  } catch {
    return []; // категории необязательны
  }
}
