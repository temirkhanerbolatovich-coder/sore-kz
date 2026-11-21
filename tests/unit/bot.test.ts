import { describe, expect, it } from "vitest";
import { asDraftPayload, draftKeyboard, draftToProduct, orderActionData, parseAction, type DraftItem } from "@/lib/bot/drafts";
import { formatDraft, formatOrdersList, pluralProducts, renderProgressText } from "@/lib/bot/texts";
import { buildOrderNotification } from "@/lib/telegram";
import { WELCOME_TEXT } from "@/lib/bot/texts";
import { staticBotInfo } from "@/lib/bot/sore-bot";

const ID = "6f1c2c1e-1b7a-4c55-9d1e-2a3b4c5d6e7f";
const box = { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.6 };
const item = (over: Partial<DraftItem> = {}): DraftItem => ({
  title: "Шоколад <Казахстан>",
  description_ru: "Плитка в синей упаковке.",
  description_kz: "Көк орамдағы тақта.",
  category: "Сладости",
  bbox: box,
  price_hint: null,
  photo_url: "https://x.supabase.co/storage/v1/object/public/product-photos/u/a.jpg",
  selected: true,
  ...over,
});

describe("кнопки бота", () => {
  it("разбирает действия черновика и заказа и укладывается в 64 байта", () => {
    expect(parseAction(`d:${ID}:t:3`)).toEqual({ kind: "toggle", draftId: ID, index: 3 });
    expect(parseAction(`d:${ID}:p`)).toEqual({ kind: "publish", draftId: ID });
    expect(parseAction(`d:${ID}:x`)).toEqual({ kind: "discard", draftId: ID });
    expect(parseAction(orderActionData(ID, "done"))).toEqual({ kind: "order", orderId: ID, status: "done" });
    expect(parseAction(`o:${ID}:cancelled`)).toEqual({ kind: "order", orderId: ID, status: "cancelled" });
    for (const data of [`d:${ID}:t:11`, orderActionData(ID, "cancelled")]) expect(Buffer.byteLength(data)).toBeLessThanOrEqual(64);
  });

  it("отклоняет чужие и битые данные", () => {
    for (const bad of [undefined, "", "d:not-a-uuid:p", `o:${ID}:new`, `d:${ID}:t:`, `d:${ID}:t:123`, `x:${ID}:p`, `d:${ID}:p:extra`]) {
      expect(parseAction(bad)).toBeNull();
    }
  });

  it("клавиатура черновика: номера по 4 в ряд и счётчик выбранных", () => {
    const items = [item(), item({ selected: false }), item(), item(), item()];
    const kb = draftKeyboard(ID, items);
    expect(kb.map((row) => row.length)).toEqual([4, 1, 2]);
    expect(kb[0][1]).toEqual({ text: "⬜️ 2", callback_data: `d:${ID}:t:1` });
    expect(kb[2][0].text).toBe("📤 Опубликовать (4)");
  });
});

describe("черновик фото полки", () => {
  it("текст экранирует название от ИИ и показывает цену с ценника", () => {
    const text = formatDraft([item({ price_hint: 1500 }), item({ selected: false })], 7);
    expect(text).toContain("На фото 2 товара");
    expect(text).toContain("✅ 1. Шоколад &lt;Казахстан&gt; — 1 500 ₸");
    expect(text).toContain("⬜️ 2. Шоколад &lt;Казахстан&gt; — цена по запросу");
    expect(text).toContain("Выбрано: <b>1</b>");
    expect(text).toContain("осталось: 7");
  });

  it("товар без цены публикуется «по запросу», с ценником требует проверки", () => {
    const src = "https://x.supabase.co/storage/v1/object/public/product-photos/u/src.jpg";
    const noPrice = draftToProduct(item({ photo_url: null }), "shop", src, 4);
    expect(noPrice).toMatchObject({ price: 0, price_mode: "request", price_needs_review: false, photo_url: src, source_photo_url: src, sort: 4 });
    const priced = draftToProduct(item({ price_hint: 2490 }), "shop", src, 5);
    expect(priced).toMatchObject({ price: 2490, price_mode: "fixed", price_needs_review: true });
  });

  it("не доверяет повреждённому jsonb", () => {
    expect(asDraftPayload(null)).toBeNull();
    expect(asDraftPayload({ source_photo_url: "u", items: [] })).toBeNull();
    expect(asDraftPayload({ source_photo_url: "u", items: [{ title: 1 }] })).toBeNull();
    expect(asDraftPayload({ source_photo_url: "u", items: [item()] })).not.toBeNull();
  });
});

describe("тексты бота", () => {
  it("приветствие помещается в подпись к фото (1024 символа)", () => {
    expect(WELCOME_TEXT.replace(/<[^>]+>/g, "").length).toBeLessThanOrEqual(1024);
  });

  it("склоняет «товар» и рисует прогресс", () => {
    expect([1, 2, 5, 11, 21, 22].map(pluralProducts)).toEqual(["товар", "товара", "товаров", "товаров", "товар", "товара"]);
    expect(renderProgressText(1)).toContain("✅ Получил фото\n⏳ <b>ИИ ищет товары…</b>\n▫️ Вырезаю фото товаров");
  });

  it("список заказов со статусами и экранированием", () => {
    const text = formatOrdersList([
      { number: 7, created_at: "2026-11-16T09:30:00Z", customer_name: "Ая <3", total: 9000, status: "new", items: [{ title: "Торт", qty: 2 }] },
    ]);
    expect(text).toContain("<b>№7</b> · 16.11, 14:30 · Ая &lt;3 · 🆕 новый");
    expect(text).toContain("Торт × 2 — <b>9 000 ₸</b>");
    expect(formatOrdersList([])).toContain("Заказов пока нет");
  });

  it("уведомление о заказе с id получает кнопки статуса", () => {
    const order = { id: ID, number: 3, items: [{ title: "Торт", qty: 1, price: 5000 }], total: 5000, customer_name: "Ая", customer_phone: "77011234567", address: null, comment: null, needed_date: null, needed_time: null };
    const { actions } = buildOrderNotification(order, "Магазин", "https://sore.kz");
    expect(actions.map((a) => parseAction(a.callback_data))).toEqual([
      { kind: "order", orderId: ID, status: "done" },
      { kind: "order", orderId: ID, status: "cancelled" },
    ]);
    expect(buildOrderNotification({ ...order, id: undefined }, "Магазин", "https://sore.kz").actions).toEqual([]);
  });
});

describe("данные бота без getMe", () => {
  it("id из токена, а тестовый токен без id не ломает бота", () => {
    expect(staticBotInfo("123456:ABC", "sore_kz_bot")).toMatchObject({ id: 123456, username: "sore_kz_bot", is_bot: true });
    expect(staticBotInfo("e2e-token", "sore_e2e_bot")).toMatchObject({ id: 0, username: "sore_e2e_bot" });
    expect(staticBotInfo("123456:ABC", "")).toBeUndefined();
  });
});
