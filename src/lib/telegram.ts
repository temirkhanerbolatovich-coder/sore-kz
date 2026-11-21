import { formatNeeded, formatPrice, priceLabel, whatsappUrl } from "@/lib/order";

/** Адрес API Telegram можно подменить (тесты поднимают свой сервер). */
const apiBase = () => process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";

export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

export type InlineButton = { text: string; url: string };
/** Кнопка-действие: нажатие приходит боту (src/lib/bot/sore-bot.ts), а не открывает ссылку. */
export type ActionButton = { text: string; callback_data: string };

/**
 * Отправка сообщения ботом. Возвращает true при успехе; сбой не должен ломать основной запрос.
 * Кнопки-ссылки идут по одной в ряд, кнопки-действия одним рядом под ними.
 */
export async function sendTelegram(chatId: number | string, text: string, buttons: InlineButton[] = [], actions: ActionButton[] = []): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const res = await fetch(`${apiBase()}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(buttons.length || actions.length
          ? { reply_markup: { inline_keyboard: [...buttons.map((b): (InlineButton | ActionButton)[] => [b]), ...(actions.length ? [actions] : [])] } }
          : {}),
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type OrderForMessage = {
  id?: string;
  number: number;
  items: { title: string; qty: number; price: number }[];
  total: number;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  comment: string | null;
  needed_date: string | null;
  needed_time: string | null;
};

/** Уведомление об обращении «Узнать цену»: покупатель открыл WhatsApp с готовым текстом, но мог его не отправить. */
export function buildInquiryNotification(
  product: { title: string; price: number; price_mode: string | null },
  shopName: string,
  siteUrl: string,
) {
  const text = [
    `<b>Спросили цену</b> · ${escapeHtml(shopName)}`,
    "",
    `${escapeHtml(product.title)} (${priceLabel(product.price, product.price_mode)})`,
    "",
    "Покупатель открыл WhatsApp с готовым сообщением. Если он его отправит, ответ придёт туда.",
  ].join("\n");
  const buttons: InlineButton[] = [{ text: "Открыть кабинет", url: `${siteUrl}/dashboard` }];
  return { text, buttons };
}

const phone = (p: string) => p.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");

/** Текст уведомления продавцу о новом заказе (HTML для Telegram) и кнопки под ним. */
export function buildOrderNotification(order: OrderForMessage, shopName: string, siteUrl: string) {
  const lines = order.items.map((i) => `• ${escapeHtml(i.title)} × ${i.qty} — ${formatPrice(i.price * i.qty)}`);
  const parts = [
    `<b>Новый заказ №${order.number}</b> · ${escapeHtml(shopName)}`,
    "",
    ...lines,
    "",
    `<b>Итого: ${formatPrice(order.total)}</b>`,
    `Клиент: ${escapeHtml(order.customer_name)}, ${phone(order.customer_phone)}`,
    order.address === "Самовывоз" ? "Самовывоз" : order.address ? `Доставка: ${escapeHtml(order.address)}` : "",
    order.needed_date ? `Когда нужно: ${formatNeeded(order.needed_date, order.needed_time)}` : "",
    order.comment ? `Комментарий: ${escapeHtml(order.comment)}` : "",
  ].filter((l, i, all) => l !== "" || (i > 0 && all[i - 1] !== ""));

  const buttons: InlineButton[] = [
    { text: "Открыть заказы", url: `${siteUrl}/dashboard/orders` },
    {
      text: "Написать клиенту в WhatsApp",
      url: whatsappUrl(order.customer_phone, `Здравствуйте, ${order.customer_name}! Ваш заказ №${order.number} на ${formatPrice(order.total)} из магазина «${shopName}»`),
    },
  ];
  // Отметить заказ прямо из уведомления: бот проверит, что заказ из магазина этого чата.
  const actions: ActionButton[] = order.id
    ? [
        { text: "✅ Выполнен", callback_data: `o:${order.id}:done` },
        { text: "✖️ Отменить", callback_data: `o:${order.id}:cancelled` },
      ]
    : [];
  return { text: parts.join("\n"), buttons, actions };
}
