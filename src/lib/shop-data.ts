import { cache } from "react";
import { revalidateTag, unstable_cache, updateTag } from "next/cache";
import { SLUG_RE } from "@/lib/slug";
import { createPublicClient } from "@/lib/supabase/public";
import type { Shop } from "@/lib/types";

const SHOP_REVALIDATE_SECONDS = 240;
const MAX_SHOP_AGE_MS = 300_000;
const SITEMAP_SHOPS_TAG = "sitemap:shops";
const sitemapPageSize = 1000;
const shopTag = (slug: string) => `shop:${slug.toLowerCase()}`;

class ShopNotFound extends Error {}

async function readShop(slug: string) {
  const supabase = createPublicClient();
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (shopError) throw new Error("Не удалось загрузить магазин");
  // Only successful lookups belong in the Data Cache.
  if (!shop) throw new ShopNotFound();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error("Не удалось загрузить товары");
  return { shop, products: data ?? [] };
}

export const getShopBySlug = cache(async (slug: string) => {
  const normalizedSlug = slug.toLowerCase();
  if (!SLUG_RE.test(normalizedSlug)) return null;

  const getSnapshot = unstable_cache(
    async (key: string) => ({ data: await readShop(key), loadedAt: Date.now() }),
    ["public-shop"],
    { tags: [shopTag(normalizedSlug)], revalidate: SHOP_REVALIDATE_SECONDS },
  );
  try {
    const snapshot = await getSnapshot(normalizedSlug);
    // Revalidation can serve one stale result. Enforce a hard age limit even then.
    return Date.now() - snapshot.loadedAt < MAX_SHOP_AGE_MS ? snapshot.data : await readShop(normalizedSlug);
  } catch (error) {
    if (error instanceof ShopNotFound) return null;
    throw error;
  }
});

export const getSitemapShops = unstable_cache(
  async () => {
    const supabase = createPublicClient();
    const shops: Pick<Shop, "slug" | "created_at">[] = [];
    for (let offset = 0; ; offset += sitemapPageSize) {
      const { data, error } = await supabase
        .from("shops")
        .select("slug,created_at")
        .order("id")
        .range(offset, offset + sitemapPageSize - 1);
      if (error) throw new Error("Не удалось построить sitemap");
      shops.push(...data);
      if (data.length < sitemapPageSize) return shops;
    }
  },
  ["sitemap-shops"],
  { tags: [SITEMAP_SHOPS_TAG], revalidate: SHOP_REVALIDATE_SECONDS },
);

export function invalidateShop(slug: string) {
  updateTag(shopTag(slug));
}

/**
 * То же, что invalidateShop, но для Route Handler: updateTag там запрещён, поэтому tag истекает сразу через
 * { expire: 0 } (следующий запрос витрины читает базу, устаревшее не отдаётся).
 */
export function invalidateShopFromRoute(slug: string) {
  revalidateTag(shopTag(slug), { expire: 0 });
}

/** The slug listing changes only on shop creation or deletion. */
export function invalidateSitemapShops() {
  updateTag(SITEMAP_SHOPS_TAG);
}
