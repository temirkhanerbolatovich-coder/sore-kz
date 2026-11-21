/**
 * Скриншоты для README с боевого сайта (или любого другого адреса): публичные страницы демо-магазинов.
 *
 *   npx tsx scripts/readme-screenshots.ts [https://dukenai.vercel.app]
 *
 * Пишет JPEG в docs/screenshots/. Телефон 390×844 в двойной плотности, десктоп 1440×900.
 * Нужен Chromium Playwright: npx playwright install chromium.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

const BASE = (process.argv[2] ?? process.env.SCREENSHOT_BASE_URL ?? "https://dukenai.vercel.app").replace(/\/$/, "");
const OUT = "docs/screenshots";
const SHOP = "/demo-bauyrsak";
const SHOP_DARK = "/demo-gulzar";

type Shot = { name: string; path: string; theme: "light" | "dark"; desktop?: boolean; before?: (page: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: "landing", path: "/", theme: "light" },
  { name: "storefront-light", path: SHOP, theme: "light" },
  { name: "storefront-dark", path: SHOP_DARK, theme: "dark" },
  {
    name: "product",
    path: SHOP,
    theme: "light",
    before: async (page) => {
      await page.locator(`a[href^="${SHOP}/p/"]`).nth(4).click();
      await page.waitForURL(/\/p\//);
    },
  },
  {
    name: "cart",
    path: SHOP,
    theme: "light",
    before: async (page) => {
      // Две позиции с фиксированной ценой, затем корзина: в демо вместо отправки заказа пометка.
      // После нажатия кнопка превращается в счётчик, поэтому каждый раз берём первую оставшуюся.
      const add = page.getByRole("button", { name: "В корзину" });
      await add.first().click();
      await add.first().click();
      await page.goto(`${BASE}${SHOP}/cart`);
    },
  },
  { name: "storefront-desktop", path: "/demo-oyu", theme: "light", desktop: true },
];

async function shoot(browser: Browser, shot: Shot) {
  const context = await browser.newContext(
    shot.desktop
      ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: shot.theme, locale: "ru-RU" }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: shot.theme, locale: "ru-RU" },
  );
  const page = await context.newPage();
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  if (shot.before) await shot.before(page);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  // Ленивые картинки: прокрутить до конца экрана и обратно.
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 600));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  const jpeg = await sharp(png).resize({ width: shot.desktop ? 1440 : 780 }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  await writeFile(`${OUT}/${shot.name}.jpg`, jpeg);
  console.log(`✔ ${shot.name}.jpg ${Math.round(jpeg.length / 1024)} КБ`);
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) await shoot(browser, shot);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
