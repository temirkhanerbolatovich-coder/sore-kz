import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test("вход: есть путь назад, а вошедшего пользователя форма не показывается", async ({ page, request }) => {
  const email = `nav-login-${stamp()}@example.test`;
  try {
    await page.goto("/login");
    await page.getByRole("link", { name: "На главную" }).click();
    await expect(page).toHaveURL(/\/$/);

    await loginAs(page, request, email);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("создание магазина: можно вернуться на главную или выйти", async ({ page, request }) => {
  const email = `nav-onboard-${stamp()}@example.test`;
  try {
    await loginAs(page, request, email);
    await expect(page).toHaveURL(/onboarding/);
    await page.getByRole("link", { name: "На главную" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/dashboard/onboarding");
    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("форма товара: уход с несохранёнными правками спрашивает подтверждение, ИИ не стирает ручные правки и его можно откатить", async ({ page, request }) => {
  const s = stamp();
  const email = `nav-form-${s}@example.test`;
  await seedShop(admin, { email, slug: `nav-form-${s}` });
  try {
    await loginAs(page, request, email);

    // Без правок «Отмена» уходит сразу, без вопросов.
    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.getByRole("link", { name: "Отмена" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);

    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Название", { exact: true }).fill("Мой черновик");

    // Отказ остаётся на форме с введёнными данными.
    page.once("dialog", (d) => void d.dismiss());
    await page.getByRole("link", { name: "Назад", exact: true }).click();
    await expect(page).toHaveURL(/products\/new/);
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Мой черновик");

    // Откат ИИ возвращает прежние значения.
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    await expect(page.getByRole("button", { name: "Заполнить с ИИ" })).toBeEnabled();
    await page.route("**/api/ai/product-card", (route) =>
      route.fulfill({ json: { card: { title: "Торт тестовый", description_ru: "Описание", description_kz: "Сипаттама", category: "Торты", tags: [] }, remaining: 5 } }),
    );
    await page.getByRole("button", { name: "Заполнить с ИИ" }).click();
    // Название, введённое вручную, ИИ не перезаписывает; пустые поля заполняет.
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Мой черновик");
    await expect(page.getByLabel("Описание · RU")).toHaveValue("Описание");
    await page.getByRole("button", { name: "Вернуть как было" }).click();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Мой черновик");
    await expect(page.getByLabel("Описание · RU")).toHaveValue("");

    // Фото можно убрать.
    await page.getByRole("button", { name: "Убрать фото" }).click();
    await expect(page.getByAltText("Фото товара")).toHaveCount(0);

    // Подтверждение уходит на дашборд.
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("link", { name: "Назад", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("заказы: отмену можно подтвердить и вернуть заказ в «Новые»", async ({ page, request }) => {
  const s = stamp();
  const email = `nav-orders-${s}@example.test`;
  const { shopId } = await seedShop(admin, { email, slug: `nav-orders-${s}` });
  try {
    const { error } = await admin.from("orders").insert({
      shop_id: shopId, number: 1, items: [{ id: "x", title: "Товар", qty: 1, price: 1000 }], total: 1000,
      customer_name: "Айгерим", customer_phone: "77015550011", address: "Самовывоз",
    });
    expect(error).toBeNull();
    await admin.from("shops").update({ next_order_number: 2 }).eq("id", shopId);

    await loginAs(page, request, email);
    await page.goto("/dashboard/orders");
    await page.waitForLoadState("networkidle");

    // Отказ в подтверждении ничего не меняет.
    page.once("dialog", (d) => void d.dismiss());
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.getByText("Новый", { exact: true })).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    await expect(page.getByText("Отменён", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Вернуть в «Новые»" }).click();
    await expect(page.getByText("Новый", { exact: true })).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("покупатель: возврат из карточки товара и отмена удаления из корзины", async ({ browser }) => {
  const s = stamp();
  const email = `nav-buyer-${s}@example.test`;
  const slug = `nav-buyer-${s}`;
  await seedShop(admin, { email, slug, products: [{ title: "Торт А", price: 5000 }, { title: "Торт Б", price: 3000 }] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyer = await ctx.newPage();
  const base = test.info().project.use.baseURL;
  try {
    await buyer.goto(`${base}/${slug}?lang=kz`);
    await buyer.getByRole("link", { name: /Торт А/ }).first().click();
    await expect(buyer).toHaveURL(/\/p\//);
    await buyer.getByRole("link", { name: /Регрессия/ }).click(); // кнопка «назад» в шапке
    await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?lang=kz$`));

    await buyer.getByRole("listitem").filter({ hasText: "Торт А" }).getByRole("button", { name: "Себетке" }).click();
    await buyer.getByRole("listitem").filter({ hasText: "Торт Б" }).getByRole("button", { name: "Себетке" }).click();
    await buyer.getByRole("link", { name: /Себет/ }).click();
    await expect(buyer.getByRole("heading", { name: "Сіздің тапсырысыңыз" })).toBeVisible();

    // Убрали позицию и вернули.
    await buyer.getByRole("listitem").filter({ hasText: "Торт А" }).getByRole("button", { name: "Азайту" }).click();
    await expect(buyer.getByText("Торт А")).toHaveCount(0);
    await buyer.getByRole("button", { name: "Қайтару" }).click();
    await expect(buyer.getByText("Торт А")).toBeVisible();

    // Очистили корзину и вернули всё.
    buyer.once("dialog", (d) => void d.accept());
    await buyer.getByRole("button", { name: "Себетті тазалау" }).click();
    await expect(buyer.getByRole("heading", { name: "Себет бос" })).toBeVisible();
    await buyer.getByRole("button", { name: "Қайтару" }).click();
    await expect(buyer.getByText("Торт А")).toBeVisible();
    await expect(buyer.getByText("Торт Б")).toBeVisible();

    // «Назад» из корзины ведёт в магазин с тем же языком.
    await buyer.getByRole("link", { name: "Дүкенге оралу" }).click();
    await expect(buyer).toHaveURL(new RegExp(`/${slug}\\?lang=kz$`));
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});

test("страница не найдена: есть «Назад», «На главную» и призыв создать магазин", async ({ page }) => {
  await page.goto("/no-such-shop-xyz");
  await expect(page.getByRole("heading", { name: "Такой страницы нет" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Назад" })).toBeVisible();
  await expect(page.getByRole("link", { name: "На главную" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Создать магазин" })).toBeVisible();
});

test("вход по коду работает без ссылки (письмо открыто в другом браузере)", async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_EMAIL_CODE !== "1", "поле кода включается NEXT_PUBLIC_EMAIL_CODE=1");
  const email = `nav-code-${stamp()}@example.test`;
  try {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByRole("button", { name: "Получить ссылку для входа" }).click();
    await expect(page.getByText("Проверьте почту")).toBeVisible();

    // Код берём у сервера Auth напрямую: это то же значение, что стояло бы в письме со своим шаблоном.
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    expect(error).toBeNull();
    const code = data?.properties?.email_otp ?? "";
    expect(code).not.toBe("");

    // Неверный код отклоняется, верный пускает в кабинет. Ссылку из письма мы не открывали вовсе.
    await page.getByLabel("Или введите код из письма").fill("000000");
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page.getByText("Код не подошёл")).toBeVisible();
    await page.getByLabel("Или введите код из письма").fill(code);
    await page.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  } finally {
    await cleanupUser(admin, email);
  }
});
