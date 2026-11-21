import QRCode from "qrcode";
import { BackLink } from "@/components/back-link";
import { requireShop } from "@/lib/shop";
import { getUiLang, tr } from "@/lib/ui-lang";
import { PrintButton } from "./print-button";
import { BackIcon } from "@/components/icons";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Плакат с QR-кодом — SÖRE", "QR-кодты плакат — SÖRE"), robots: { index: false } };
}

/** Страница для печати: название магазина, крупный QR-код на витрину и адрес ссылки. */
export default async function PosterPage() {
  const { shop } = await requireShop();
  const lang = await getUiLang();
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${site}/${shop.slug}`;
  // SVG строится из нашего же адреса: вставка безопасна и печатается чётко в любом размере.
  const qr = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#2b2118", light: "#ffffff" } });

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 p-5 pb-10 print:max-w-none print:gap-8 print:p-0">
      {/* Размер листа и поля при печати; остальное оформление берёт Tailwind. */}
      <style>{"@media print { @page { size: A4 portrait; margin: 14mm; } body { background: #fff !important; } }"}</style>

      <div className="flex items-center justify-between gap-3 print:hidden">
        <BackLink fallback="/dashboard/settings" className="flex min-h-11 items-center gap-1 font-semibold">
          <BackIcon size={22} />
          {tr(lang, "Магазин", "Дүкен")}
        </BackLink>
      </div>

      <section
        id="main-content"
        tabIndex={-1}
        aria-label={tr(lang, "Плакат", "Плакат")}
        className="flex flex-col items-center gap-5 rounded-3xl border-2 border-ink bg-surface px-6 py-8 text-center print:min-h-[250mm] print:justify-center print:gap-10 print:rounded-none print:border-4"
      >
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight print:text-6xl">{shop.name}</h1>
        {shop.city && <p className="text-lg text-muted print:text-3xl">{shop.city}</p>}
        <p className="text-xl font-bold print:text-4xl">{tr(lang, "Закажите в WhatsApp", "WhatsApp-та тапсырыс беріңіз")}</p>
        <div
          role="img"
          aria-label={`${tr(lang, "QR-код", "QR-код")}: ${url}`}
          className="aspect-square w-full max-w-72 print:max-w-[130mm] [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <p className="text-base text-muted print:text-2xl">{tr(lang, "Наведите камеру телефона на QR-код", "Телефон камерасын QR-кодқа бағыттаңыз")}</p>
        <p className="break-all text-lg font-extrabold text-accent print:text-3xl">{url.replace(/^https?:\/\//, "")}</p>
        <p className="text-sm text-muted print:text-lg">{tr(lang, "Сделано в SÖRE", "SÖRE-де жасалған")}</p>
      </section>

      <div className="flex flex-col gap-2 print:hidden">
        <PrintButton />
        <p className="text-center text-sm text-muted">{tr(lang, "Откроется окно печати. Выберите размер A4 или A5 и принтер.", "Басып шығару терезесі ашылады. A4 немесе A5 өлшемін және принтерді таңдаңыз.")}</p>
      </div>
    </main>
  );
}
