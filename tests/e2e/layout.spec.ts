import { test, expect, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();

/** Элементы управления меньше 44×44 px (кроме скрытых и инлайн-ссылок внутри текста). */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    const sel = 'button, a.btn-accent, a.btn-dark, a.btn-outline, a.btn-wa, nav a, input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea';
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && !el.closest("[hidden]");
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { label: (el.getAttribute("aria-label") || el.textContent || el.id || el.tagName).trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((t) => t.h < 44 || t.w < 44);
  });
}

const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const [width, height] of [[360, 640], [390, 844]]) {
  test(`экраны продавца и покупателя: без переполнения и мелких кнопок при ${width}×${height}`, async ({ page, request, browser }) => {
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const email = `layout-${stamp}@example.test`;
    const slug = `layout-${stamp}`;
    await seedShop(admin, {
      email,
      slug,
      products: [
        { title: "Торт «Прага» с очень длинным названием для проверки переноса строк", price: 12000 },
        { title: "Капкейки", price: 4500, in_stock: false },
      ],
    });
    const problems: string[] = [];
    const check = async (p: Page, name: string) => {
      if (!(await noOverflow(p))) problems.push(`${name}: горизонтальный скролл`);
      for (const t of await smallTargets(p)) problems.push(`${name}: «${t.label}» ${t.w}×${t.h}`);
    };
    try {
      await page.setViewportSize({ width, height });
      await loginAs(page, request, email);
      for (const url of ["/dashboard", "/dashboard/products/new", "/dashboard/orders", "/dashboard/settings"]) {
        await page.goto(url);
        await expect(page.locator("h1, h2").first()).toBeVisible();
        await check(page, url);
      }

      // Форма с редактором вариантов (раньше fieldset распирал её шире экрана).
      await page.goto("/dashboard/products/new");
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: /У товара несколько цен/ }).click();
      await page.getByRole("button", { name: "+ Ещё вариант" }).click();
      await check(page, "/форма с вариантами");
      await page.goto("/dashboard/products/batch");
      await check(page, "/несколько фото");

      const ctx = await browser.newContext({ viewport: { width, height } });
      const buyer = await ctx.newPage();
      const base = test.info().project.use.baseURL;
      await buyer.goto(`${base}/${slug}`);
      await check(buyer, "/витрина");
      await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
      await check(buyer, "/витрина с корзиной");
      await buyer.getByRole("link", { name: /Корзина/ }).click();
      await expect(buyer.getByRole("heading", { name: "Ваш заказ" })).toBeVisible();
      await check(buyer, "/корзина");
      await ctx.close();
      expect(problems).toEqual([]);
    } finally {
      await cleanupUser(admin, email);
    }
  });
}
