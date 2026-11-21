import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { getShopBySlug } from "@/lib/shop-data";
import { description, parseLang, shopHref, tFor } from "@/lib/lang";
import { inquiryText, isInquiry, priceLabel, whatsappUrl } from "@/lib/order";
import { InquiryButton } from "@/components/inquiry-button";
import { ProductBuy } from "@/components/product-buy";
import { ShareButton } from "@/components/share-button";
import { variantsOf } from "@/lib/variants";
import { AddToCart } from "@/components/add-to-cart";
import { CartBar } from "@/components/cart-bar";
import { ProductPhoto } from "@/components/product-photo";
import { PhotoViewer } from "@/components/photo-viewer";
import { DocumentLanguage } from "@/components/document-language";
import { productJsonLd, publicAlternates, publicUrl, serializeJsonLd } from "@/lib/shop-seo";
import { isDemoSlug } from "@/lib/slug";
import { DemoActionStub, DemoNotice, PausedActionStub, PausedNotice } from "@/components/demo-notice";
import { BackIcon } from "@/components/icons";
import { ShelfFrames } from "@/components/shelf-frames";
import { asBBox } from "@/lib/bbox";

type Props = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ lang?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const lang = parseLang((await searchParams).lang);
  const data = await getShopBySlug(slug);
  const product = data?.products.find((p) => p.id === id);
  if (!data || !product) return {};
  const text = description(product, lang) || `${priceLabel(product.price, product.price_mode, lang)} · ${data.shop.name}`;
  return {
    title: `${product.title} — ${data.shop.name}`,
    description: text,
    alternates: publicAlternates(`/${data.shop.slug}/p/${id}`, lang),
    robots: isDemoSlug(data.shop.slug) ? { index: false } : undefined,
    openGraph: {
      title: product.title,
      description: text,
      images: product.photo_url ? [product.photo_url] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug, id } = await params;
  const lang = parseLang((await searchParams).lang);

  const data = await getShopBySlug(slug);
  const product = data?.products.find((p) => p.id === id);
  if (!data || !product) notFound();
  const { shop } = data;
  const t = tFor(lang, shop.booking_mode);
  const text = description(product, lang);
  const variants = variantsOf(product);
  const shelfBox = product.source_photo_url ? asBBox(product.bbox) : null;
  const url = publicUrl(shopHref(`/${shop.slug}/p/${id}`, lang));
  const demo = isDemoSlug(shop.slug);
  const jsonLd = productJsonLd(product, url, text || `${priceLabel(product.price, product.price_mode, lang)} · ${shop.name}`);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-28">
      <DocumentLanguage lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <div className="flex items-center justify-between gap-1 px-3 py-3">
        <BackLink fallback={shopHref(`/${shop.slug}`, lang)} className="flex min-h-11 items-center gap-1 px-2 font-semibold">
          <BackIcon size={22} />
          {shop.name}
        </BackLink>
        <ShareButton title={`${product.title} — ${shop.name}`} label={t.share} copiedLabel={t.shared} />
      </div>
      {demo && <DemoNotice lang={lang} className="mx-5 mb-3 md:mx-5" />}
      {!shop.accepting_orders && <PausedNotice lang={lang} className="mx-5 mb-3 md:mx-5" />}

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-6 md:px-5">
        {product.photo_url ? (
          <PhotoViewer url={product.photo_url} alt={product.title} zoomLabel={t.zoomPhoto} closeLabel={t.closePhoto}>
            <ProductPhoto url={product.photo_url} alt={product.title} priority transitionName={`photo-${product.id}`} className="aspect-square w-full md:rounded-2xl" />
          </PhotoViewer>
        ) : (
          <ProductPhoto url={product.photo_url} alt={product.title} priority className="aspect-square w-full md:rounded-2xl" />
        )}

        <div id="main-content" tabIndex={-1} className="flex min-w-0 flex-col gap-3 px-5 pt-5 md:px-0 md:pt-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{product.title}</h1>
          <div className="flex items-center justify-between gap-3">
            <div className="text-2xl font-extrabold">{priceLabel(product.price, product.price_mode, lang, variants.length > 0)}</div>
            <div className={`text-sm font-bold ${product.in_stock ? "text-wa" : "text-accent-dark"}`}>
              {product.in_stock ? t.inStock : t.out}
            </div>
          </div>
          {text && <p className="whitespace-pre-line text-lead leading-relaxed text-muted">{text}</p>}
          <div className="pt-2 md:sticky md:bottom-4 md:z-10 md:rounded-xl md:bg-surface md:p-3">
            {product.in_stock && isInquiry(product.price_mode) && demo ? (
              <DemoActionStub lang={lang} />
            ) : product.in_stock && isInquiry(product.price_mode) ? (
              <div className="flex flex-col gap-2">
                <InquiryButton
                  shopId={shop.id}
                  productId={product.id}
                  href={whatsappUrl(shop.whatsapp, inquiryText(product.title, product.price, product.price_mode, shop.name))}
                  label={t.ask}
                />
                <p className="text-center text-caption text-muted">{t.askHint}</p>
              </div>
            ) : !shop.accepting_orders && product.in_stock ? (
              <PausedActionStub lang={lang} className="h-12 text-base" />
            ) : variants.length > 0 && product.in_stock ? (
              <ProductBuy slug={shop.slug} product={product} variants={variants} lang={lang} booking={shop.booking_mode} />
            ) : (
              <AddToCart slug={shop.slug} product={product} lang={lang} booking={shop.booking_mode} />
            )}
          </div>
          {shelfBox && product.source_photo_url && (
            // Снимок полки ниже кнопок и с ленивой загрузкой: не влияет на первый экран и не сдвигает его.
            <figure className="flex flex-col gap-2 pt-4">
              <figcaption className="text-sm font-semibold text-muted">{t.onShelf}</figcaption>
              <ShelfFrames src={product.source_photo_url} alt={`${product.title}: ${t.onShelf.toLowerCase()}`} frames={[{ bbox: shelfBox }]} lazy />
            </figure>
          )}
        </div>

      </div>
      <CartBar slug={shop.slug} lang={lang} booking={shop.booking_mode} />
    </main>
  );
}
