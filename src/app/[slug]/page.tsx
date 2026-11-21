import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopBySlug } from "@/lib/shop-data";
import { parseLang, shopHref, tFor } from "@/lib/lang";
import { contactText, inquiryText, isInquiry, priceLabel, whatsappUrl } from "@/lib/order";
import { InquiryButton } from "@/components/inquiry-button";
import { BackIcon, WhatsAppIcon } from "@/components/icons";
import { BackLink } from "@/components/back-link";
import { variantsOf } from "@/lib/variants";
import { AddToCart } from "@/components/add-to-cart";
import { CartBar } from "@/components/cart-bar";
import { ProductPhoto } from "@/components/product-photo";
import { ViewTracker } from "@/components/view-tracker";
import { ShareButton } from "@/components/share-button";
import { DocumentLanguage } from "@/components/document-language";
import { publicAlternates, publicUrl, serializeJsonLd, shopTitle, storeJsonLd } from "@/lib/shop-seo";
import { isDemoSlug } from "@/lib/slug";
import { DemoActionStub, DemoNotice, PausedActionStub, PausedNotice } from "@/components/demo-notice";
import { shopDescription } from "@/lib/shop-info";
import { ShopAbout } from "@/components/shop-about";
import { ProductFilter } from "@/components/product-filter";
import { ThemeToggle } from "@/components/theme-toggle";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string; cat?: string }>;
};

/** Поиск по витрине появляется, когда товаров столько, что листать неудобно. */
const SEARCH_MIN_PRODUCTS = 8;
const catalogDescription = (count: number) => `Каталог и заказ в WhatsApp: ${count} товаров`;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const lang = parseLang((await searchParams).lang);
  const data = await getShopBySlug(slug);
  if (!data) return {};
  const { shop, products } = data;
  const image = products.find((p) => p.photo_url)?.photo_url ?? undefined;
  const title = shopTitle(shop.name, shop.city);
  const description = shopDescription(shop, catalogDescription(products.length));
  return {
    title,
    description,
    alternates: publicAlternates(`/${shop.slug}`, lang),
    robots: isDemoSlug(shop.slug) ? { index: false } : undefined,
    openGraph: { title, description, images: image ? [image] : undefined, type: "website" },
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const lang = parseLang(sp.lang);

  const data = await getShopBySlug(slug);
  if (!data) notFound();
  const { shop, products } = data;
  const t = tFor(lang, shop.booking_mode);

  const base = `/${shop.slug}`;
  const demo = isDemoSlug(shop.slug);
  // Демо-магазин вымышленный: номер-заглушку не отдаём даже поисковым роботам.
  const jsonLd = storeJsonLd(demo ? { ...shop, whatsapp: "" } : shop, publicUrl(shopHref(base, lang)), shopDescription(shop, catalogDescription(products.length)));
  const categories = [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const activeCat = sp.cat && categories.includes(sp.cat) ? sp.cat : undefined;
  const visible = activeCat ? products.filter((p) => p.category === activeCat) : products;
  const firstPhoto = visible.findIndex((product) => Boolean(product.photo_url));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <DocumentLanguage lang={lang} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <header className="flex flex-col gap-3 border-b border-line bg-surface px-5 pb-3 pt-4 md:py-4">
        {demo && (
          <BackLink fallback={shopHref("/", lang)} className="-ml-2 flex min-h-11 items-center gap-1 self-start px-2 font-semibold">
            <BackIcon size={22} />
            {t.backHome}
          </BackLink>
        )}
        <div className="flex items-center justify-between">
          <ShareButton title={shop.name} label={t.share} copiedLabel={t.shared} className="-ml-2" />
          <div className="flex items-center gap-2">
          <ThemeToggle className="size-11 border-field" />
          <div className="flex rounded-full border-[1.5px] border-field text-caption font-bold" role="group" aria-label="Язык">
            <Link
              href={shopHref(base, "ru", activeCat)}
              aria-current={lang === "ru" ? "true" : undefined}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-l-full px-3 ${lang === "ru" ? "bg-ink text-cream" : "text-muted"}`}
            >
              RU
            </Link>
            <Link
              href={shopHref(base, "kz", activeCat)}
              aria-current={lang === "kz" ? "true" : undefined}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-r-full px-3 ${lang === "kz" ? "bg-ink text-cream" : "text-muted"}`}
            >
              KZ
            </Link>
          </div>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          <ProductPhoto
            url={shop.avatar_url}
            alt=""
            initial={shop.name}
            eager
            className="size-14 flex-none rounded-full"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">{shop.name}</h1>
            {shop.city && <div className="text-body text-muted">{shop.city}</div>}
          </div>
        </div>
        {!shop.accepting_orders && <PausedNotice lang={lang} />}
        {demo ? (
          <DemoNotice lang={lang} />
        ) : (
          <a
            href={whatsappUrl(shop.whatsapp, contactText(shop.name))}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline h-11 min-h-11 w-full md:w-auto md:self-start"
          >
            <WhatsAppIcon />
            {t.writeSeller}
          </a>
        )}
      </header>
      {categories.length > 0 && (
        <div className="sticky top-0 z-20 border-b border-line bg-surface">
          <nav className="flex gap-2 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Категории">
            <Chip href={shopHref(base, lang)} active={!activeCat}>
              {t.all}
            </Chip>
            {categories.map((c) => (
              <Chip key={c} href={shopHref(base, lang, c)} active={activeCat === c}>
                {c}
              </Chip>
            ))}
          </nav>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent" />
        </div>
      )}

      <ShopAbout shop={shop} lang={lang} />

      <section id="main-content" tabIndex={-1} className="flex-1 px-4 pb-28 pt-4">
        {visible.length === 0 ? (
          <p className="card p-5 text-muted">{t.empty}</p>
        ) : (
          <ProductFilter
            minItems={SEARCH_MIN_PRODUCTS}
            labels={{ placeholder: t.search, empty: t.searchEmpty, reset: t.searchReset, clear: t.searchClear, found: t.searchFound }}
            items={visible.map((p, i) => ({
              id: p.id,
              text: [p.title, p.category, p.description_ru, p.description_kz].filter(Boolean).join(" ").toLocaleLowerCase("ru"),
              node: (
              <li
                key={p.id}
                className={`card flex flex-col overflow-hidden ${i >= 4 && i < 12 ? "rise-in" : ""}`}
                style={i >= 4 && i < 12 ? { "--rise-index": i - 4 } as CSSProperties : undefined}
              >
                <Link href={shopHref(`${base}/p/${p.id}`, lang)} className="flex flex-col">
                  <ProductPhoto
                    url={p.photo_url}
                    alt={p.title}
                    seed={i}
                    thumbnail
                    transitionName={`photo-${p.id}`}
                    priority={i === firstPhoto}
                    eager={i < 4}
                    className={`aspect-[4/3] w-full ${p.in_stock ? "" : "opacity-50 grayscale"}`}
                  />
                  <div className="flex flex-col gap-1 p-3 pb-2">
                    <div className="text-body font-semibold leading-tight">{p.title}</div>
                    <div className="text-base font-extrabold">{priceLabel(p.price, p.price_mode, lang, variantsOf(p).length > 0)}</div>
                  </div>
                </Link>
                <div className="mt-auto px-3 pb-3">
                  {p.in_stock && isInquiry(p.price_mode) && demo ? (
                    <DemoActionStub lang={lang} />
                  ) : p.in_stock && isInquiry(p.price_mode) ? (
                    <InquiryButton
                      shopId={shop.id}
                      productId={p.id}
                      href={whatsappUrl(shop.whatsapp, inquiryText(p.title, p.price, p.price_mode, shop.name))}
                      label={t.ask}
                    />
                  ) : variantsOf(p).length > 0 && p.in_stock ? (
                    <Link
                      href={shopHref(`${base}/p/${p.id}`, lang)}
                      className="flex h-11 w-full items-center justify-center rounded-xl bg-ink text-sm font-bold text-cream"
                    >
                      {t.pick}
                    </Link>
                  ) : !shop.accepting_orders && p.in_stock ? (
                    <PausedActionStub lang={lang} />
                  ) : (
                    <AddToCart slug={shop.slug} product={p} lang={lang} booking={shop.booking_mode} />
                  )}
                </div>
              </li>
              ),
            }))}
          />
        )}

        <p className="mt-8 text-center text-caption text-muted">
          {t.madeWith}{" "}
          <Link href="/" className="inline-flex min-h-11 items-center font-bold text-accent underline">
            SÖRE
          </Link>{" "}
          · {t.createOwn}
        </p>
        <p className="mt-2 flex justify-center gap-5 text-caption text-muted">
          <Link href="/terms" className="flex min-h-11 items-center underline">
            {t.terms}
          </Link>
          <Link href="/privacy" className="flex min-h-11 items-center underline">
            {t.privacy}
          </Link>
        </p>
      </section>

      <CartBar slug={shop.slug} lang={lang} booking={shop.booking_mode} />
      <ViewTracker shopId={shop.id} />
    </main>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`flex min-h-11 items-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
        active ? "bg-ink text-cream" : "border-[1.5px] border-field text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
