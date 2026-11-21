import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

// Живой вызов бесплатных ИИ-моделей расходует квоту ключей, поэтому запускается только по явной просьбе:
//   E2E_LIVE_AI=1 npx playwright test ai-live
test.skip(!process.env.E2E_LIVE_AI, "задайте E2E_LIVE_AI=1 и ИИ-ключ в .env.local");

test("настоящая ИИ-карточка по фото заполняет форму", async ({ page, request }) => {
  test.setTimeout(150_000);
  const admin = adminClient();
  const s = `${Date.now().toString(36)}`;
  const email = `ai-live-${s}@example.test`;
  await seedShop(admin, { email, slug: `ai-live-${s}` });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.locator('input[type="file"]').setInputFiles(process.env.E2E_AI_PHOTO ?? "reports/prague-test.png");
    await expect(page.getByAltText("Фото товара")).toBeVisible();
    await page.getByRole("button", { name: "Заполнить с ИИ" }).click();
    await expect(page.getByRole("status").filter({ hasText: "ИИ заполнил" })).toBeVisible({ timeout: 90_000 });
    expect((await page.getByLabel("Название", { exact: true }).inputValue()).length).toBeGreaterThan(2);
    expect((await page.getByLabel("Описание · RU").inputValue()).length).toBeGreaterThan(10);
    expect((await page.getByLabel("Описание · KZ").inputValue()).length).toBeGreaterThan(10);
    console.log("TITLE:", await page.getByLabel("Название", { exact: true }).inputValue());
    console.log("KZ:", await page.getByLabel("Описание · KZ").inputValue());
  } finally {
    await cleanupUser(admin, email);
  }
});
