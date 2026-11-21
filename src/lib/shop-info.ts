/**
 * Ник в Instagram из того, что вставил продавец: «@aliya.sweets», «aliya.sweets»,
 * «https://www.instagram.com/aliya.sweets/?hl=ru». Возвращает чистый ник или null, если ввод не похож на ник.
 */
export function normalizeInstagram(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#\s]+)/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@+/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(value) ? value : null;
}

export const instagramUrl = (handle: string) => `https://www.instagram.com/${encodeURIComponent(handle)}/`;

type ShopInfoFields = { about?: string | null; address?: string | null; hours?: string | null; instagram?: string | null; payment_info?: string | null; delivery_info?: string | null };

/** Есть ли у магазина что показать в блоке «О магазине». */
export const hasShopInfo = (shop: ShopInfoFields) => Boolean(shop.about || shop.address || shop.hours || shop.instagram || shop.payment_info || shop.delivery_info);

/** Описание для поисковиков и соцсетей: свой текст магазина, если он есть, иначе общая подпись каталога. */
export function shopDescription(shop: ShopInfoFields, fallback: string): string {
  const about = shop.about?.replace(/\s+/g, " ").trim();
  return about ? about.slice(0, 200) : fallback;
}
