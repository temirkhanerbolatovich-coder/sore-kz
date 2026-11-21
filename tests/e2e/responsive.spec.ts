import { expect, test, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const widths = [360, 390, 768, 1024, 1440];

async function noHorizontalOverflow(page: Page, screen: string) {
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.document, `${screen}: горизонтальная прокрутка`).toBeLessThanOrEqual(dimensions.viewport);
}

for (const theme of ["light", "dark"] as const) {
  for (const width of widths) {
    test(`адаптивные экраны: ${width}px, ${theme}`, async ({ page, request }) => {
      test.setTimeout(120_000);
      const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const email = `responsive-${stamp}@example.test`;
      const slug = `responsive-${stamp}`;
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript((selectedTheme) => localStorage.setItem("sore-theme", selectedTheme), theme);
      try {
        const { products } = await seedShop(admin, {
          email,
          slug,
          products: [
            { title: "Торт для проверки адаптивной сетки", price: 12000 },
            { title: "Капкейки", price: 4500 },
            { title: "Печенье", price: 500 },
            { title: "Шоколад", price: 700 },
          ],
        });

        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("link", { name: "Посмотреть демо" })).toBeVisible();
        await noHorizontalOverflow(page, "лендинг");

        await page.goto(`/${slug}`);
        await expect(page.getByRole("heading", { name: "Регрессия" })).toBeVisible();
        const catalog = page.locator("main ul").filter({ has: page.getByText("Капкейки", { exact: true }) });
        await expect(catalog).toBeVisible();
        if (width >= 768) {
          const columns = await catalog.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length);
          expect(columns).toBe(width >= 1024 ? 4 : 3);
        }
        await noHorizontalOverflow(page, "витрина");

        await page.goto(`/${slug}/p/${products[0].id}`);
        await expect(page.getByRole("heading", { name: products[0].title })).toBeVisible();
        await expect(page.getByRole("button", { name: "В корзину", exact: true })).toBeVisible();
        await noHorizontalOverflow(page, "карточка товара");
        await page.getByRole("button", { name: "В корзину", exact: true }).click();
        await page.getByRole("link", { name: /Корзина/ }).click();
        await expect(page.getByRole("heading", { name: "Ваш заказ" })).toBeVisible();
        await expect(page.getByLabel("Телефон", { exact: true })).toBeVisible();
        await noHorizontalOverflow(page, "корзина");

        await loginAs(page, request, email);
        await page.goto("/dashboard");
        await expect(page.getByRole("heading", { name: /Товары/ })).toBeVisible();
        const nav = page.getByRole("navigation", { name: "Разделы кабинета" });
        await expect(nav).toBeVisible();
        const navBox = await nav.boundingBox();
        expect(navBox).not.toBeNull();
        if (navBox) {
          if (width >= 1024) {
            // На большом экране допустима боковая или верхняя навигация.
            expect(navBox.y < 422 || navBox.width < width / 2).toBe(true);
          } else {
            expect(navBox.y + navBox.height).toBeCloseTo(844, 0);
          }
        }
        await noHorizontalOverflow(page, "кабинет");

        for (const [url, title] of [
          ["/dashboard/products/shelf", "Фото полки"],
          ["/dashboard/products/import", "Прайс из Excel"],
        ]) {
          await page.goto(url);
          await expect(page.getByRole("heading", { name: title })).toBeVisible();
          await noHorizontalOverflow(page, title);
        }
      } finally {
        await cleanupUser(admin, email);
      }
    });
  }
}
