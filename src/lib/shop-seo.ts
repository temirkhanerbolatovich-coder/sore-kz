import { shopHref, type Lang } from "@/lib/lang";
import { asPriceMode } from "@/lib/order";
import { instagramUrl } from "@/lib/shop-info";
import type { Product, Shop } from "@/lib/types";

const schema = "https://schema.org";

export function shopTitle(name: string, city: string | null) {
  const place = city?.trim();
  if (!place || name.toLocaleLowerCase("ru").includes(place.toLocaleLowerCase("ru"))) return name;
  return `${name} — ${place}`;
}

export function publicUrl(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").href;
}

export function publicAlternates(path: string, lang: Lang) {
  return {
    canonical: shopHref(path, lang),
    languages: { ru: shopHref(path, "ru"), kk: shopHref(path, "kz") },
  };
}

function imageUrl(photo: string | null, base: string) {
  if (!photo || !URL.canParse(photo, base)) return undefined;
  const url = new URL(photo, base);
  return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
}

type StoreFields = Pick<Shop, "name" | "city" | "whatsapp" | "avatar_url"> & Partial<Pick<Shop, "address" | "instagram">>;

export function storeJsonLd(shop: StoreFields, url: string, description: string) {
  return {
    "@context": schema,
    "@type": "Store",
    name: shop.name,
    url,
    description,
    telephone: shop.whatsapp ? `+${shop.whatsapp}` : undefined,
    address: shop.city || shop.address
      ? { "@type": "PostalAddress", streetAddress: shop.address || undefined, addressLocality: shop.city || undefined, addressCountry: "KZ" }
      : undefined,
    sameAs: shop.instagram ? [instagramUrl(shop.instagram)] : undefined,
    image: imageUrl(shop.avatar_url, url),
  };
}

export function productJsonLd(
  product: Pick<Product, "title" | "price" | "price_mode" | "photo_url" | "in_stock">,
  url: string,
  description: string,
) {
  const mode = asPriceMode(product.price_mode);
  return {
    "@context": schema,
    "@type": "Product",
    name: product.title,
    url,
    description,
    image: imageUrl(product.photo_url, url),
    offers: mode === "request" ? undefined : {
      "@type": "Offer",
      url,
      priceCurrency: "KZT",
      availability: `${schema}/${product.in_stock ? "InStock" : "OutOfStock"}`,
      price: mode === "fixed" ? product.price : undefined,
      priceSpecification: mode === "from" ? {
        "@type": "PriceSpecification",
        minPrice: product.price,
        priceCurrency: "KZT",
      } : undefined,
    },
  };
}

// JSON script contents are parsed as raw HTML until the closing tag.
export const serializeJsonLd = (value: object) => JSON.stringify(value).replace(/</g, "\\u003c");
