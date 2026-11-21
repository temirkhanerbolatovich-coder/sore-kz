export type CartLine = { id: string; title: string; price: number; qty: number; variantId?: string | null };

export type OrderInput = {
  number?: number | string;
  lines: CartLine[];
  name: string;
  delivery: "delivery" | "pickup";
  address?: string;
  comment?: string;
  neededDate?: string | null;
  neededTime?: string | null;
  /** Ссылка покупателя на статус заказа (остаётся у него в переписке с продавцом). */
  statusUrl?: string;
  /** Режим записи: услуги без количества и доставки, время «желаемое». */
  booking?: boolean;
};

const nf = new Intl.NumberFormat("ru-RU");

/** 12000 → «12 000 ₸» (пробел внутри числа — неразрывный, меняем на обычный) */
export function formatPrice(value: number): string {
  return `${nf.format(value).replace(/[  ]/g, " ")} ₸`;
}

export function orderTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

/** Только цифры, международный формат: «+7 701 123-45-67» → «77011234567» */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
  return digits;
}

/** Показывает казахстанский номер как +7 701 123 45 67; чужие форматы не трогает. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits || (digits[0] !== "7" && digits[0] !== "8")) return raw;
  const rest = digits.slice(1, 11);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return ["+7", ...parts].join(" ");
}

function buildBookingText(o: OrderInput): string {
  const parts = [
    `Здравствуйте! Хочу записаться${o.number ? ` (SÖRE №${o.number})` : ""}`,
    "",
    ...o.lines.map((l, i) => `${i + 1}. ${l.title} — ${formatPrice(l.price)}`),
    "",
    `Имя: ${o.name}`,
  ];
  if (o.neededDate) parts.push(`Желаемое время: ${formatNeeded(o.neededDate, o.neededTime)}`);
  if (o.comment) parts.push(`Комментарий: ${o.comment}`);
  if (o.statusUrl) parts.push("", `Статус заявки: ${o.statusUrl}`);
  return parts.join("\n");
}

export function buildOrderText(o: OrderInput): string {
  if (o.booking) return buildBookingText(o);
  const head = `Здравствуйте! Заказ из SÖRE${o.number ? ` (№${o.number})` : ""}`;
  const lines = o.lines.map(
    (l, i) => `${i + 1}. ${l.title} × ${l.qty} — ${formatPrice(l.price * l.qty)}`,
  );
  const parts = [
    head,
    "",
    ...lines,
    "",
    `Итого: ${formatPrice(orderTotal(o.lines))}`,
    `Имя: ${o.name}`,
    o.delivery === "pickup" ? "Самовывоз" : `Доставка: ${o.address ?? ""}`,
  ];
  if (o.neededDate) parts.push(`Когда: ${formatNeeded(o.neededDate, o.neededTime)}`);
  if (o.comment) parts.push(`Комментарий: ${o.comment}`);
  if (o.statusUrl) parts.push("", `Статус заказа: ${o.statusUrl}`);
  return parts.join("\n");
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

export type PriceMode = "fixed" | "from" | "request";

export function asPriceMode(value: string | null | undefined): PriceMode {
  return value === "from" || value === "request" ? value : "fixed";
}

/** Позиции «от» и «по запросу» не кладутся в корзину: клиент пишет продавцу. */
export const isInquiry = (mode: string | null | undefined) => asPriceMode(mode) !== "fixed";

/** 15000 + «from» → «от 15 000 ₸»; «request» → «Цена по запросу». */
export function priceLabel(price: number, mode: string | null | undefined, lang: "ru" | "kz" = "ru", hasVariants = false): string {
  const m = asPriceMode(mode) === "fixed" && hasVariants ? "from" : asPriceMode(mode);
  if (m === "request") return lang === "kz" ? "Бағасы келісім бойынша" : "Цена по запросу";
  if (m === "from") return lang === "kz" ? `${formatPrice(price)}-ден бастап` : `от ${formatPrice(price)}`;
  return formatPrice(price);
}

/** Первое сообщение продавцу с витрины («Написать продавцу»), без привязки к товару. */
export function contactText(shopName: string): string {
  return `Здравствуйте! Пишу из магазина «${shopName}» в SÖRE. Хочу уточнить: `;
}

/** Сообщение продавцу всегда на русском, даже если витрина на казахском. */
export function inquiryText(title: string, price: number, mode: string | null | undefined, shopName: string): string {
  const m = asPriceMode(mode);
  const cost = m === "from" ? ` (${priceLabel(price, m)})` : "";
  return `Здравствуйте! Пишу из магазина «${shopName}» в SÖRE. Интересует: ${title}${cost}. Подскажите, пожалуйста, детали и стоимость.`;
}

/** «2026-11-20» + «18:00» → «20 ноября, 18:00» (дата без часового пояса). */
export function formatNeeded(date: string, time?: string | null, lang: "ru" | "kz" = "ru"): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = Number.isNaN(d.getTime())
    ? date
    : new Intl.DateTimeFormat(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
  return time ? `${day}, ${time}` : day;
}
