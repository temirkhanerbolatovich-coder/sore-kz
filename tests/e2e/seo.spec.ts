import { expect, test } from "@playwright/test";

test("витрина и товар публикуют языковые ссылки, разметку и sitemap", async ({ page, request }) => {
  await page.goto("/demo?lang=kz");
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  const store = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}");
  expect(store["@type"]).toBe("Store");
  const shopPath = new URL(store.url).pathname;
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", store.url);
  await expect(page.locator('link[hreflang="ru"]')).toHaveAttribute("href", new URL(shopPath, store.url).href);

  const firstProduct = page.locator(`a[href^="${shopPath}/p/"]`).first();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/p\/[^?]+\?lang=kz$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "kk");
  const product = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}");
  expect(product["@type"]).toBe("Product");
  await expect(page.locator('link[hreflang="kk"]')).toHaveAttribute("href", product.url);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain(`<loc>${new URL(new URL(product.url).pathname, product.url).href}</loc>`);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});
