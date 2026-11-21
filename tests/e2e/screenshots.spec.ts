import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import { cropShelfPhoto } from "../../src/lib/shelf-crops";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

/**
 * Скриншоты ключевых экранов в reports/ui-polish/: обе темы, 390/768/1440 CSS px.
 * Только локальные тестовые данные; ИИ и внешние переходы подменены.
 * PowerShell: $env:E2E_SCREENSHOTS="1"; npx playwright test tests/e2e/screenshots.spec.ts
 */
test.skip(!process.env.E2E_SCREENSHOTS, "Скриншоты для отчёта: нужна переменная E2E_SCREENSHOTS=1");

const admin = adminClient();
const OUT = "reports/ui-polish";
const MAX_IMAGE_BYTES = 300_000;
const uniquePhone = () => `8701${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`; // лимит create_order: 10 заказов в час на номер
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Полка 900×600: товары нарисованы фигурами, рамки заданы в долях кадра.
const PRODUCTS = [
  { title: "Вода «Тассай» 1 л", category: "Напитки", color: "#3f8fd2", box: [60, 60, 170, 205], price: 450 },
  { title: "Сок яблочный 1 л", category: "Напитки", color: "#e6a935", box: [200, 80, 330, 205], price: null },
  { title: "Печенье «Юбилейное»", category: "Сладости", color: "#b8743c", box: [370, 110, 540, 205], price: null },
  { title: "Чай чёрный 100 пакетиков", category: "Продукты", color: "#2f7d5b", box: [580, 90, 700, 205], price: 1200 },
  { title: "Шоколад молочный", category: "Сладости", color: "#7a3b2e", box: [100, 280, 260, 405], price: null },
  { title: "Макароны 400 г", category: "Продукты", color: "#d9b84a", box: [320, 250, 470, 405], price: 380 },
];
const W = 900;
const H = 600;

async function shelfImage() {
  const shapes = PRODUCTS.map((p) => {
    const [x1, y1, x2, y2] = p.box;
    return `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" rx="14" fill="${p.color}"/><rect x="${x1 + 12}" y="${y1 + (y2 - y1) * 0.35}" width="${x2 - x1 - 24}" height="${(y2 - y1) * 0.3}" rx="6" fill="#fff" opacity=".85"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#efe3d2"/><rect y="205" width="${W}" height="16" fill="#8b6a4a"/><rect y="405" width="${W}" height="16" fill="#8b6a4a"/><rect y="585" width="${W}" height="15" fill="#8b6a4a"/>${shapes}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
}

async function shot(page: Page, name: string, theme: string, width: number) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Загружаем кабинет…", { exact: true })).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png", fullPage: true, animations: "disabled", scale: "css" });
  // Сохраняем исходную ширину: сначала уменьшаем качество, а не масштаб экрана.
  for (let quality = 80; quality >= 20; quality -= 10) {
    const jpeg = await sharp(png).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (jpeg.length < MAX_IMAGE_BYTES) {
      await writeFile(`${OUT}/${name}-${theme}-${width}.jpg`, jpeg);
      return;
    }
  }
  throw new Error(`Скриншот ${name}-${theme}-${width} больше 300 КБ даже при минимальном качестве`);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 768, 1440]) {
  test(`скриншоты: ${theme}, ${width} px`, async ({ browser, request }) => {
    test.setTimeout(240_000);
    await mkdir(OUT, { recursive: true });
    const s = stamp();
    const email = `shots-${theme}-${s}@example.test`;
    const slug = `shots-${theme}-${s}`;
    const { ownerId, shopId } = await seedShop(admin, { email, slug });
    await admin.from("shops").update({ name: "Сладкий дом Алии", city: "Алматы", telegram_username: "aliya_sweets", about: "Домашние сладости и продукты у дома." }).eq("id", shopId);
    const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, permissions: ["clipboard-read", "clipboard-write"] });
    await ctx.addInitScript((t) => localStorage.setItem("sore-theme", t), theme);
    await ctx.route("https://t.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Telegram</title>" }));
    await ctx.route("https://wa.me/**", (route) => route.fulfill({ status: 204 }));
    const page = await ctx.newPage();
    try {
      // 1. Лендинг
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shot(page, "01-landing", theme, width);

      // 2. Фото полки: выбор, черновики
      await loginAs(page, request, email);
      await page.goto("/dashboard");
      await shot(page, "02-dashboard-empty", theme, width);
      await page.route("**/api/ai/shelf", async (route) => {
        const { photo_url } = route.request().postDataJSON() as { photo_url: string };
        const path = new URL(photo_url).pathname.split("/product-photos/")[1];
        const blob = (await admin.storage.from("product-photos").download(path)).data!;
        const boxes = PRODUCTS.map((p) => ({ x1: p.box[0] / W, y1: p.box[1] / H, x2: p.box[2] / W, y2: p.box[3] / H }));
        const crops = await cropShelfPhoto(Buffer.from(await blob.arrayBuffer()), boxes);
        const items = await Promise.all(
          PRODUCTS.map(async (p, i) => {
            let url: string | null = null;
            const crop = crops[i];
            if (crop) {
              const file = `${ownerId}/${randomUUID()}.jpg`;
              await admin.storage.from("product-photos").upload(file, crop.full, { contentType: "image/jpeg" });
              await admin.storage.from("product-photos").upload(file.replace(".jpg", "_s.jpg"), crop.thumb, { contentType: "image/jpeg" });
              url = admin.storage.from("product-photos").getPublicUrl(file).data.publicUrl;
            }
            return { title: p.title, description_ru: "Товар на полке.", description_kz: "Сөредегі тауар.", category: p.category, bbox: boxes[i], price_hint: p.price, photo_url: url };
          }),
        );
        await route.fulfill({ json: { provider: "test", remaining: 10, items } });
      });
      await page.goto("/dashboard/products/shelf");
      await page.waitForLoadState("networkidle");
      await shot(page, "03-shelf-start", theme, width);
      await page.locator("#shelf-file").setInputFiles({ name: "shelf.jpg", mimeType: "image/jpeg", buffer: await shelfImage() });
      await expect(page.getByLabel("Название 6")).toBeVisible({ timeout: 30_000 });
      await shot(page, "04-shelf-frames", theme, width);
      await page.getByLabel("Название 1").scrollIntoViewIfNeeded();
      await page.getByLabel("Название 2").fill("Сок «Да-Да» яблочный 1 л");
      await page.getByRole("group", { name: "Цена 2" }).getByRole("button", { name: "Точная" }).click();
      await page.getByLabel("Цена 2, ₸").fill("600");
      await page.getByRole("checkbox", { name: "Выложить товар 6" }).scrollIntoViewIfNeeded();
      await shot(page, "05-shelf-drafts", theme, width);
      for (const n of [3, 5]) {
        await page.getByRole("group", { name: `Цена ${n}` }).getByRole("button", { name: "Точная" }).click();
        await page.getByLabel(`Цена ${n}, ₸`).fill(String(n * 300));
      }
      await page.getByRole("button", { name: /Опубликовать выбранные/ }).click();
      await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
      await shot(page, "06-dashboard-products", theme, width);

      // 3. Импорт прайса с ошибками
      await page.goto("/dashboard/products/import");
      await page.waitForLoadState("networkidle");
      await shot(page, "07-import-start", theme, width);
      await page.locator("#import-file").setInputFiles({ name: "price.csv", mimeType: "text/csv", buffer: Buffer.from("Название;Цена;Артикул;Категория\nХлеб белый;250;BR-1;Выпечка\nСухари;180;BR-2;Выпечка\n;100;BR-3;\nМолоко 1 л;abc;MI-1;Молочное\nКефир;310;MI-2;Молочное\n", "utf8") });
      await page.getByRole("button", { name: "Загрузить прайс" }).click();
      await expect(page.getByRole("status", { name: "Итог загрузки" })).toContainText("Добавлено: 3");
      await shot(page, "08-import-result", theme, width);

      // 4. Витрина, карточка с полкой
      await page.goto(`/${slug}`);
      await expect(page.getByText("Вода «Тассай» 1 л")).toBeVisible();
      await shot(page, "09-storefront", theme, width);
      await page.getByText("Вода «Тассай» 1 л").click();
      await expect(page.getByText("Так товар выглядит на полке")).toBeVisible();
      await shot(page, "10-product", theme, width);

      // 5. Заказ: WhatsApp и Telegram
      const buyer = await ctx.newPage();
      await buyer.clock.install();
      await buyer.goto(`/${slug}`);
      await buyer.getByRole("listitem").filter({ hasText: "Вода «Тассай» 1 л" }).getByRole("button", { name: "В корзину", exact: true }).click();
      await buyer.getByRole("link", { name: /Корзина/ }).click();
      await buyer.getByLabel("Имя", { exact: true }).fill("Айгерим");
      await buyer.getByLabel("Телефон", { exact: true }).fill(uniquePhone());
      await buyer.getByLabel("Адрес", { exact: true }).fill("Абай 10");
      await shot(buyer, "11-cart", theme, width);
      await buyer.clock.fastForward(2_000);
      await buyer.getByRole("button", { name: /Заказать в WhatsApp/ }).click();
      await expect(buyer.getByRole("heading", { name: /Заказ принят/ })).toBeVisible();
      await shot(buyer, "12-order-done", theme, width);
      await buyer.getByRole("link", { name: "Следить за заказом" }).click();
      await expect(buyer.getByRole("heading", { name: /Заказ №/ })).toBeVisible();
      await shot(buyer, "13-order-status", theme, width);
    } finally {
      await ctx.close();
      await cleanupUser(admin, email);
    }
  });
  }
}
