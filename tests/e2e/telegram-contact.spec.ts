import { test, expect, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const uniquePhone = () => `8701${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`; // у create_order лимит 10 заказов в час на номер, поэтому номер у каждого заказа свой
const addToCart = (page: Page, title: string, label = "В корзину") =>
  page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: label, exact: true }).click();

async function placeOrder(page: Page, base: string, slug: string) {
  await page.goto(`${base}/${slug}`);
  await addToCart(page, "Торт");
  await page.getByRole("link", { name: /Корзина/ }).click();
  await page.getByLabel("Имя", { exact: true }).fill("Айгерим");
  await page.getByLabel("Телефон", { exact: true }).fill(uniquePhone());
  await page.getByLabel("Адрес", { exact: true }).fill("Абай 10");
  // 204 оставляет страницу на месте (иначе браузер ушёл бы на wa.me), так виден экран «Заказ принят».
  await page.route("https://wa.me/**", (route) => route.fulfill({ status: 204 }));
  await page.clock.fastForward(2_000);
  await page.getByRole("button", { name: /Заказать в WhatsApp/ }).click();
  await expect(page.getByRole("heading", { name: /Заказ принят/ })).toBeVisible();
}

test("Telegram продавца: настройки с проверкой ника", async ({ page, request }) => {
  const s = stamp();
  const email = `tg-set-${s}@example.test`;
  const { shopId } = await seedShop(admin, { email, slug: `tg-set-${s}` });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    const field = page.getByLabel("Telegram для покупателей (ник или ссылка, по желанию)");
    await expect(field).toHaveValue("");

    // Неверный ввод не сохраняется и объясняется.
    await field.fill("https://t.me/+AbCdEfGhIj");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Telegram: укажите ник");
    expect((await admin.from("shops").select("telegram_username").eq("id", shopId).single()).data?.telegram_username).toBeNull();

    // Ссылка приводится к чистому нику и показывается как @ник.
    await field.fill("https://t.me/aliya_sweets?start=x");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByRole("status")).toContainText("Настройки сохранены");
    expect((await admin.from("shops").select("telegram_username").eq("id", shopId).single()).data?.telegram_username).toBe("aliya_sweets");
    await page.reload();
    await expect(field).toHaveValue("@aliya_sweets");

    // Пустое поле убирает ник.
    await field.fill("");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByRole("status")).toContainText("Настройки сохранены");
    expect((await admin.from("shops").select("telegram_username").eq("id", shopId).single()).data?.telegram_username).toBeNull();

    // Ограничение в базе тоже держит формат (защита, если форму обошли).
    const { error } = await admin.from("shops").update({ telegram_username: "bad name" }).eq("id", shopId);
    expect(error?.message).toContain("shops_telegram_username_format");
  } finally {
    await cleanupUser(admin, email);
  }
});

test("после заказа два канала: WhatsApp и Telegram с копированием текста заказа", async ({ browser }) => {
  const s = stamp();
  const email = `tg-buy-${s}@example.test`;
  const slug = `tg-buy-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Торт", price: 4000 }] });
  await admin.from("shops").update({ telegram_username: "aliya_sweets" }).eq("id", shopId);
  const base = test.info().project.use.baseURL!;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.route("https://t.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Telegram</title>" }));
  const buyer = await ctx.newPage();
  await buyer.clock.install();
  try {
    await placeOrder(buyer, base, slug);
    await expect(buyer.getByRole("link", { name: "Открыть WhatsApp" })).toBeVisible();
    const telegram = buyer.getByRole("link", { name: "Написать в Telegram" });
    await expect(telegram).toHaveAttribute("href", "https://t.me/aliya_sweets");
    await expect(telegram).toHaveAttribute("target", "_blank");
    await expect(telegram).toHaveAttribute("rel", /noopener/);

    const [popup] = await Promise.all([ctx.waitForEvent("page"), telegram.click()]);
    await expect(popup).toHaveURL("https://t.me/aliya_sweets");
    await expect(buyer.getByText("Текст заказа скопирован")).toBeVisible();
    const copied = await buyer.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Здравствуйте! Заказ из SÖRE (№1)");
    expect(copied).toContain("Торт × 1");
    expect(copied).toContain("Итого: 4 000 ₸");
    await popup.close();

    // В запасном пути textarea временно получает фокус: после копирования он возвращается ссылке.
    await telegram.focus();
    await buyer.evaluate(() => {
      Object.defineProperty(navigator.clipboard, "writeText", { configurable: true, value: () => Promise.reject(new Error("blocked")) });
      document.execCommand = () => true;
      document.querySelector('a[href="https://t.me/aliya_sweets"]')?.addEventListener("click", (event) => event.preventDefault(), { once: true });
    });
    await buyer.keyboard.press("Enter");
    await expect(telegram).toBeFocused();

    // Страница статуса заказа: те же два канала.
    await buyer.getByRole("link", { name: "Следить за заказом" }).click();
    await expect(buyer.getByRole("link", { name: "Написать продавцу" })).toBeVisible();
    await expect(buyer.getByRole("link", { name: "Написать в Telegram" })).toHaveAttribute("href", "https://t.me/aliya_sweets");
    expect(await buyer.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

    // Казахская витрина: подписи на казахском.
    await buyer.goto(`${buyer.url().split("?")[0]}?lang=kz`);
    await expect(buyer.getByRole("link", { name: "Telegram-да жазу" })).toBeVisible();
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});

test("без ника Telegram у покупателя остаётся только WhatsApp", async ({ browser }) => {
  const s = stamp();
  const email = `tg-none-${s}@example.test`;
  const slug = `tg-none-${s}`;
  await seedShop(admin, { email, slug, products: [{ title: "Торт", price: 4000 }] });
  const base = test.info().project.use.baseURL!;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyer = await ctx.newPage();
  await buyer.clock.install();
  try {
    await placeOrder(buyer, base, slug);
    await expect(buyer.getByRole("link", { name: "Открыть WhatsApp" })).toBeVisible();
    await expect(buyer.getByRole("link", { name: /Telegram/ })).toHaveCount(0);
    await buyer.getByRole("link", { name: "Следить за заказом" }).click();
    await expect(buyer.getByRole("link", { name: "Написать продавцу" })).toBeVisible();
    await expect(buyer.getByRole("link", { name: /Telegram/ })).toHaveCount(0);
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});
