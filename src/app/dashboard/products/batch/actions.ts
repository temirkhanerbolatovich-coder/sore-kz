"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireShop } from "@/lib/shop";
import { ownedPhotoPath } from "@/lib/photos";
import { invalidateShop } from "@/lib/shop-data";
import { PRO_PRODUCT_LIMIT, productLimit } from "@/lib/types";
import { getUiLang, tr } from "@/lib/ui-lang";

export type BatchState = { error?: string };

const item = z.object({
  photo_url: z.string().min(1),
  title: z.string().trim().min(1, "title-required").max(120),
  description_ru: z.string().trim().max(1000).default(""),
  description_kz: z.string().trim().max(1000).default(""),
  category: z.string().trim().max(60).default(""),
  price_mode: z.enum(["fixed", "request"]),
  price: z.coerce.number().int().min(0).max(100_000_000),
});

/** Сохраняет сразу несколько товаров, собранных на экране «Несколько фото». */
export async function saveBatch(_prev: BatchState, formData: FormData): Promise<BatchState> {
  const lang = await getUiLang();
  const t = (ru: string, kz: string) => tr(lang, ru, kz);
  let items: z.infer<typeof item>[];
  try {
    items = z.array(item).min(1, "no-items").max(PRO_PRODUCT_LIMIT).parse(JSON.parse(String(formData.get("payload") ?? "[]")));
  } catch (e) {
    const message = e instanceof z.ZodError ? e.issues[0]?.message : undefined;
    const known: Record<string, string> = {
      "title-required": t("У каждого товара нужно название", "Әрбір тауардың атауы болуы керек"),
      "no-items": t("Нет товаров для сохранения", "Сақтайтын тауар жоқ"),
    };
    return { error: (message && known[message]) || t("Не удалось прочитать список товаров. Обновите страницу и повторите.", "Тауарлар тізімін оқу мүмкін болмады. Бетті жаңартып, қайталаңыз.") };
  }
  if (items.some((i) => i.price_mode === "fixed" && i.price <= 0)) {
    return { error: t("У товаров с точной ценой укажите цену в тенге или выберите «По запросу».", "Нақты бағалы тауарларға теңгемен баға көрсетіңіз немесе «Сұраныс бойынша» таңдаңыз.") };
  }

  const { supabase, shop, user } = await requireShop();
  if (items.some((i) => !ownedPhotoPath(i.photo_url, user.id))) return { error: t("Одно из фото не загрузилось. Удалите товар из списка и добавьте фото заново.", "Фотолардың бірі жүктелмеді. Тауарды тізімнен жойып, фотоны қайта қосыңыз.") };

  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const have = count ?? 0;
  const limit = productLimit(shop.pro_until);
  if (have + items.length > limit) {
    return { error: t(`В вашем тарифе до ${limit} товаров. Сейчас ${have}, можно добавить ещё ${Math.max(0, limit - have)}.`, `Сіздің тарифте ${limit} тауарға дейін. Қазір ${have}, тағы ${Math.max(0, limit - have)} қосуға болады.`) };
  }

  const rows = items.map((i, idx) => ({
    shop_id: shop.id,
    title: i.title,
    description_ru: i.description_ru || null,
    description_kz: i.description_kz || null,
    category: i.category || null,
    price: i.price_mode === "request" ? 0 : i.price,
    price_mode: i.price_mode,
    photo_url: i.photo_url,
    in_stock: true,
    sort: have + idx,
  }));
  const { error } = await supabase.from("products").insert(rows);
  if (error) return { error: t("Не удалось сохранить товары. Попробуйте ещё раз.", "Тауарларды сақтау мүмкін болмады. Қайталап көріңіз.") };

  invalidateShop(shop.slug);
  revalidatePath("/dashboard");
  redirect(`/dashboard?saved=batch&n=${items.length}`);
}
