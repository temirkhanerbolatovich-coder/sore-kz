import { describe, expect, it } from "vitest";
import { hasShopInfo, instagramUrl, normalizeInstagram, shopDescription } from "@/lib/shop-info";

describe("Instagram магазина", () => {
  it("достаёт ник из ника, @ника и ссылки на профиль", () => {
    expect(normalizeInstagram("aliya.sweets")).toBe("aliya.sweets");
    expect(normalizeInstagram("@aliya.sweets")).toBe("aliya.sweets");
    expect(normalizeInstagram("https://www.instagram.com/aliya.sweets/?hl=ru")).toBe("aliya.sweets");
    expect(normalizeInstagram("instagram.com/Aliya_1#top")).toBe("Aliya_1");
    expect(normalizeInstagram("  ")).toBeNull();
  });

  it("отвергает всё, что не похоже на ник", () => {
    expect(normalizeInstagram("javascript:alert(1)")).toBeNull();
    expect(normalizeInstagram("два слова")).toBeNull();
    expect(normalizeInstagram("a".repeat(31))).toBeNull();
    expect(normalizeInstagram("https://evil.example/aliya")).toBeNull();
  });

  it("собирает безопасную ссылку", () => {
    expect(instagramUrl("aliya.sweets")).toBe("https://www.instagram.com/aliya.sweets/");
  });
});

describe("блок «О магазине»", () => {
  it("показывается, когда заполнено хотя бы одно поле", () => {
    expect(hasShopInfo({})).toBe(false);
    expect(hasShopInfo({ about: null, hours: "" })).toBe(false);
    expect(hasShopInfo({ payment_info: "Kaspi" })).toBe(true);
    expect(hasShopInfo({ delivery_info: "Самовывоз" })).toBe(true);
    expect(hasShopInfo({ hours: "9:00–20:00" })).toBe(true);
  });

  it("описание для поисковиков берёт текст магазина и схлопывает переносы", () => {
    expect(shopDescription({ about: "Печём торты\n\nна заказ" }, "запасной")).toBe("Печём торты на заказ");
    expect(shopDescription({ about: "  " }, "запасной")).toBe("запасной");
    expect(shopDescription({ about: "я".repeat(500) }, "x")).toHaveLength(200);
  });
});
