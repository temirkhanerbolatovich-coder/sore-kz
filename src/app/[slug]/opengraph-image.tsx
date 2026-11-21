import { getShopBySlug } from "@/lib/shop-data";
import { OG_SIZE, renderOg } from "@/lib/og";

export const alt = "Магазин в SÖRE";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getShopBySlug(slug);
  const count = data?.products.length ?? 0;
  return renderOg({
    title: data?.shop.name ?? "SÖRE",
    subtitle: [data?.shop.city, count ? `${count} товаров` : null].filter(Boolean).join(" · ") || "Каталог и заказ в WhatsApp",
    badge: "Магазин-ссылка",
  });
}
