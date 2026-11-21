import { describe, expect, it } from "vitest";
import { productJsonLd, publicAlternates, serializeJsonLd, shopTitle, storeJsonLd } from "@/lib/shop-seo";

const url = "https://shop.example/store/p/example";
const product = { title: "Торт", price: 15000, price_mode: "fixed", in_stock: true, photo_url: "/demo/cake.svg" };

describe("метаданные витрины", () => {
  it("добавляет город только тогда, когда его нет в названии", () => {
    expect(shopTitle("Повар на выезд · Астана", "астана")).toBe("Повар на выезд · Астана");
    expect(shopTitle("Повар на выезд", "Астана")).toBe("Повар на выезд — Астана");
    expect(shopTitle("Повар на выезд", null)).toBe("Повар на выезд");
  });

  it("показывает канонический URL текущего языка и обе языковые ссылки", () => {
    expect(publicAlternates("/store", "kz")).toEqual({
      canonical: "/store?lang=kz",
      languages: { ru: "/store", kk: "/store?lang=kz" },
    });
  });

  it("описывает магазин и не позволяет выйти из script через пользовательский текст", () => {
    const description = "</script><script>evil()</script>";
    const store = storeJsonLd({ name: "Магазин", city: "Астана", whatsapp: "77010000000", avatar_url: null }, url, description);
    const encoded = serializeJsonLd(store);
    expect(encoded).not.toContain("<");
    expect(JSON.parse(encoded)).toMatchObject({ "@type": "Store", description, address: { addressLocality: "Астана" } });
  });

  it("добавляет адрес и Instagram магазина", () => {
    const store = storeJsonLd(
      { name: "Магазин", city: "Астана", whatsapp: "77010000000", avatar_url: null, address: "левый берег", instagram: "aliya.sweets" },
      url,
      "Описание",
    );
    expect(JSON.parse(serializeJsonLd(store))).toMatchObject({
      address: { streetAddress: "левый берег", addressLocality: "Астана", addressCountry: "KZ" },
      sameAs: ["https://www.instagram.com/aliya.sweets/"],
    });
  });

  it("публикует точную цену и наличие с абсолютным URL фото", () => {
    expect(productJsonLd(product, url, "Описание")).toMatchObject({
      "@type": "Product", image: "https://shop.example/demo/cake.svg",
      offers: { "@type": "Offer", price: 15000, priceCurrency: "KZT", availability: "https://schema.org/InStock" },
    });
  });

  it("различает минимальную цену и цену по запросу", () => {
    const from = productJsonLd({ ...product, price_mode: "from", in_stock: false }, url, "Описание");
    expect(from.offers).toMatchObject({
      priceSpecification: { minPrice: 15000, priceCurrency: "KZT" },
      availability: "https://schema.org/OutOfStock",
    });
    expect(from.offers?.price).toBeUndefined();
    const request = productJsonLd({ ...product, price_mode: "request", price: 0 }, url, "Описание");
    expect(JSON.parse(serializeJsonLd(request))).not.toHaveProperty("offers");
  });
});
