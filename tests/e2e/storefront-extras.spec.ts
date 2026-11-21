import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test("«О магазине» и поиск по витрине", async ({ page, request }) => {
  const s = stamp();
  const email = `about-${s}@example.test`;
  const slug = `about-${s}`;
  const titles = ["Торт Прага", "Торт Медовик", "Пирог яблочный", "Капкейки", "Эклеры", "Макарон", "Штрудель", "Чизкейк", "Брауни"];
  await seedShop(admin, { email, slug, products: titles.map((title, i) => ({ title, price: 1000 + i })) });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");

    // Ник проверяется: «два слова» не похоже на Instagram.
    await page.getByLabel("Instagram (ник или ссылка)").fill("два слова");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Instagram" })).toBeVisible();

    await page.getByLabel("Коротко о вас (до 300 символов)").fill("Печём торты и пироги на заказ в Алматы.");
    await page.getByLabel("Адрес или район").fill("Алматы, Бостандыкский район");
    await page.getByLabel("График работы").fill("Ежедневно 9:00–20:00");
    await page.getByLabel("Instagram (ник или ссылка)").fill("https://www.instagram.com/aliya.sweets/?hl=ru");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByRole("status")).toContainText("Настройки сохранены");

    // Витрина обновилась сразу: блок «О магазине» виден покупателю.
    await page.goto(`/${slug}`);
    // Блок свёрнут: сначала виден краткий текст, подробности открываются нажатием.
    await expect(page.getByText("Печём торты и пироги на заказ в Алматы.").first()).toBeVisible();
    await page.getByText("Подробнее", { exact: true }).click();
    await expect(page.getByText("Печём торты и пироги на заказ в Алматы.").last()).toBeVisible();
    await expect(page.getByText("Ежедневно 9:00–20:00")).toBeVisible();
    await expect(page.getByText("Алматы, Бостандыкский район")).toBeVisible();
    const instagram = page.getByRole("link", { name: "@aliya.sweets" });
    await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/aliya.sweets/");
    await expect(instagram).toHaveAttribute("rel", /noopener/);
    // Текст <script> не считается видимым, поэтому читаем textContent напрямую.
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent()) || "{}");
    expect(jsonLd).toMatchObject({
      "@type": "Store",
      description: "Печём торты и пироги на заказ в Алматы.",
      sameAs: ["https://www.instagram.com/aliya.sweets/"],
      address: { streetAddress: "Алматы, Бостандыкский район" },
    });

    // Поиск: 9 товаров, поле появляется.
    const search = page.getByRole("searchbox", { name: "Найти товар" });
    await expect(search).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "₸" })).toHaveCount(9);
    await search.fill("торт");
    await expect(page.getByRole("listitem").filter({ hasText: "₸" })).toHaveCount(2);
    await search.fill("ЧИЗ");
    await expect(page.getByRole("listitem").filter({ hasText: "Чизкейк" })).toHaveCount(1);
    await search.fill("такого нет");
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    await page.getByRole("button", { name: "Сбросить поиск" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "₸" })).toHaveCount(9);
    await expect(search).toHaveValue("");
  } finally {
    await cleanupUser(admin, email);
  }
});

test("у небольшой витрины нет поиска и пустого блока «О магазине»", async ({ page }) => {
  const s = stamp();
  const email = `small-${s}@example.test`;
  const slug = `small-${s}`;
  await seedShop(admin, { email, slug, products: [{ title: "Единственный торт", price: 5000 }] });
  try {
    await page.goto(`/${slug}`);
    await expect(page.getByText("Единственный торт")).toBeVisible();
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    await expect(page.getByText("Instagram:")).toHaveCount(0);
    await expect(page.getByText("График:")).toHaveCount(0);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("статус заказа для покупателя: ссылка в WhatsApp, страница и смена статуса", async ({ browser, request }) => {
  test.setTimeout(120_000);
  const s = stamp();
  const email = `status-${s}@example.test`;
  const slug = `status-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Торт для статуса", price: 8000 }] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    const buyer = await ctx.newPage();
    await buyer.clock.install();
    const base = test.info().project.use.baseURL;
    await buyer.goto(`${base}/${slug}`);
    await buyer.waitForLoadState("networkidle");
    await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await buyer.getByLabel("Имя", { exact: true }).fill("Айгерим");
    await buyer.getByLabel("Телефон", { exact: true }).fill("87015550188");
    await buyer.getByLabel("Адрес", { exact: true }).fill("ул. Абая 10");
    let whatsapp = "";
    await buyer.route("https://wa.me/**", (route) => { whatsapp = route.request().url(); return route.fulfill({ status: 204 }); });
    await buyer.clock.fastForward(2_000);
    await buyer.getByRole("button", { name: "Заказать в WhatsApp" }).click();
    await expect.poll(() => whatsapp).toContain("wa.me/77011234567");

    // Ссылка на статус попала в сообщение продавцу.
    const text = decodeURIComponent(whatsapp.split("text=")[1]);
    const link = text.match(/Статус заказа: (\S+\/o\/[a-f0-9]{20})/);
    expect(link).toBeTruthy();

    // На экране «Заказ принят» есть кнопка статуса.
    await buyer.getByRole("link", { name: "Следить за заказом" }).click();
    await expect(buyer).toHaveURL(/\/o\/[a-f0-9]{20}$/);
    await expect(buyer.getByRole("heading", { name: /Заказ №\d+/ })).toBeVisible();
    await expect(buyer.getByText("Принят", { exact: true })).toBeVisible();
    await expect(buyer.getByText("Торт для статуса × 1")).toBeVisible();
    await expect(buyer.getByText("8 000 ₸").first()).toBeVisible();
    // Контакты покупателя на странице не показываются.
    await expect(buyer.getByText("87015550188")).toHaveCount(0);
    await expect(buyer.getByText("ул. Абая 10")).toHaveCount(0);
    await expect(buyer.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    // Продавец отметил выполненным: покупатель видит новый статус.
    const { error } = await admin.from("orders").update({ status: "done" }).eq("shop_id", shopId);
    expect(error).toBeNull();
    await buyer.reload();
    await expect(buyer.getByText("Выполнен", { exact: true })).toBeVisible();

    // Чужие и неверные коды: настоящий 404.
    expect((await request.get("/o/0123456789abcdef0123")).status()).toBe(404);
    expect((await request.get("/o/not-a-code")).status()).toBe(404);
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});

test("плакат с QR-кодом для печати", async ({ page, request }) => {
  const s = stamp();
  const email = `poster-${s}@example.test`;
  const slug = `poster-${s}`;
  await seedShop(admin, { email, slug });
  try {
    // Без входа плакат недоступен.
    const anonymous = await request.get("/dashboard/poster", { maxRedirects: 0 });
    expect([307, 308]).toContain(anonymous.status());

    await loginAs(page, request, email);
    await page.goto("/dashboard/settings");
    await page.getByRole("link", { name: "Плакат для печати" }).click();
    await expect(page).toHaveURL(/\/dashboard\/poster$/);
    await expect(page.getByRole("heading", { name: "Регрессия" })).toBeVisible();
    await expect(page.getByText(`/${slug}`, { exact: false }).first()).toBeVisible();
    const qr = page.getByRole("img", { name: new RegExp(`QR-код: .*/${slug}$`) });
    await expect(qr.locator("svg")).toBeVisible();

    // При печати кнопки и подсказки скрыты, остаётся только плакат.
    await expect(page.getByRole("button", { name: "Распечатать" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Распечатать" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Регрессия" })).toBeVisible();
    await expect(qr.locator("svg")).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});
