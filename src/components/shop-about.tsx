import { T, type Lang } from "@/lib/lang";
import { hasShopInfo, instagramUrl } from "@/lib/shop-info";
import type { Shop } from "@/lib/types";

/** Блок «О магазине» под шапкой витрины: описание, график, адрес и Instagram. */
export function ShopAbout({ shop, lang }: { shop: Pick<Shop, "about" | "address" | "hours" | "instagram" | "payment_info" | "delivery_info">; lang: Lang }) {
  if (!hasShopInfo(shop)) return null;
  const t = T[lang];
  const about = shop.about ? <p className="whitespace-pre-line leading-snug">{shop.about}</p> : null;
    const hasDetails = Boolean(shop.hours || shop.address || shop.instagram || shop.payment_info || shop.delivery_info);

  // Блок свёрнут: покупателю на телефоне сначала нужны товары, а график и условия открываются одним нажатием.
  return (
    <details className="group mx-4 mt-3 rounded-2xl border border-line bg-surface px-4 text-body">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col justify-center py-2">
        <span className="line-clamp-2 leading-snug group-open:hidden">{shop.about || shop.hours || shop.address}</span>
        <span className="text-sm font-semibold text-accent underline">{t.more}</span>
      </summary>
      <div className="flex flex-col gap-2 pb-4">
      {about}
      {hasDetails && (
        <dl className="flex flex-col gap-1 text-muted">
          {shop.hours && (
            <div className="flex gap-2">
              <dt className="flex-none font-semibold text-ink">{t.hours}:</dt>
              <dd>{shop.hours}</dd>
            </div>
          )}
          {shop.address && (
            <div className="flex gap-2">
              <dt className="flex-none font-semibold text-ink">{t.address}:</dt>
              <dd>{shop.address}</dd>
            </div>
          )}
          {shop.payment_info && (
            <div className="flex gap-2">
              <dt className="flex-none font-semibold text-ink">{t.payment}:</dt>
              <dd className="whitespace-pre-line">{shop.payment_info}</dd>
            </div>
          )}
          {shop.delivery_info && (
            <div className="flex gap-2">
              <dt className="flex-none font-semibold text-ink">{t.deliveryTerms}:</dt>
              <dd className="whitespace-pre-line">{shop.delivery_info}</dd>
            </div>
          )}
          {shop.instagram && (
            <div className="flex gap-2">
              <dt className="flex-none font-semibold text-ink">Instagram:</dt>
              <dd>
                <a
                  href={instagramUrl(shop.instagram)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold text-accent underline"
                >
                  @{shop.instagram}
                </a>
              </dd>
            </div>
          )}
        </dl>
      )}
      </div>
    </details>
  );
}
