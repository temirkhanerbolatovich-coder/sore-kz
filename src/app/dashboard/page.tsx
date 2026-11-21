import { HomeScreenHint } from "./home-screen-hint";
import { ProductCatalog } from "./product-catalog";
import Link from "next/link";
import QRCode from "qrcode";
import { requireShop } from "@/lib/shop";
import { productLimit, type Product } from "@/lib/types";
import { PlanCard } from "./plan-card";
import { CopyBio, CopyLink } from "./copy-link";
import { SavedToast } from "./saved-toast";
import { DashboardNav } from "@/components/dashboard-nav";
import { AddProducts } from "./add-products";
import { FirstSteps } from "./first-steps";
import { telegramConfigured } from "@/lib/telegram";
import { getStats } from "@/lib/stats";
import { CameraIcon, PlusIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProductPhoto } from "@/components/product-photo";
import { UiLangSwitch } from "@/components/ui-lang";
import { getUiLang, tr } from "@/lib/ui-lang";
import type { Lang } from "@/lib/lang";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Кабинет — SÖRE", "Кабинет — SÖRE") };
}

const SAVED: Record<string, [string, string]> = {
  added: ["Товар добавлен. Он уже на витрине.", "Тауар қосылды. Ол витринада тұр."],
  updated: ["Изменения сохранены.", "Өзгерістер сақталды."],
  deleted: ["Товар удалён.", "Тауар жойылды."],
  batch: ["Товары добавлены.", "Тауарлар қосылды."],
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string; n?: string }> }) {
  const { saved, n } = await searchParams;
  const lang = await getUiLang();
  const { supabase, shop } = await requireShop();

  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", shop.id)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  const products = (data ?? []) as Product[];
  const stats = await getStats(supabase, shop.id);
  const tgConfigured = telegramConfigured();
  const { data: tg } = tgConfigured ? await supabase.from("shop_telegram").select("linked_at").eq("shop_id", shop.id).maybeSingle() : { data: null };
  const telegram: "off" | "pending" | "done" = !tgConfigured ? "off" : tg?.linked_at ? "done" : "pending";

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fullUrl = `${site}/${shop.slug}`;
  const shown = fullUrl.replace(/^https?:\/\//, "");
  const limit = productLimit(shop.pro_until);
  const full = products.length >= limit;
  const qr = await QRCode.toString(fullUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col pb-28 lg:max-w-6xl lg:pb-10">
      <DashboardNav active="products" newOrders={stats.newOrders} desktop />
      <div className="px-5 pb-3 pt-6">
          <div className="flex items-center gap-3">
            <ProductPhoto url={shop.avatar_url} alt="" initial={shop.name} thumbnail className="size-11 flex-none rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="break-words text-xl font-extrabold leading-tight">{shop.name}</div>
              {shop.city && <div className="text-sm text-muted">{shop.city}</div>}
            </div>
            <UiLangSwitch />
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <button type="submit" className="min-h-11 min-w-11 px-1 text-sm font-semibold text-muted underline">
                {tr(lang, "Выйти", "Шығу")}
              </button>
            </form>
          </div>

      </div>
      <div className="px-5 lg:hidden">
        <ShopSummary fullUrl={fullUrl} shown={shown} qr={qr} stats={stats} lang={lang} booking={shop.booking_mode} />
      </div>
      <div className="lg:flex lg:items-start lg:gap-4">
        <div id="main-content" tabIndex={-1} className="min-w-0 flex-1">
        {saved && SAVED[saved] && <SavedToast message={saved === "batch" ? `${tr(lang, "Добавлено товаров", "Қосылған тауар саны")}: ${Number(n) || ""}` : tr(lang, SAVED[saved][0], SAVED[saved][1])} />}
        {products.length === 0 && <AddProducts />}
        <HomeScreenHint />
        <PlanCard slug={shop.slug} proUntil={shop.pro_until} lang={lang} />
        <FirstSteps hasProducts={products.length > 0} shared={stats.views > 0} telegram={telegram} profileDone={Boolean(shop.avatar_url || shop.about)} />

        {products.length > 0 && (
          <div className="flex items-center justify-between px-5 pt-2">
            <h2 className="text-lg font-bold">{shop.booking_mode ? tr(lang, "Услуги", "Қызметтер") : tr(lang, "Товары", "Тауарлар")} · {products.length}</h2>
            <span className="text-sm text-muted">
              {tr(lang, "Лимит тарифа", "Тариф шегі")}: {products.length} {tr(lang, "из", "/")} {limit}
            </span>
          </div>
        )}

        {full && (
          <section className="card mx-5 mt-2 flex flex-col gap-1 p-4" aria-label={tr(lang, "Лимит товаров", "Тауар шегі")}>
            <h3 className="font-bold">{tr(lang, "Достигнут лимит бесплатного тарифа", "Тегін тариф шегіне жеттіңіз")}: {limit} {tr(lang, "товаров", "тауар")}</h3>
            <p className="text-sm text-muted">{tr(lang, "Чтобы добавить новый товар, скройте или удалите ненужный. Скрытые товары не видны покупателям, но остаются в кабинете. Или снимите ограничение тарифом Pro: карточка с кнопкой выше.", "Жаңа тауар қосу үшін қажетсізін жасырыңыз немесе жойыңыз. Жасырын тауарларды сатып алушылар көрмейді, бірақ олар кабинетте қалады. Немесе Pro тарифімен шектеуді алыңыз: жоғарыдағы батырмалы карточка.")}</p>
          </section>
        )}

        {!full && (
          <div className="flex flex-col gap-2 px-5 pt-2">
            <Link href="/dashboard/products/shelf" className="btn-dark h-12 min-h-12 w-full text-body">
              <CameraIcon />
              {tr(lang, "Добавить по фото полки", "Сөре суреті арқылы қосу")}
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/dashboard/products/batch" className="btn-outline h-11 min-h-11 px-2 text-sm">
                {tr(lang, "Несколько фото", "Бірнеше фото")}
              </Link>
              <Link href="/dashboard/products/import" className="btn-outline h-11 min-h-11 px-2 text-sm">
                {tr(lang, "Прайс из Excel", "Excel прайсы")}
              </Link>
            </div>
          </div>
        )}

        <ProductCatalog products={products} />

        {!full && products.length > 0 && (
          <div className="pointer-events-none sticky bottom-24 z-10 flex justify-end px-5 pb-2 pt-4 lg:bottom-6">
            <Link href="/dashboard/products/new" className="btn-accent pointer-events-auto h-14 rounded-full pl-4 pr-5 shadow-lg">
              <PlusIcon size={22} />
              {shop.booking_mode ? tr(lang, "Услуга", "Қызмет") : tr(lang, "Товар", "Тауар")}
            </Link>
          </div>
        )}

        </div>
        <aside className="hidden w-80 flex-none px-5 lg:block" aria-label={tr(lang, "Ссылка и статистика магазина", "Дүкен сілтемесі және статистикасы")}>
          <ShopSummary fullUrl={fullUrl} shown={shown} qr={qr} stats={stats} lang={lang} booking={shop.booking_mode} desktop />
        </aside>
      </div>
      <DashboardNav active="products" newOrders={stats.newOrders} />
    </main>
  );
}

function ShopSummary({ fullUrl, shown, qr, stats, lang, booking, desktop = false }: {
  lang: Lang;
  booking: boolean;
  fullUrl: string;
  shown: string;
  qr: string;
  stats: Awaited<ReturnType<typeof getStats>>;
  desktop?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-3 p-3.5">
        <div className="break-all text-body font-semibold">{shown}</div>
        <div className="grid grid-cols-2 gap-2">
          <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="btn-outline h-11 min-h-11 px-2 text-sm">
            {tr(lang, "Открыть витрину", "Витринаны ашу")}
          </a>
          <CopyLink url={fullUrl} />
        </div>
      </div>
      <CopyBio url={fullUrl} />
      {desktop && <div className="rounded-2xl border border-line bg-surface p-4 text-center">
        <div role="img" aria-label={`${tr(lang, "QR-код витрины", "Витрина QR-коды")}: ${fullUrl}`} className="mx-auto w-40 overflow-hidden rounded-xl [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
        <Link href="/dashboard/poster" className="mt-2 inline-flex min-h-11 items-center font-semibold underline">{tr(lang, "Плакат с QR-кодом", "QR-кодты плакат")}</Link>
      </div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3.5">
          <div className="text-caption text-muted">{tr(lang, "Просмотры за неделю", "Апталық қаралым")}</div>
          <div className="text-stat font-extrabold leading-tight">{stats.views}</div>
        </div>
        <div className="card p-3.5">
          <div className="text-caption text-muted">{booking ? tr(lang, "Нажали «Записаться»", "«Жазылу» басты") : tr(lang, "Нажали «Заказать»", "«Тапсырыс беру» басты")}</div>
          <div className="text-stat font-extrabold leading-tight">{stats.clicks}</div>
        </div>
      </div>
    </div>
  );
}
