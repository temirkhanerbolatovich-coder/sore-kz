import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { artSvg, ART_NAMES } from "../../scripts/demo-shops/art";
import { DEMO_SHOPS } from "../../scripts/demo-shops/data";
import { DEMO_SLUG_PREFIX, isDemoSlug, SLUG_RE, slugError } from "@/lib/slug";
import { FREE_PRODUCT_LIMIT } from "@/lib/types";

describe("демо-магазины", () => {
  it("адреса уникальны, начинаются с demo- и проходят формат", () => {
    const slugs = DEMO_SHOPS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(SLUG_RE.test(slug)).toBe(true);
      expect(isDemoSlug(slug)).toBe(true);
    }
  });

  it("поля магазина укладываются в ограничения базы", () => {
    for (const shop of DEMO_SHOPS) {
      expect(shop.name.length).toBeGreaterThanOrEqual(2);
      expect(shop.name.length).toBeLessThanOrEqual(60);
      expect(shop.city.length).toBeLessThanOrEqual(60);
      expect(shop.about.length).toBeLessThanOrEqual(300);
      expect(shop.address.length).toBeLessThanOrEqual(120);
      expect(shop.hours.length).toBeLessThanOrEqual(120);
      expect(shop.lead_days).toBeGreaterThanOrEqual(0);
      expect(shop.lead_days).toBeLessThanOrEqual(60);
      expect(shop.products.length).toBeLessThanOrEqual(FREE_PRODUCT_LIMIT);
      expect(shop.avatar).toMatch(/^[a-z0-9-]+-\d+$/);
    }
  });

  it("товары: цена согласована с режимом, тексты на двух языках и в пределах длины", () => {
    for (const product of DEMO_SHOPS.flatMap((s) => s.products)) {
      expect(product.title.length).toBeGreaterThanOrEqual(1);
      expect(product.title.length).toBeLessThanOrEqual(120);
      expect(Number.isInteger(product.price)).toBe(true);
      if (product.price_mode === "request") expect(product.price).toBe(0);
      else expect(product.price).toBeGreaterThan(0);
      expect(product.description_ru.length).toBeGreaterThan(0);
      expect(product.description_kz.length).toBeGreaterThan(0);
      expect(product.description_ru.length).toBeLessThanOrEqual(1000);
      expect(product.description_kz.length).toBeLessThanOrEqual(1000);
      expect(product.category.length).toBeLessThanOrEqual(60);
      expect(ART_NAMES).toContain(product.art);
      expect(product.photo).toMatch(/^[a-z0-9-]+-\d+$/);
    }
  });

  it("у каждого товара своё фото", () => {
    const photos = DEMO_SHOPS.flatMap((s) => s.products.map((p) => p.photo));
    expect(new Set(photos).size).toBe(photos.length);
  });

  it("каждая иллюстрация рисуется в квадратный JPEG", async () => {
    for (const art of ART_NAMES) {
      const jpeg = await sharp(Buffer.from(artSvg(art, { bg: "#eeeeee" }))).resize(120, 120).jpeg().toBuffer();
      const meta = await sharp(jpeg).metadata();
      expect([meta.width, meta.height]).toEqual([120, 120]);
    }
  });

  it("продавец не может занять адрес demo-", () => {
    expect(slugError(`${DEMO_SLUG_PREFIX}shop`)).not.toBeNull();
    expect(slugError("my-shop")).toBeNull();
  });
});
