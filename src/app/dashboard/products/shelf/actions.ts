"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireShop } from "@/lib/shop";
import { ownedPhotoPath } from "@/lib/photos";
import { removeUnusedPhoto } from "@/lib/photo-cleanup";
import { invalidateShop } from "@/lib/shop-data";
import { MAX_SHELF_ITEMS } from "@/lib/ai-shelf";
import { productLimit } from "@/lib/types";
import { getUiLang, tr } from "@/lib/ui-lang";

export type ShelfState = { error?: string };

const unit = z.number().min(0).max(1);
const bbox = z
  .object({ x1: unit, y1: unit, x2: unit, y2: unit })
  .strict()
  .refine((b) => b.x1 < b.x2 && b.y1 < b.y2, "bad-box");

const item = z.object({
  photo_url: z.string().min(1).nullable(),
  title: z.string().trim().min(1, "title-required").max(120),
  description_ru: z.string().trim().max(1000).default(""),
  description_kz: z.string().trim().max(1000).default(""),
  category: z.string().trim().max(60).default(""),
  price_mode: z.enum(["fixed", "request"]),
  price: z.coerce.number().int().min(0).max(100_000_000),
  bbox,
  price_needs_review: z.boolean().default(false),
});

const payload = z.object({
  source_photo_url: z.string().min(1),
  items: z.array(item).min(1, "pick-one").max(MAX_SHELF_ITEMS),
  discard: z.array(z.string()).max(MAX_SHELF_ITEMS).default([]),
});

/** Удаляет вырезки и снимок полки, которые не стали товарами. Ошибки уборки не мешают продавцу. */
async function discardFiles(urls: string[]) {
  const { supabase, user } = await requireShop();
  for (const url of new Set(urls)) {
    if (!ownedPhotoPath(url, user.id)) continue;
    await removeUnusedPhoto(supabase, url, user.id).catch(() => undefined);
  }
}

/** Публикует выбранные черновики с фото полки одной вставкой. Лимит тарифа дополнительно держит триггер в БД. */
export async function saveShelf(_prev: ShelfState, formData: FormData): Promise<ShelfState> {
  const lang = await getUiLang();
  const t = (ru: string, kz: string) => tr(lang, ru, kz);
  let data: z.infer<typeof payload>;
  try {
    data = payload.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    const known: Record<string, string> = {
      "bad-box": t("Неверная рамка товара", "Тауар жақтауы дұрыс емес"),
      "title-required": t("У каждого выбранного товара нужно название", "Әрбір таңдалған тауардың атауы болуы керек"),
      "pick-one": t("Выберите хотя бы один товар", "Кемінде бір тауарды таңдаңыз"),
    };
    return { error: (message && known[message]) || t("Не удалось прочитать список товаров. Обновите страницу и повторите.", "Тауарлар тізімін оқу мүмкін болмады. Бетті жаңартып, қайталаңыз.") };
  }
  if (data.items.some((i) => i.price_mode === "fixed" && i.price <= 0)) {
    return { error: t("У товаров с точной ценой укажите цену в тенге или выберите «По запросу».", "Нақты бағалы тауарларға теңгемен баға көрсетіңіз немесе «Сұраныс бойынша» таңдаңыз.") };
  }

  const { supabase, shop, user } = await requireShop();
  const source = data.source_photo_url;
  if (!ownedPhotoPath(source, user.id) || data.items.some((i) => i.photo_url !== null && !ownedPhotoPath(i.photo_url, user.id))) {
    return { error: t("Фото не найдено в вашем хранилище. Загрузите фото полки заново.", "Фото сіздің қоймаңыздан табылмады. Сөре фотосын қайта жүктеңіз.") };
  }

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const have = count ?? 0;
  const limit = productLimit(shop.pro_until);
  const room = Math.max(0, limit - have);
  if (data.items.length > room) {
    return { error: t(`В вашем тарифе до ${limit} товаров. Сейчас ${have}, можно добавить ещё ${room}: снимите лишние галочки.`, `Сіздің тарифте ${limit} тауарға дейін. Қазір ${have}, тағы ${room} қосуға болады: артық белгілерді алып тастаңыз.`) };
  }

  const rows = data.items.map((i, idx) => ({
    shop_id: shop.id,
    title: i.title,
    description_ru: i.description_ru || null,
    description_kz: i.description_kz || null,
    category: i.category || null,
    price: i.price_mode === "request" ? 0 : i.price,
    price_mode: i.price_mode,
    // Нет своей вырезки — товар покажет весь снимок полки.
    photo_url: i.photo_url ?? source,
    source_photo_url: source,
    bbox: i.bbox,
    price_needs_review: i.price_mode === "fixed" && i.price_needs_review,
    in_stock: true,
    sort: have + idx,
  }));
  const { error } = await supabase.from("products").insert(rows);
  if (error) {
    return {
      error: error.message.includes("free product limit")
        ? t(`В вашем тарифе до ${limit} товаров. Обновите страницу: кто-то уже добавил товары.`, `Сіздің тарифте ${limit} тауарға дейін. Бетті жаңартыңыз: біреу тауар қосып қойған.`)
        : t("Не удалось сохранить товары. Попробуйте ещё раз.", "Тауарларды сақтау мүмкін болмады. Қайталап көріңіз."),
    };
  }

  invalidateShop(shop.slug);
  revalidatePath("/dashboard");
  await discardFiles(data.discard);
  redirect(`/dashboard?saved=batch&n=${rows.length}`);
}

/** «Отмена» на экране полки: снимок и вырезки ещё не стали товарами — убираем их из хранилища. */
export async function discardShelf(urls: string[]): Promise<void> {
  if (!Array.isArray(urls)) return;
  await discardFiles(urls.filter((u): u is string => typeof u === "string").slice(0, MAX_SHELF_ITEMS + 1));
}
