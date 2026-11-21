// Черновики «фото полки» в боте и данные кнопок. Чистый модуль без сети и базы: его проверяют юнит-тесты.
import type { BBox } from "@/lib/bbox";
import type { ShelfItem } from "@/lib/ai-shelf";

export type DraftItem = ShelfItem & { photo_url: string | null; selected: boolean };
export type DraftPayload = { source_photo_url: string; items: DraftItem[] };

export type InlineKeyboard = { text: string; callback_data: string }[][];

/**
 * callback_data у Telegram не длиннее 64 байт, поэтому в кнопке только короткая команда и id:
 *   d:<uuid>:t:<n>   отметить или снять товар n
 *   d:<uuid>:p       опубликовать выбранные
 *   d:<uuid>:x       отменить черновик
 *   o:<uuid>:done | o:<uuid>:cancelled   статус заказа
 */
export type BotAction =
  | { kind: "toggle"; draftId: string; index: number }
  | { kind: "publish"; draftId: string }
  | { kind: "discard"; draftId: string }
  | { kind: "order"; orderId: string; status: "done" | "cancelled" };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const ACTION = new RegExp(`^(?:d:(${UUID}):(?:t:(\\d{1,2})|(p)|(x))|o:(${UUID}):(done|cancelled))$`);

export function parseAction(data: string | undefined): BotAction | null {
  const m = data?.match(ACTION);
  if (!m) return null;
  if (m[5]) return { kind: "order", orderId: m[5], status: m[6] as "done" | "cancelled" };
  if (m[2] !== undefined) return { kind: "toggle", draftId: m[1], index: Number(m[2]) };
  return m[3] ? { kind: "publish", draftId: m[1] } : { kind: "discard", draftId: m[1] };
}

export const orderActionData = (orderId: string, status: "done" | "cancelled") => `o:${orderId}:${status}`;

/** Кнопки под черновиком: номера по 4 в ряд, затем «Опубликовать» и «Отмена». */
export function draftKeyboard(draftId: string, items: DraftItem[]): InlineKeyboard {
  const rows: InlineKeyboard = [];
  items.forEach((item, index) => {
    if (index % 4 === 0) rows.push([]);
    rows[rows.length - 1].push({ text: `${item.selected ? "✅" : "⬜️"} ${index + 1}`, callback_data: `d:${draftId}:t:${index}` });
  });
  const selected = items.filter((i) => i.selected).length;
  rows.push([
    { text: `📤 Опубликовать (${selected})`, callback_data: `d:${draftId}:p` },
    { text: "✖️ Отмена", callback_data: `d:${draftId}:x` },
  ]);
  return rows;
}

/** Черновик из базы: проверяем форму, а не верим jsonb. Повреждённый считаем отсутствующим. */
export function asDraftPayload(value: unknown): DraftPayload | null {
  if (!value || typeof value !== "object") return null;
  const { source_photo_url, items } = value as Record<string, unknown>;
  if (typeof source_photo_url !== "string" || !Array.isArray(items) || items.length === 0) return null;
  const ok = items.every(
    (i) =>
      i &&
      typeof i === "object" &&
      typeof (i as DraftItem).title === "string" &&
      typeof (i as DraftItem).selected === "boolean" &&
      typeof (i as DraftItem).bbox === "object",
  );
  return ok ? (value as DraftPayload) : null;
}

/** Строка для таблицы products из выбранного черновика. Цену с ценника продавец обязан проверить. */
export function draftToProduct(item: DraftItem, shopId: string, source: string, sort: number) {
  const price = item.price_hint && item.price_hint > 0 ? Math.round(item.price_hint) : 0;
  return {
    shop_id: shopId,
    title: item.title.slice(0, 120),
    description_ru: item.description_ru || null,
    description_kz: item.description_kz || null,
    category: item.category || null,
    price,
    price_mode: price > 0 ? "fixed" : "request",
    photo_url: item.photo_url ?? source,
    source_photo_url: source,
    bbox: item.bbox as BBox,
    price_needs_review: price > 0,
    in_stock: true,
    sort,
  };
}
