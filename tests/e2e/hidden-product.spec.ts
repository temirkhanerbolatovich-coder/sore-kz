import { expect, test } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();

test("скрытый товар исчезает с витрины и из заказа, продавец видит его и может вернуть", async ({ page, request, browser }) => {
  const s = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `hide-${s}@example.test`;
  const slug = `hide-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Пирог", price: 1000 }, { title: "Торт", price: 4000 }] });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    const card = page.getByRole("listitem").filter({ hasText: "Торт" });
    await card.getByText("Действия с товаром").click();
    await card.getByRole("button", { name: "Скрыть с витрины" }).click();
    await expect(card.getByText("Скрыт с витрины", { exact: true })).toBeVisible();

    const { data: hidden } = await admin.from("products").select("id,is_hidden").eq("shop_id", shopId).eq("title", "Торт").single();
    expect(hidden?.is_hidden).toBe(true);

    // Покупатель: на витрине только «Пирог», страница скрытого товара не открывается.
    const buyer = await browser.newPage();
    await buyer.goto(`/${slug}`);
    await expect(buyer.getByRole("listitem").filter({ hasText: "Пирог" })).toBeVisible();
    await expect(buyer.getByText("Торт")).toHaveCount(0);
    const direct = await buyer.goto(`/${slug}/p/${hidden!.id}`);
    expect(direct?.status()).toBe(404);
    await buyer.close();

    // Фильтр «Скрытые» в кабинете.
    await page.getByRole("button", { name: "Скрытые", exact: true }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Торт" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Пирог" })).toHaveCount(0);

    // Вернуть на витрину.
    const again = page.getByRole("listitem").filter({ hasText: "Торт" });
    const show = again.getByRole("button", { name: "Показать на витрине" });
    if (!(await show.isVisible())) await again.getByText("Действия с товаром").click(); // меню могло остаться открытым
    await show.click();
    await expect.poll(async () => (await admin.from("products").select("is_hidden").eq("id", hidden!.id).single()).data?.is_hidden).toBe(false);
  } finally {
    await cleanupUser(admin, email);
  }
});
