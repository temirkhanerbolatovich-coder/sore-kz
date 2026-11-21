import { PRO_PRICE_TENGE } from "@/lib/types";
import { whatsappUrl } from "@/lib/order";

/** WhatsApp владельца сервиса: сюда клиенты пишут, чтобы оплатить Pro. Задаётся NEXT_PUBLIC_SUPPORT_WHATSAPP (только цифры, например 77010000000). */
export const supportWhatsapp = () => process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.replace(/\D/g, "") || "";

/** Ссылка «Снять ограничения»: открывает чат с готовым текстом (на русском: его читает владелец). null, если номер не задан. */
export function proRequestUrl(slug: string, renew = false): string | null {
  const phone = supportWhatsapp();
  if (!phone) return null;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const price = new Intl.NumberFormat("ru-RU").format(PRO_PRICE_TENGE).replace(/[\u00a0\u202f]/g, " ");
  const text = `Здравствуйте! Хочу ${renew ? "продлить" : "подключить"} Pro в SÖRE (${price} ₸ в месяц). Мой магазин: ${site}/${slug}`;
  return whatsappUrl(phone, text);
}
