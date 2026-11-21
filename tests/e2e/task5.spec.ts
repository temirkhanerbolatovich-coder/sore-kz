import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";
const admin = adminClient();

for (const theme of ["light", "dark"]) {
  test(`Task 5: первый магазин и выбор товаров (${theme})`, async ({ page, request }) => {
    const id = Date.now().toString(36);
    const email = `onboard-${theme}-${id}@example.test`;
    await admin.auth.admin.createUser({ email, email_confirm: true });
    try {
      await page.addInitScript((value) => localStorage.setItem("sore-theme", value), theme);
      await loginAs(page, request, email);
      await expect(page.getByText(/Шаг 1 из 2/)).toBeVisible();
      await page.getByLabel("Название магазина").fill("Первый магазин");
      await page.getByLabel("Адрес ссылки").fill(`first-${theme}-${id}`);
      await page.getByLabel("Номер WhatsApp").fill("87011234567");
      await expect(page.getByLabel("Номер WhatsApp")).toHaveValue("+7 701 123 45 67");
      await page.getByRole("button", { name: "Создать магазин", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Как добавить товары?" })).toBeVisible();
      for (const [name, path] of [["Фото полки", "shelf"], ["Прайс из Excel", "import"], ["По одному", "new"]]) {
        await expect(page.locator('[aria-labelledby="add-products"]').getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", `/dashboard/products/${path}`);
      }
      await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
    } finally { await cleanupUser(admin, email); }
  });
}

for (const input of ["mouse", "touch"]) test(`Task 5: каталог, перетаскивание (${input}) и цена`, async ({ page, request }) => {
  const id = Date.now().toString(36);
  const email = `catalog-${id}@example.test`;
  const { products, shopId } = await seedShop(admin, { email, slug: `catalog-${id}`, products: [{ title: "Первый", price: 1000 }, { title: "Второй", price: 2000, in_stock: false }, { title: "Третий", price: 3000 }] });
  await admin.from("products").update({ price_needs_review: true }).eq("id", products[2].id);
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard");
    const catalog = page.getByRole("region", { name: "Каталог товаров" });
    await page.getByLabel("Найти товар").fill("втор");
    await expect(catalog.locator("li")).toHaveCount(1);
    await page.getByLabel("Найти товар").fill("");
    await catalog.getByRole("button", { name: "Цена не проверена", exact: true }).click();
    await expect(catalog.locator("li")).toHaveCount(1);
    await expect(catalog.locator("li")).toContainText("Третий");
    await catalog.getByRole("button", { name: "Все", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 1000 });
    await catalog.locator("li").nth(1).scrollIntoViewIfNeeded();
    const handle = await page.getByRole("button", { name: "Переместить: Первый", exact: true }).boundingBox();
    const destination = await catalog.locator("li").nth(1).boundingBox();
    if (input === "mouse") {
    await page.mouse.move(handle!.x + 20, handle!.y + 20);
    await page.mouse.down();
    await page.mouse.move(destination!.x + 30, destination!.y + 30, { steps: 8 });
    await page.mouse.up();
    } else {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: handle!.x + 20, y: handle!.y + 20 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: destination!.x + 30, y: destination!.y + 30 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    }
    await expect(catalog.getByRole("status")).toContainText("Порядок сохранён");
    const { data } = await admin.from("products").select("title").eq("shop_id", shopId).order("sort");
    expect(data?.map((row) => row.title)).toEqual(["Второй", "Первый", "Третий"]);
    await page.goto(`/dashboard/products/${products[0].id}/edit`);
    await page.getByLabel("Цена, ₸", { exact: true }).fill("12000");
    await expect(page.getByLabel("Цена, ₸", { exact: true })).toHaveValue("12 000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard\?saved=updated/);
    const result = await admin.from("products").select("price").eq("id", products[0].id).single();
    expect(result.data?.price).toBe(12000);
  } finally { await cleanupUser(admin, email); }
});

test("Task 5: FAQ открывается клавиатурой", async ({ page }) => {
  await page.goto("/");
  const question = page.locator("summary").filter({ hasText: "Как покупатель оплатит заказ?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Оплаты на сайте нет.", { exact: false })).toBeVisible();
});

for (const storage of ["available", "blocked"]) {
  test(`Task 5: подсказка главного экрана, storage ${storage}`, async ({ page, request }) => {
    const id = Date.now().toString(36);
    const email = `hint-${storage}-${id}@example.test`;
    await seedShop(admin, { email, slug: `hint-${storage}-${id}` });
    try {
      if (storage === "blocked") await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage blocked", "SecurityError"); } });
      });
      await loginAs(page, request, email);
      const hint = page.getByRole("complementary", { name: "Быстрый доступ к магазину" });
      await expect(hint).toBeVisible();
      await hint.getByRole("button", { name: "Понятно" }).click();
      await expect(hint).toHaveCount(0);
      if (storage === "available") {
        await page.reload();
        await expect(page.getByRole("heading", { name: "Как добавить товары?" })).toBeVisible();
        await expect(hint).toHaveCount(0);
      }
    } finally { await cleanupUser(admin, email); }
  });
}
