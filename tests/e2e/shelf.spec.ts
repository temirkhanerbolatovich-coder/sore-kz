import { test, expect, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop, storedFiles } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const shelfItems = [
  { title: "Вода «Тассай» 1 л", description_ru: "Бутылка воды.", description_kz: "Су бөтелкесі.", category: "Напитки", bbox: { x1: 0.05, y1: 0.1, x2: 0.3, y2: 0.9 }, price_hint: 450, photo_url: null },
  { title: "Сок яблочный", description_ru: "Пакет сока.", description_kz: "Шырын қорабы.", category: "Напитки", bbox: { x1: 0.35, y1: 0.1, x2: 0.6, y2: 0.9 }, price_hint: null, photo_url: null },
  { title: "Печенье", description_ru: "Пачка печенья.", description_kz: "Печенье қорабы.", category: "Сладости", bbox: { x1: 0.65, y1: 0.2, x2: 0.95, y2: 0.8 }, price_hint: null, photo_url: null },
];

async function mockShelf(page: Page, items = shelfItems) {
  let calls = 0;
  await page.route("**/api/ai/shelf", (route) => {
    calls++;
    return route.fulfill({ json: { provider: "test", remaining: 10, items } });
  });
  return () => calls;
}

test("фото полки: черновики, правка, публикация выбранных и рамка на витрине", async ({ page, request }) => {
  const s = stamp();
  const email = `shelf-${s}@example.test`;
  const slug = `shelf-${s}`;
  const { ownerId, shopId } = await seedShop(admin, { email, slug });
  try {
    await loginAs(page, request, email);
    const calls = await mockShelf(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Добавить по фото полки" })).toHaveAttribute("href", "/dashboard/products/shelf");
    await page.goto("/dashboard/products/shelf");
    await page.waitForLoadState("networkidle");
    await page.locator("#shelf-file").setInputFiles("public/icon-512.png");

    await expect(page.getByLabel("Название 3")).toBeVisible({ timeout: 30_000 });
    expect(calls()).toBe(1);
    await page.getByRole("button", { name: "Перейти к товару 2", exact: true }).click();
    await expect(page.getByLabel("Название 2").locator("xpath=ancestor::li")).toBeFocused();
    await page.getByRole("button", { name: "Показать рамку 2", exact: true }).click();
    await expect(page.getByRole("button", { name: "Перейти к товару 2", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "Снять все", exact: true }).click();
    await expect(page.getByRole("button", { name: "Опубликовать выбранные (0)" })).toBeDisabled();
    await page.getByRole("button", { name: "Выбрать все", exact: true }).click();
    await expect(page.getByText("Нашли товаров: 3")).toBeVisible();
    await expect(page.getByText("Цену прочитали с ценника — проверьте её.")).toBeVisible();
    await expect(page.getByLabel("Цена 1, ₸")).toHaveValue("450");
    await expect(page.getByRole("button", { name: "Опубликовать выбранные (3)" })).toBeEnabled();

    // Третий товар не нужен, второму продавец даёт своё название и цену.
    await page.getByRole("checkbox", { name: "Выложить товар 3" }).click();
    await expect(page.getByRole("checkbox", { name: "Выложить товар 3" })).toHaveAttribute("aria-checked", "false");
    await page.getByLabel("Название 2").fill("Сок «Да-Да» яблоко");
    await page.getByRole("group", { name: "Цена 2" }).getByRole("button", { name: "Точная" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать выбранные (2)" })).toBeDisabled();
    await page.getByLabel("Цена 1, ₸").press("Enter");
    await expect(page.getByLabel("Цена 2, ₸")).toBeFocused();
    await page.getByLabel("Цена 2, ₸").fill("600");
    await page.getByRole("button", { name: "Опубликовать выбранные (2)" }).click();

    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByText("Товары · 2")).toBeVisible();

    const { data: rows } = await admin.from("products").select("title,price,price_mode,bbox,source_photo_url,photo_url,price_needs_review").eq("shop_id", shopId).order("sort");
    expect(rows).toHaveLength(2);
    expect(rows![0]).toMatchObject({ title: "Вода «Тассай» 1 л", price: 450, price_mode: "fixed", price_needs_review: true, bbox: shelfItems[0].bbox });
    expect(rows![1]).toMatchObject({ title: "Сок «Да-Да» яблоко", price: 600, price_needs_review: false });
    // Без вырезки товар показывает весь снимок полки, снимок один на оба товара.
    expect(rows![0].source_photo_url).toBe(rows![1].source_photo_url);
    expect(rows![0].photo_url).toBe(rows![0].source_photo_url);
    expect(rows![0].source_photo_url).toContain(`/product-photos/${ownerId}/`);

    await page.goto(`/${slug}`);
    await expect(page.getByText("Вода «Тассай» 1 л")).toBeVisible();
    await page.getByText("Вода «Тассай» 1 л").click();
    await expect(page.getByText("Так товар выглядит на полке")).toBeVisible();
    await expect(page.locator("figure img")).toHaveAttribute("src", rows![0].source_photo_url!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("фото полки: сверх бесплатного лимита выбрать нельзя", async ({ page, request }) => {
  const s = stamp();
  const email = `shelf-limit-${s}@example.test`;
  const { shopId } = await seedShop(admin, {
    email,
    slug: `shelf-limit-${s}`,
    products: Array.from({ length: 14 }, (_, i) => ({ title: `Товар ${i + 1}`, price: 100 + i })),
  });
  try {
    await loginAs(page, request, email);
    await mockShelf(page);
    await page.goto("/dashboard/products/shelf");
    await page.waitForLoadState("networkidle");
    await page.locator("#shelf-file").setInputFiles("public/icon-512.png");
    await expect(page.getByLabel("Название 3")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Опубликовать выбранные (1)" })).toBeEnabled();
    await page.getByRole("checkbox", { name: "Выложить товар 2" }).click();
    await expect(page.getByText("можно добавить ещё 1")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Выложить товар 2" })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "Опубликовать выбранные (1)" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
    expect(count).toBe(15);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("фото полки: ИИ ничего не нашёл — понятное сообщение и снимок не остаётся в хранилище", async ({ page, request }) => {
  const s = stamp();
  const email = `shelf-empty-${s}@example.test`;
  const { ownerId } = await seedShop(admin, { email, slug: `shelf-empty-${s}` });
  try {
    await loginAs(page, request, email);
    await page.route("**/api/ai/shelf", (route) =>
      route.fulfill({ status: 422, json: { error: "На фото не нашли товаров. Снимите полку ближе и при хорошем свете или добавьте товары вручную." } }),
    );
    await page.goto("/dashboard/products/shelf");
    await page.waitForLoadState("networkidle");
    await page.locator("#shelf-file").setInputFiles("public/icon-512.png");
    await expect(page.getByText("На фото не нашли товаров.", { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Снять заново", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Добавить вручную", exact: true })).toBeVisible();
    await expect.poll(() => storedFiles(admin, ownerId)).toEqual([]);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("фото полки: без входа маршрут ИИ закрыт", async ({ request }) => {
  const response = await request.post("/api/ai/shelf", { data: { photo_url: "https://example.test/a.jpg" } });
  expect([401, 503]).toContain(response.status());
});
