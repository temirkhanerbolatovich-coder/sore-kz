import type { Metadata, Viewport } from "next";
import "@fontsource/onest/400.css";
import "@fontsource/onest/600.css";
import "@fontsource/onest/700.css";
import "@fontsource/onest/800.css";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeInitializer } from "@/components/theme-toggle";
import "./globals.css";
import "./motion.css";


const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const UMAMI_DOMAIN = siteUrl && URL.canParse(siteUrl) ? new URL(siteUrl).hostname : undefined;

export const metadata: Metadata = {
  icons: { apple: "/apple-touch-icon.png" },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "SÖRE — ваша полка в интернете",
  description:
    "Одно фото полки или прайс из Excel, карточки с помощью ИИ и витрина по ссылке с заказами в WhatsApp и Telegram.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff8f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17110c" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Тема выставляется до первой отрисовки, чтобы не было вспышки светлой темы у тех, кто выбрал тёмную.
 * Выбор пользователя (кнопка-переключатель) хранится в localStorage, без него действует тема системы.
 */
const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem("sore-theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: атрибут data-theme ставит скрипт до React, это ожидаемое расхождение.
    <html lang="ru" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link"><span lang="ru">К содержимому</span><span lang="kk">Негізгі мазмұнға өту</span></a>
        <ThemeInitializer />
        {children}
        {/* Umami Cloud: без cookie, уважает Do Not Track, считает только боевой домен. Включается переменной NEXT_PUBLIC_UMAMI_ID. */}
        {UMAMI_ID && (
          <Script
            src="https://cloud.umami.is/script.js"
            strategy="afterInteractive"
            data-website-id={UMAMI_ID}
            data-do-not-track="true"
            {...(UMAMI_DOMAIN ? { "data-domains": UMAMI_DOMAIN } : {})}
          />
        )}
        {/* Счётчики Vercel работают только на Vercel; на других хостингах их запросы дали бы 404. */}
        {process.env.VERCEL === "1" && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
