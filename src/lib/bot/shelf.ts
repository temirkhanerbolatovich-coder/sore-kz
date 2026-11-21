// «Фото полки» из бота: та же цепочка, что в веб-кабинете (src/app/api/ai/shelf/route.ts + shelf/actions.ts),
// но черновики живут в таблице bot_drafts, а выбор товаров идёт кнопками в чате.
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { aiConfigured } from "@/lib/ai-providers";
import { reserveAi, shopCategories } from "@/lib/ai-request";
import { generateShelf, ShelfEmptyError } from "@/lib/ai-shelf";
import { asDraftPayload, draftToProduct, type DraftItem, type DraftPayload } from "@/lib/bot/drafts";
import { productLimit } from "@/lib/types";
import { findLinkedShop, refreshStorefront, type LinkedShop } from "@/lib/bot/shop-link";
import { ownedPhotoPath, THUMB_QUALITY, THUMB_WIDTH, thumbPath } from "@/lib/photos";
import { removeUnusedPhoto } from "@/lib/photo-cleanup";
import { cropShelfPhoto } from "@/lib/shelf-crops";

/** Снимок полки хранится так же, как после сжатия в браузере: до 1200 px по большей стороне. */
const SHELF_MAX_SIDE = 1200;
const UPLOAD = { contentType: "image/jpeg", cacheControl: "31536000" };

export type Failure = { ok: false; message: string };
const fail = (message: string): Failure => ({ ok: false, message });

/** Загружает JPEG и его миниатюру в папку владельца. Путь строится только из owner_id магазина. */
async function uploadPair(db: SupabaseClient, owner: string, full: Buffer, thumb: Buffer): Promise<string | null> {
  const bucket = db.storage.from("product-photos");
  const path = `${owner}/${randomUUID()}.jpg`;
  const small = thumbPath(path);
  if ((await bucket.upload(path, full, UPLOAD)).error) return null;
  if ((await bucket.upload(small, thumb, UPLOAD)).error) {
    await bucket.remove([path, small]).catch(() => undefined);
    return null;
  }
  return bucket.getPublicUrl(path).data.publicUrl;
}

async function removeFiles(db: SupabaseClient, owner: string, urls: (string | null | undefined)[]) {
  for (const url of new Set(urls)) {
    if (url && ownedPhotoPath(url, owner)) await removeUnusedPhoto(db, url, owner).catch(() => undefined);
  }
}

/**
 * Фото из чата → снимок в Storage → ИИ → вырезки → черновик в bot_drafts.
 * onStep(n) двигает сообщение прогресса. Квота ИИ резервируется до вызова провайдера и возвращается при сбое.
 */
export async function createShelfDraft(
  db: SupabaseClient,
  shop: LinkedShop,
  chatId: number,
  photo: Buffer,
  onStep: (step: number) => Promise<void>,
): Promise<{ ok: true; draftId: string; items: DraftItem[]; remaining: number } | Failure> {
  if (!aiConfigured()) return fail("ИИ пока не настроен. Добавьте товары в кабинете вручную или пришлите прайс.");

  let full: Buffer;
  let thumb: Buffer;
  try {
    full = await sharp(photo, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(SHELF_MAX_SIDE, SHELF_MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    thumb = await sharp(full).resize(THUMB_WIDTH).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toBuffer();
  } catch {
    return fail("Не получилось открыть картинку. Пришлите обычное фото (JPG или PNG).");
  }

  const source = await uploadPair(db, shop.owner_id, full, thumb);
  if (!source) return fail("Не удалось сохранить фото. Попробуйте ещё раз через минуту.");

  const quota = await reserveAi(db, shop.id, "добавьте товары в кабинете вручную");
  if (!quota.ok) {
    await removeFiles(db, shop.owner_id, [source]);
    return fail(quota.error);
  }

  await onStep(1);
  let found: Awaited<ReturnType<typeof generateShelf>>;
  try {
    found = await generateShelf({ base64: full.toString("base64"), mime: "image/jpeg", categories: await shopCategories(db, shop.id) });
    console.info("bot ai-shelf ok", found.provider, found.items.length);
  } catch (e) {
    await quota.release();
    await removeFiles(db, shop.owner_id, [source]);
    if (e instanceof ShelfEmptyError) {
      return fail("🤔 На фото не нашёл товаров. Снимите полку ближе, при хорошем свете, чтобы товары были видны целиком.");
    }
    console.error("bot ai-shelf failed:", e instanceof Error ? e.message : e);
    return fail("😔 ИИ не смог разобрать фото. Попробуйте ещё раз или добавьте товары в кабинете.");
  }

  await onStep(2);
  const crops = await cropShelfPhoto(full, found.items.map((i) => i.bbox)).catch(() => found.items.map(() => null));
  const photoUrls = await Promise.all(crops.map((crop) => (crop ? uploadPair(db, shop.owner_id, crop.full, crop.thumb) : null)));

  await onStep(3);
  const items: DraftItem[] = found.items.map((item, i) => ({ ...item, photo_url: photoUrls[i], selected: true }));
  const payload: DraftPayload = { source_photo_url: source, items };
  const { data, error } = await db.from("bot_drafts").insert({ chat_id: chatId, shop_id: shop.id, payload }).select("id").single();
  if (error || !data) {
    await removeFiles(db, shop.owner_id, [source, ...photoUrls]);
    return fail("Не удалось сохранить черновики. Пришлите фото ещё раз.");
  }
  return { ok: true, draftId: data.id as string, items, remaining: quota.remaining };
}

type DraftRow = { id: string; shop_id: string; payload: DraftPayload };

/** Черновик этого чата. Чужой chat_id черновик не найдёт: проверка владельца. */
async function loadDraft(db: SupabaseClient, draftId: string, chatId: number): Promise<DraftRow | null> {
  const { data } = await db.from("bot_drafts").select("id,shop_id,payload").eq("id", draftId).eq("chat_id", chatId).maybeSingle();
  const payload = asDraftPayload(data?.payload);
  return data && payload ? { id: data.id as string, shop_id: data.shop_id as string, payload } : null;
}

export async function toggleDraftItem(db: SupabaseClient, draftId: string, chatId: number, index: number): Promise<DraftItem[] | null> {
  const draft = await loadDraft(db, draftId, chatId);
  const item = draft?.payload.items[index];
  if (!draft || !item) return null;
  item.selected = !item.selected;
  const { error } = await db.from("bot_drafts").update({ payload: draft.payload }).eq("id", draftId);
  return error ? null : draft.payload.items;
}

/** Публикует выбранные товары одной вставкой. Лимит тарифа дополнительно держит триггер в базе. */
export async function publishDraft(
  db: SupabaseClient,
  draftId: string,
  chatId: number,
): Promise<{ ok: true; count: number; shop: LinkedShop } | Failure> {
  const draft = await loadDraft(db, draftId, chatId);
  if (!draft) return fail("Черновик устарел или уже опубликован. Пришлите фото ещё раз.");
  const shop = await findLinkedShop(db, chatId);
  if (!shop || shop.id !== draft.shop_id) return fail("Этот чат больше не подключён к магазину.");

  const selected = draft.payload.items.filter((i) => i.selected);
  if (selected.length === 0) return fail("Отметьте хотя бы один товар.");
  const source = draft.payload.source_photo_url;
  if (!ownedPhotoPath(source, shop.owner_id) || selected.some((i) => i.photo_url !== null && !ownedPhotoPath(i.photo_url, shop.owner_id))) {
    return fail("Фото не найдено в хранилище магазина. Пришлите фото полки заново.");
  }

  const { count } = await db.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const have = count ?? 0;
  const limit = productLimit(shop.pro_until);
  const room = Math.max(0, limit - have);
  if (selected.length > room) {
    return fail(`В вашем тарифе до ${limit} товаров. Сейчас ${have}, можно добавить ещё ${room}: снимите лишние отметки.`);
  }

  const rows = selected.map((item, idx) => draftToProduct(item, shop.id, source, have + idx));
  const { error } = await db.from("products").insert(rows);
  if (error) {
    return fail(
      error.message.includes("free product limit")
        ? `В вашем тарифе до ${limit} товаров. Снимите лишние отметки.`
        : "Не удалось сохранить товары. Попробуйте ещё раз.",
    );
  }

  await db.from("bot_drafts").delete().eq("id", draftId);
  refreshStorefront(shop.slug);
  // Невыбранные вырезки не стали товарами: убираем из хранилища.
  await removeFiles(db, shop.owner_id, draft.payload.items.filter((i) => !i.selected).map((i) => i.photo_url));
  return { ok: true, count: rows.length, shop };
}

/** «Отмена»: снимок и вырезки ещё не стали товарами, удаляем их вместе с черновиком. */
export async function discardDraft(db: SupabaseClient, draftId: string, chatId: number): Promise<boolean> {
  const draft = await loadDraft(db, draftId, chatId);
  if (!draft) return false;
  await db.from("bot_drafts").delete().eq("id", draftId);
  const { data: shop } = await db.from("shops").select("owner_id").eq("id", draft.shop_id).maybeSingle();
  if (shop) await removeFiles(db, shop.owner_id as string, [draft.payload.source_photo_url, ...draft.payload.items.map((i) => i.photo_url)]);
  return true;
}
