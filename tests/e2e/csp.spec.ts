import { expect, test, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

async function collectViolations(page: Page, violations: string[]) {
  await page.exposeFunction("captureCspViolation", (value: string) => { violations.push(value); });
  await page.addInitScript(() => {
    const browser = window as Window & { captureCspViolation?(value: string): Promise<void> };
    document.addEventListener("securitypolicyviolation", (event) => {
      void browser.captureCspViolation?.(`${location.pathname} ${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
}

test("витрина, заказ, загрузка фото и кабинет работают без нарушений CSP", async ({ page, browser, request }) => {
  const admin = adminClient();
  const slug = `csp-${Date.now().toString(36)}`;
  const email = `${slug}@example.test`;
  const title = "Торт для CSP";
  const violations: string[] = [];
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 } });
  try {
    await seedShop(admin, { email, slug });
    await collectViolations(page, violations);
    const landing = await page.goto("/");
    const headers = landing?.headers() ?? {};
    expect(headers["content-security-policy-report-only"] ?? headers["content-security-policy"]).toContain("report-uri /api/csp-report");

    await loginAs(page, request, email);
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    await expect(page.getByAltText("Фото товара")).toBeVisible();
    await expect.poll(() => page.getByAltText("Фото товара").evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await page.getByLabel("Название", { exact: true }).fill(title);
    await page.getByLabel("Цена, ₸").fill("12000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);

    await page.route("**/api/ai/product-card", (route) => route.fulfill({ json: {
      card: { title: "Пакетное фото", description_ru: "Описание", description_kz: "Сипаттама", category: "Торты", tags: [] }, remaining: 19,
    } }));
    await page.goto("/dashboard/products/batch");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    await expect(page.getByAltText("Фото 1", { exact: true })).toBeVisible();
    await expect.poll(() => page.getByAltText("Фото 1", { exact: true }).evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

    await page.goto("/dashboard/settings");
    await expect(page.locator("canvas")).toBeVisible();
    await page.waitForLoadState("networkidle");

    const buyer = await context.newPage();
    await buyer.clock.install();
    await collectViolations(buyer, violations);
    await buyer.goto(`/${slug}`);
    await buyer.getByRole("link", { name: new RegExp(title) }).click();
    await expect(buyer.getByRole("heading", { name: title })).toBeVisible();
    await buyer.waitForLoadState("networkidle");
    await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await buyer.getByLabel("Имя", { exact: true }).fill("Айгерим");
    await buyer.getByLabel("Телефон", { exact: true }).fill("87019998877");
    await buyer.getByLabel("Адрес", { exact: true }).fill("ул. Абая 10");
    let order = "";
    await buyer.route("https://wa.me/**", (route) => { order = route.request().url(); return route.abort(); });
    await buyer.clock.fastForward(2_000);
    await buyer.getByRole("button", { name: "Заказать в WhatsApp" }).click();
    await expect.poll(() => order).toContain("wa.me/77011234567");
    await buyer.waitForLoadState("networkidle");
    expect(violations).toEqual([]);
  } finally {
    await context.close();
    await cleanupUser(admin, email);
  }
});
