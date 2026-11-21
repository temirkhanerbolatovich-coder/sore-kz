"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/shop";
import { normalizePhone } from "@/lib/order";
import { removeUnusedPhoto } from "@/lib/photo-cleanup";
import { ownedPhotoPath } from "@/lib/photos";
import { invalidateShop } from "@/lib/shop-data";
import { normalizeInstagram } from "@/lib/shop-info";
import { normalizeTelegramUsername } from "@/lib/telegram-username";
import { getUiLang, tr } from "@/lib/ui-lang";

export type SettingsState = { error?: string; success?: string };
const schema = z.object({
  name: z.string().trim().min(2).max(60), city: z.string().trim().max(60),
  whatsapp: z.string().transform(normalizePhone).pipe(z.string().regex(/^\d{10,15}$/)),
  avatar_url: z.string().max(2000),
  lead_days: z.coerce.number().int().min(0).max(60),
  about: z.string().trim().max(300).default(""),
  address: z.string().trim().max(120).default(""),
  hours: z.string().trim().max(120).default(""),
  accepting_orders: z.string().optional(),
  booking_mode: z.string().optional(),
  payment_info: z.string().trim().max(300).default(""),
  delivery_info: z.string().trim().max(300).default(""),
  instagram: z.string().trim().max(120).default(""),
  telegram: z.string().trim().max(120).default(""),
});
export async function saveSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const t = async (ru: string, kz: string) => tr(await getUiLang(), ru, kz);
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: await t("Проверьте название (2–60 символов), город, номер WhatsApp и длину текстов «О магазине».", "Атауын (2–60 таңба), қаланы, WhatsApp нөмірін және «Дүкен туралы» мәтіндерінің ұзындығын тексеріңіз.") };
  const { supabase, user, shop } = await requireShop();
  const d = parsed.data;
  const instagram = normalizeInstagram(d.instagram);
  if (d.instagram && !instagram) return { error: await t("Instagram: укажите ник (латиница, цифры, точка, подчёркивание) или ссылку на профиль.", "Instagram: ник (латын әріптері, цифрлар, нүкте, астын сызу) немесе профиль сілтемесін көрсетіңіз.") };
  const telegram = normalizeTelegramUsername(d.telegram);
  if (d.telegram && !telegram) return { error: await t("Telegram: укажите ник (5–32 символа: латиница, цифры, подчёркивание) или ссылку вида t.me/ник.", "Telegram: ник (5–32 таңба: латын әріптері, цифрлар, астын сызу) немесе t.me/ник түріндегі сілтемені көрсетіңіз.") };
  if (d.avatar_url && !ownedPhotoPath(d.avatar_url, user.id)) return { error: await t("Загрузите своё фото магазина.", "Дүкеннің өз фотосын жүктеңіз.") };
  const { telegram: _telegram, ...rest } = d;
  void _telegram;
  const { error } = await supabase.from("shops").update({
    ...rest,
    city: d.city || null,
    avatar_url: d.avatar_url || null,
    about: d.about || null,
    address: d.address || null,
    hours: d.hours || null,
    accepting_orders: d.accepting_orders === "on",
    booking_mode: d.booking_mode === "on",
    payment_info: d.payment_info || null,
    delivery_info: d.delivery_info || null,
    instagram,
    telegram_username: telegram,
  }).eq("id", shop.id);
  if (error) return { error: await t("Не удалось сохранить настройки.", "Баптауларды сақтау мүмкін болмады.") };
  invalidateShop(shop.slug);
  const old = ownedPhotoPath(shop.avatar_url, user.id);
  let warning = "";
  if (old && shop.avatar_url !== d.avatar_url) {
    try { await removeUnusedPhoto(supabase, shop.avatar_url, user.id); }
    catch { warning = await t(" Старое фото не удалось удалить из хранилища.", " Ескі фотоны қоймадан жою мүмкін болмады."); }
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { success: `${await t("Настройки сохранены.", "Баптаулар сақталды.")}${warning}` };
}
