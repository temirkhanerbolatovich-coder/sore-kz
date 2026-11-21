import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getShopBySlug, getSitemapShops } from "@/lib/shop-data";
import { publicUrl } from "@/lib/shop-seo";
import { isDemoSlug } from "@/lib/slug";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  // Демо-магазины вымышленные: в поиск их не отдаём.
  const shops = (await getSitemapShops()).filter(({ slug }) => !isDemoSlug(slug));
  const result: MetadataRoute.Sitemap = [{ url: publicUrl("/"), priority: 1 }, { url: publicUrl("/terms") }, { url: publicUrl("/privacy") }];
  // Ограничиваем число одновременных чтений при холодном кэше.
  const concurrentShops = 20;
  for (let offset = 0; offset < shops.length; offset += concurrentShops) {
    const catalogs = await Promise.all(shops.slice(offset, offset + concurrentShops).map(({ slug }) => getShopBySlug(slug)));
    for (const catalog of catalogs) {
      if (!catalog) continue;
      const { shop, products } = catalog;
      result.push({ url: publicUrl(`/${shop.slug}`), lastModified: shop.created_at });
      result.push(...products.map((product) => ({ url: publicUrl(`/${shop.slug}/p/${product.id}`), lastModified: product.created_at })));
    }
  }
  return result;
}
