import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInquiryNotification, buildOrderNotification, escapeHtml, sendTelegram } from "@/lib/telegram";
import { reportError } from "@/lib/monitoring";

const order = {
  number: 12,
  items: [{ title: "Торт «Прага» · 2 кг", qty: 1, price: 22000 }, { title: "Капкейки <6>", qty: 2, price: 4500 }],
  total: 31000,
  customer_name: "Айгерим & Ко",
  customer_phone: "77011234567",
  address: "ул. Абая 10",
  comment: "к 18:00",
  needed_date: "2026-11-20",
  needed_time: "18:00",
};

describe("уведомление о заказе", () => {
  it("содержит состав, сумму, клиента, дату и кнопки, а чужой текст экранирует", () => {
    const { text, buttons } = buildOrderNotification(order, "Сладкий дом", "https://dukenai.vercel.app");
    expect(text).toContain("<b>Новый заказ №12</b> · Сладкий дом");
    expect(text).toContain("• Торт «Прага» · 2 кг × 1 — 22 000 ₸");
    expect(text).toContain("• Капкейки &lt;6&gt; × 2 — 9 000 ₸");
    expect(text).toContain("<b>Итого: 31 000 ₸</b>");
    expect(text).toContain("Клиент: Айгерим &amp; Ко, +7 701 123 45 67");
    expect(text).toContain("Доставка: ул. Абая 10");
    expect(text).toContain("Когда нужно: 20 ноября, 18:00");
    expect(text).toContain("Комментарий: к 18:00");
    expect(buttons[0]).toEqual({ text: "Открыть заказы", url: "https://dukenai.vercel.app/dashboard/orders" });
    expect(buttons[1].url.startsWith("https://wa.me/77011234567?text=")).toBe(true);
  });

  it("самовывоз и пустые поля не оставляют лишних строк", () => {
    const { text } = buildOrderNotification({ ...order, address: "Самовывоз", comment: null, needed_date: null, needed_time: null }, "М", "https://x.kz");
    expect(text).toContain("Самовывоз");
    expect(text).not.toContain("Когда нужно");
    expect(text).not.toContain("Комментарий");
    expect(text).not.toMatch(/\n\n\n/);
  });

  it("escapeHtml экранирует три опасных символа", () => {
    expect(escapeHtml("<a href=\"x\">&</a>")).toBe("&lt;a href=\"x\"&gt;&amp;&lt;/a&gt;");
  });
});

describe("отправка и мониторинг", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "tok");
    vi.stubEnv("TELEGRAM_API_BASE", "http://tg.test");
    vi.stubEnv("ADMIN_TELEGRAM_CHAT_ID", "42");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sendTelegram ходит на адрес из окружения и возвращает false при сбое", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendTelegram(7, "привет", [{ text: "Кнопка", url: "https://a.kz" }])).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://tg.test/bottok/sendMessage");
    expect(JSON.parse(init.body).reply_markup.inline_keyboard).toEqual([[{ text: "Кнопка", url: "https://a.kz" }]]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await sendTelegram(7, "ещё")).toBe(false);
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect(await sendTelegram(7, "без токена")).toBe(false);
  });

  it("reportError шлёт владельцу сообщение и не повторяет одинаковое в течение минуты", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const unique = `ошибка-${Math.random()}`;
    expect(await reportError("server", new Error(unique), "GET /demo")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ chat_id: "42" });
    expect(await reportError("server", new Error(unique), "GET /demo")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reportError ничего не делает, если админ-чат не задан", async () => {
    vi.stubEnv("ADMIN_TELEGRAM_CHAT_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await reportError("client", "x")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("уведомление об обращении «Узнать цену»", () => {
  it("называет магазин, товар и цену, экранирует чужой текст и не обещает, что покупатель написал", () => {
    const { text, buttons } = buildInquiryNotification({ title: "Торт <на заказ>", price: 15000, price_mode: "from" }, "Сладкий & дом", "https://sore-kz.netlify.app");
    expect(text).toContain("<b>Спросили цену</b> · Сладкий &amp; дом");
    expect(text).toContain("Торт &lt;на заказ&gt; (от 15 000 ₸)");
    expect(text).toContain("Если он его отправит");
    expect(buttons).toEqual([{ text: "Открыть кабинет", url: "https://sore-kz.netlify.app/dashboard" }]);
  });

  it("для цены по запросу пишет «Цена по запросу»", () => {
    const { text } = buildInquiryNotification({ title: "Банкет", price: 0, price_mode: "request" }, "Повар", "https://x.kz");
    expect(text).toContain("Банкет (Цена по запросу)");
  });
});
