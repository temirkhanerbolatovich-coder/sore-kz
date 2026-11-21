import { expect, test } from "@playwright/test";
import { formatPrice } from "../../src/lib/order";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test("витрина сразу показывает новые цену, наличие и название магазина", async ({ page, browser, request, baseURL }) => {
  const slug = `shop-cache-${stamp()}`;
  const email = `${slug}@example.test`;
  const admin = adminClient();
  const title = "Товар для проверки кэша";
  const { products: [product] } = await seedShop(admin, { email, slug, products: [{ title, price: 2000 }] });
  const customer = await browser.newContext();
  try {
    const storefront = await customer.newPage();
    const url = `${baseURL}/${slug}`;
    await storefront.goto(url);
    await expect(storefront.getByText(formatPrice(2000), { exact: true })).toBeVisible();

    await loginAs(page, request, email);
    await page.goto(`/dashboard/products/${product.id}/edit`);
    await page.getByLabel("Цена, ₸", { exact: true }).fill("3000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/dashboard\?saved=updated/);
    await storefront.reload();
    await expect(storefront.getByText(formatPrice(3000), { exact: true })).toBeVisible();

    const stock = page.getByRole("switch", { name: `В наличии: ${title}` });
    await stock.click();
    await expect(stock).toHaveAttribute("aria-checked", "false");
    await storefront.reload();
    await expect(storefront.getByText("Нет в наличии", { exact: true })).toBeVisible();

    await page.goto("/dashboard/settings");
    await page.getByLabel("Название магазина").fill("Новое название магазина");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByText("Настройки сохранены.", { exact: true })).toBeVisible();
    await storefront.reload();
    await expect(storefront.getByRole("heading", { name: "Новое название магазина" })).toBeVisible();
  } finally {
    await customer.close();
    await cleanupUser(admin, email);
  }
});

test("после создания магазин открывается сразу, а после удаления пропадает из витрины", async ({ page, request }) => {
  const slug = `shop-life-${stamp()}`;
  const email = `${slug}@example.test`;
  const storefront = `/${slug}`;
  const admin = adminClient();
  try {
    const missing = await request.get(storefront);
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain("Такой страницы нет");
    await loginAs(page, request, email);
    await expect(page).toHaveURL(/dashboard\/onboarding/);
    await page.getByLabel("Название магазина").fill("Новая витрина");
    await page.getByLabel("Адрес ссылки").fill(slug);
    await page.getByLabel("Номер WhatsApp").fill("87011234567");
    await page.getByRole("button", { name: "Создать магазин" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const created = await request.get(storefront);
    expect(created.status()).toBe(200);
    expect(await created.text()).toContain("Новая витрина");

    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "Удалить магазин и аккаунт" }).click();
    await page.getByLabel(/Для подтверждения введите адрес/).fill(slug);
    await page.getByRole("button", { name: "Удалить навсегда" }).click();
    await expect(page).toHaveURL(/\/\?deleted=1$/);
    const removed = await request.get(storefront);
    expect(removed.status()).toBe(404);
    expect(await removed.text()).toContain("Такой страницы нет");
  } finally {
    await cleanupUser(admin, email);
  }
});
