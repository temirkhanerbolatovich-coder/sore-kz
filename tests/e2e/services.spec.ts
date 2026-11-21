import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test("продавец создаёт услугу «от», покупатель пишет в WhatsApp, а в корзину она не попадает", async ({ page, request, browser }) => {
  const s = stamp();
  const email = `svc-${s}@example.test`;
  const slug = `svc-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Торт обычный", price: 9000 }] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    // Продавец: «Цена от» и «По запросу» через форму.
    await loginAs(page, request, email);
    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Название", { exact: true }).fill("Повар на выезд");
    await page.getByText("От", { exact: true }).click();
    await expect(page.getByLabel("Цена от, ₸")).toBeVisible();
    await page.getByLabel("Цена от, ₸").fill("15000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByText("от 15 000 ₸")).toBeVisible();

    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Название", { exact: true }).fill("Торты на заказ");
    await page.getByText("По запросу", { exact: true }).click();
    await expect(page.getByLabel(/Цена/)).toHaveCount(0); // поле цены скрыто
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByText("Цена по запросу")).toBeVisible();

    await page.goto(`/${slug}`);
    await page.waitForLoadState("networkidle");
    expect((await admin.from("events").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("type", "view")).count).toBe(0);

    // Покупатель: вместо «В корзину» кнопка «Узнать цену» с готовым текстом.
    const buyer = await ctx.newPage();
    const base = test.info().project.use.baseURL;
    await buyer.goto(`${base}/${slug}`);
    await buyer.waitForLoadState("networkidle"); // обработчик клика появляется после гидратации
    // Просмотр витрины записывается (раньше запрос не отправлялся, и «Просмотры» всегда были 0).
    await expect
      .poll(async () => (await admin.from("events").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("type", "view")).count)
      .toBe(1);
    const service = buyer.getByRole("listitem").filter({ hasText: "Повар на выезд" });
    await expect(service.getByText("от 15 000 ₸")).toBeVisible();
    await expect(service.getByRole("button", { name: "В корзину" })).toHaveCount(0);
    const ask = service.getByRole("link", { name: "Узнать цену" });
    const href = (await ask.getAttribute("href")) ?? "";
    expect(href.startsWith("https://wa.me/77011234567?text=")).toBe(true);
    const text = decodeURIComponent(href.split("text=")[1]);
    expect(text).toContain("Интересует: Повар на выезд (от 15 000 ₸)");

    // Клик считается обращением (нажатие «Заказать» в статистике), сама вкладка WhatsApp подменена.
    await ctx.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "ok" }));
    const popup = buyer.waitForEvent("popup");
    await ask.click();
    await (await popup).close();
    await expect
      .poll(async () => (await admin.from("events").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("type", "order_click")).count)
      .toBe(1);

    // Обычный товар по-прежнему кладётся в корзину, а услуга в корзину не попадает.
    await buyer.getByRole("listitem").filter({ hasText: "Торт обычный" }).getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await expect(buyer.getByText("Торт обычный")).toBeVisible();
    await expect(buyer.getByText("Повар на выезд")).toHaveCount(0);

    // Сервер не принимает услугу в заказ, даже если подставить её в запрос напрямую.
    const { data: products } = await admin.from("products").select("id,price_mode").eq("shop_id", shopId).eq("title", "Повар на выезд").single().then((r) => ({ data: r.data }));
    const anon = (await import("@supabase/supabase-js")).createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const { error } = await anon.rpc("create_order", { p_shop: shopId, p_items: [{ id: products!.id, qty: 1 }], p_name: "Хакер", p_phone: "77015550099", p_address: "x", p_comment: "" });
    expect(error?.message).toContain("items unavailable");
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});
