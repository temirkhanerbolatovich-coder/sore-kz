import { describe, expect, it } from "vitest";
import { buildOrderText, formatPrice, normalizePhone } from "@/lib/order";
import { slugify, slugError, RESERVED_SLUGS } from "@/lib/slug";
import { parseCard } from "@/lib/ai-card";
import { lineKey, useCart } from "@/lib/cart";
import { ownedPhotoPath } from "@/lib/photos";

describe("заказ", () => {
  it("форматирует цену и телефон", () => {
    expect(formatPrice(12000)).toBe("12 000 ₸");
    expect(normalizePhone("8 (701) 123-45-67")).toBe("77011234567");
    expect(normalizePhone("+7 701 123 45 67")).toBe("77011234567");
  });
  it("точно соответствует эталону", () => expect(buildOrderText({ number: 1042, lines: [
    { id: "1", title: "Торт «Прага» 1 кг", price: 12000, qty: 1 },
    { id: "2", title: "Капкейки, набор 6 шт", price: 4500, qty: 2 },
  ], name: "Айгерим", delivery: "delivery", address: "ул. Абая 10, кв. 5", comment: "к 18:00" })).toBe("Здравствуйте! Заказ из SÖRE (№1042)\n\n1. Торт «Прага» 1 кг × 1 — 12 000 ₸\n2. Капкейки, набор 6 шт × 2 — 9 000 ₸\n\nИтого: 21 000 ₸\nИмя: Айгерим\nДоставка: ул. Абая 10, кв. 5\nКомментарий: к 18:00"));
});
it("транслитерирует ru/kz и защищает служебные адреса", () => {
  expect(slugify("Сладкий дом Алии")).toBe("sladkiy-dom-alii");
  expect(slugify("Ә Ғ Қ Ң Ө Ұ Ү Һ І")).toBe("a-g-k-n-o-u-u-h-i");
  for (const slug of RESERVED_SLUGS) expect(slugError(slug)).not.toBeNull();
  expect(slugError("my-shop")).toBeNull();
});
it("разбирает JSON модели и обрезает длины", () => {
  const card = { title: "x".repeat(200), description_ru: "y".repeat(1200), description_kz: "Қазақша", category: "Торты" };
  expect(parseCard("```json\n" + JSON.stringify(card) + "\n```")?.title).toHaveLength(120);
  expect(parseCard(JSON.stringify(card))?.description_ru).toHaveLength(1000);
  expect(parseCard("мусор")).toBeNull(); expect(parseCard("{broken}")).toBeNull(); expect(parseCard("{}")).toBeNull();
});
it("корзина меняет магазин, ограничивает количество и обновляет цену", () => {
  const cart = useCart.getState(); cart.clear();
  cart.add("one", { id: "1", title: "A", price: 20, photo: null });
  cart.setQty(lineKey({ id: "1" }), 1000); expect(useCart.getState().lines[0].qty).toBe(99);
  cart.add("two", { id: "2", title: "B", price: 30, photo: null });
  expect(useCart.getState().lines.map((x) => x.id)).toEqual(["2"]);
  expect(cart.reconcile("two", [])).toBe(true); expect(useCart.getState().lines).toEqual([]);
});
it("принимает только каноническое фото владельца", () => {
  const base = "https://test.supabase.co"; const url = `${base}/storage/v1/object/public/product-photos/owner/`;
  expect(ownedPhotoPath(url + "file.jpg", "owner", base)).toBe("owner/file.jpg");
  for (const suffix of ["../other/file.jpg", "%2e%2e/file.jpg", "file.jpg?x=1", "file.svg"]) expect(ownedPhotoPath(url + suffix, "owner", base)).toBeNull();
  expect(ownedPhotoPath(url + "file.jpg", "other", base)).toBeNull();
});

it("варианты одного товара лежат в корзине отдельными строками, а сверка берёт актуальную цену варианта", () => {
  const product = (variants: unknown, price = 12000) =>
    ({ id: "p1", title: "Торт", price, in_stock: true, price_mode: "fixed", photo_url: null, variants }) as never;
  const cart = useCart.getState(); cart.clear();
  cart.add("shop", { id: "p1", title: "Торт", price: 12000, photo: null, variantId: "k1", variantTitle: "1 кг" });
  cart.add("shop", { id: "p1", title: "Торт", price: 22000, photo: null, variantId: "k2", variantTitle: "2 кг" });
  cart.add("shop", { id: "p1", title: "Торт", price: 12000, photo: null, variantId: "k1", variantTitle: "1 кг" });
  expect(useCart.getState().lines.map((l) => [l.variantId, l.qty])).toEqual([["k1", 2], ["k2", 1]]);

  // Продавец поднял цену 2 кг и убрал вариант 1 кг: строка 1 кг пропадает, у 2 кг новая цена.
  const changed = cart.reconcile("shop", [product([{ id: "k2", title: "2 кг", price: 25000 }], 25000)]);
  expect(changed).toBe(true);
  expect(useCart.getState().lines.map((l) => [l.variantId, l.price])).toEqual([["k2", 25000]]);
});

describe("ссылка на статус заказа", () => {
  const base = { number: 7, lines: [{ id: "a", title: "Торт", price: 1000, qty: 1 }], name: "Айгерим", delivery: "pickup" as const };

  it("добавляется последней строкой, когда передана", () => {
    const text = buildOrderText({ ...base, statusUrl: "https://shop.example/o/0123456789abcdef0123" });
    expect(text.split("\n").slice(-2)).toEqual(["", "Статус заказа: https://shop.example/o/0123456789abcdef0123"]);
  });

  it("не появляется без ссылки", () => {
    expect(buildOrderText(base)).not.toContain("Статус заказа");
  });
});

describe("buildOrderText: режим записи", () => {
  it("пишет заявку без количества, доставки и итога, с желаемым временем", () => {
    const text = buildOrderText({
      booking: true,
      number: 7,
      lines: [{ id: "a", title: "Стрижка", price: 5000, qty: 1 }],
      name: "Айгерим",
      delivery: "delivery",
      address: "Запись",
      neededDate: "2026-11-25",
      neededTime: "18:00",
      statusUrl: "https://example.test/o/abc",
    });
    expect(text).toContain("Хочу записаться (SÖRE №7)");
    expect(text).toContain("1. Стрижка — 5 000 ₸");
    expect(text).toContain("Желаемое время: 25 ноября, 18:00");
    expect(text).toContain("Статус заявки: https://example.test/o/abc");
    expect(text).not.toMatch(/Доставка|Итого|×/);
  });
});

describe("тариф Pro", () => {
  it("лимит товаров зависит от срока Pro", async () => {
    const { FREE_PRODUCT_LIMIT, PRO_PRODUCT_LIMIT, isPro, productLimit, proDaysLeft } = await import("@/lib/types");
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(productLimit(null)).toBe(FREE_PRODUCT_LIMIT);
    expect(productLimit(past)).toBe(FREE_PRODUCT_LIMIT);
    expect(productLimit(future)).toBe(PRO_PRODUCT_LIMIT);
    expect(isPro(future)).toBe(true);
    expect(isPro(undefined)).toBe(false);
    expect(proDaysLeft(future)).toBe(5);
    expect(proDaysLeft(past)).toBe(0);
  });

  it("ссылка на покупку Pro ведёт в WhatsApp владельца с адресом магазина", async () => {
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = "+7 701 000 00 00";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.test";
    const { proRequestUrl } = await import("@/lib/support");
    const url = proRequestUrl("aliya-sweets") ?? "";
    expect(url.startsWith("https://wa.me/77010000000?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("https://example.test/aliya-sweets");
    expect(decodeURIComponent(proRequestUrl("aliya-sweets", true) ?? "")).toContain("продлить");
    delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
    expect(proRequestUrl("aliya-sweets")).toBeNull();
  });
});
