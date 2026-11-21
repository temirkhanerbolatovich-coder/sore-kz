import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("продавец → фото → ИИ → покупатель → WhatsApp → заказ и статистика", async ({ page, browser, request }) => {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) throw new Error("E2E requires a disposable local Supabase");
  const admin = createClient(base, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const stamp = Date.now().toString(36);
  const email = `seller-${stamp}@example.test`;
  const slug = `shop-${stamp}`;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto("/login");
    await page.getByLabel("Электронная почта").fill(email);
    await page.getByRole("button", { name: "Получить ссылку для входа" }).click();
    await expect(page.getByText("Проверьте почту")).toBeVisible();
    let messageId = "";
    await expect.poll(async () => {
      const response = await request.get("http://127.0.0.1:54324/api/v1/messages");
      const inbox = await response.json();
      const message = inbox.messages?.find((m: { To: { Address: string }[] }) => m.To.some((to) => to.Address === email));
      messageId = message?.ID || "";
      return Boolean(messageId);
    }).toBe(true);
    const mail = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json();
    const link = mail.HTML.match(/href="([^"]+\/auth\/v1\/verify[^\"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(link).toBeTruthy();
    await page.goto(link);
    await expect(page).toHaveURL(/dashboard\/onboarding/);
    await page.getByLabel("Название магазина").fill("Тестовый магазин");
    await page.getByLabel("Адрес ссылки").fill(slug);
    await page.getByLabel(/WhatsApp/).fill("87011234567");
    await page.getByRole("button", { name: /Создать/ }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await page.getByRole("link", { name: /По одному/ }).click();
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    await expect(page.getByRole("button", { name: "Заполнить с ИИ" })).toBeEnabled();
    await page.route("**/api/ai/product-card", (route) => route.fulfill({ json: { card: { title: "Торт тестовый", description_ru: "Описание торта", description_kz: "Торт сипаттамасы", category: "Торты", tags: [] }, remaining: 19 } }));
    await page.getByRole("button", { name: "Заполнить с ИИ" }).click();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Торт тестовый");
    await page.getByLabel("Цена, ₸").fill("12000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await page.getByRole("link", { name: "Настройки", exact: true }).click();
    await page.getByLabel("Город").fill("Алматы");
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    await expect(page.getByRole("status")).toContainText("Настройки сохранены");
    await expect(page.locator("canvas")).toBeVisible();
    const customer = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const buyer = await customer.newPage();
    await buyer.clock.install();
    buyer.on("pageerror", (e) => errors.push(e.message));
    await buyer.goto(`${test.info().project.use.baseURL}/${slug}`);
    await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await buyer.getByLabel("Имя", { exact: true }).fill("Айгерим");
    await buyer.getByLabel("Телефон", { exact: true }).fill("87019998877");
    await buyer.getByLabel("Адрес", { exact: true }).fill("ул. Абая 10");
    let whatsapp = "";
    await buyer.route("https://wa.me/**", (route) => { whatsapp = route.request().url(); return route.abort(); });
    await buyer.clock.fastForward(2_000);
    await buyer.getByRole("button", { name: "Заказать в WhatsApp" }).click();
    await expect.poll(() => whatsapp).toContain("wa.me/77011234567");
    expect(new URL(whatsapp).searchParams.get("text")).toContain("(№1)");
    await page.goto("/dashboard/orders");
    await expect(page.getByText("№1 · Айгерим")).toBeVisible();
    await page.getByRole("button", { name: "Выполнен", exact: true }).click();
    await expect(page.getByText("Выполнен", { exact: true })).toBeVisible();
    await page.goto("/dashboard");
    await expect(page.getByText("Нажали «Заказать»").filter({ visible: true }).locator("..")).toContainText("1");
    expect(errors).toEqual([]);
    await customer.close();
  } finally {
    const { data, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw new Error(`cleanup listUsers: ${listError.message}`);
    const user = data.users.find((u) => u.email === email);
    if (user) {
      const { data: files } = await admin.storage.from("product-photos").list(user.id);
      if (files?.length) await admin.storage.from("product-photos").remove(files.map((f) => `${user.id}/${f.name}`));
      await admin.auth.admin.deleteUser(user.id);
    }
  }
});

for (const width of [360, 390]) test(`демо и корзина без переполнения при ширине ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 640 : 844 });
  for (const url of ["/", "/demo", "/demo/cart?lang=kz"]) {
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expect(page.getByRole("heading", { name: "Себет бос" })).toBeVisible();
});
