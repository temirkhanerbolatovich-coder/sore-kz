import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop, storedFiles } from "./helpers";
import { ADMIN_CHAT, NOTIFY_SECRET, TELEGRAM_MOCK_PORT, WEBHOOK_SECRET, startTelegramMock } from "./telegram-mock";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const almatyDate = (plusDays: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(Date.now() + plusDays * 86_400_000);

test("варианты по весу и дата заказа: от выбора на витрине до заказа у продавца", async ({ page, request, browser }) => {
  const s = stamp();
  const email = `var-${s}@example.test`;
  const slug = `var-${s}`;
  const { shopId } = await seedShop(admin, { email, slug });
  await admin.from("shops").update({ lead_days: 2 }).eq("id", shopId);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    // Продавец создаёт торт с двумя вариантами веса.
    await loginAs(page, request, email);
    await page.goto("/dashboard/products/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Название", { exact: true }).fill("Торт Прага");
    await page.getByRole("button", { name: /У товара несколько цен/ }).click();
    await page.getByLabel("Название варианта 1").fill("1 кг");
    await page.getByLabel("Цена варианта 1, ₸").fill("12000");
    await page.getByRole("button", { name: "+ Ещё вариант" }).click();
    await page.getByLabel("Название варианта 2").fill("2 кг");
    await page.getByLabel("Цена варианта 2, ₸").fill("22000");
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByText("от 12 000 ₸")).toBeVisible();

    // Покупатель: на карточке «Выбрать», на странице товара выбирает 2 кг.
    const buyer = await ctx.newPage();
    await buyer.clock.install();
    const base = test.info().project.use.baseURL;
    await buyer.goto(`${base}/${slug}`);
    await buyer.waitForLoadState("networkidle");
    await expect(buyer.getByText("от 12 000 ₸")).toBeVisible();
    await buyer.getByRole("link", { name: "Выбрать", exact: true }).click();
    await buyer.getByText("2 кг", { exact: true }).click();
    await expect(buyer.getByText("22 000 ₸").last()).toBeVisible();
    await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await expect(buyer.getByText("Торт Прага · 2 кг")).toBeVisible();

    // Без даты нельзя: у магазина предзаказ за 2 дня.
    await buyer.getByLabel("Имя", { exact: true }).fill("Айгерим");
    await buyer.getByLabel("Телефон", { exact: true }).fill("87015550123");
    await buyer.getByLabel("Адрес", { exact: true }).fill("ул. Абая 10");
    let whatsapp = "";
    await buyer.route("https://wa.me/**", (route) => { whatsapp = route.request().url(); return route.fulfill({ status: 204 }); });
    await buyer.getByRole("button", { name: "Заказать в WhatsApp" }).click();
    // Браузер сам не пропустит пустое обязательное поле даты.
    await expect(buyer.getByLabel("Когда нужно")).toBeFocused();
    expect(whatsapp).toBe("");

    await buyer.getByLabel("Когда нужно").fill(almatyDate(3));
    await buyer.getByLabel("Время").fill("18:00");
    await buyer.clock.fastForward(2_000);
    const submit = buyer.getByRole("button", { name: "Заказать в WhatsApp" });
    const honeypot = buyer.locator('input[name="website"]');
    await honeypot.evaluate((input: HTMLInputElement) => { input.value = "spam"; });
    await submit.click();
    // У Next.js есть свой служебный role="alert" (анонсер маршрутов), поэтому выбираем по тексту ошибки.
    await expect(buyer.getByRole("alert").filter({ hasText: "Не удалось оформить заказ" })).toBeVisible();
    expect(whatsapp).toBe("");
    await honeypot.evaluate((input: HTMLInputElement) => { input.value = ""; });
    await submit.click();
    await expect.poll(() => whatsapp).toContain("wa.me/77011234567");
    const text = decodeURIComponent(whatsapp.split("text=")[1]);
    expect(text).toContain("Торт Прага · 2 кг × 1 — 22 000 ₸");
    expect(text).toContain("Когда: ");
    expect(text).toContain("18:00");

    // Продавец видит вариант и дату, сумма посчитана по цене 2 кг.
    await page.goto("/dashboard/orders");
    await expect(page.getByText("Торт Прага · 2 кг × 1")).toBeVisible();
    await expect(page.getByText(/Когда нужно: .*18:00/)).toBeVisible();
    await expect(page.getByText("22 000 ₸").first()).toBeVisible();
  } finally {
    await ctx.close();
    await cleanupUser(admin, email);
  }
});

test("несколько фото сразу: ИИ-черновики, правка цены и сохранение всех", async ({ page, request }) => {
  const s = stamp();
  const email = `batch-${s}@example.test`;
  await seedShop(admin, { email, slug: `batch-${s}` });
  try {
    await loginAs(page, request, email);
    let calls = 0;
    await page.route("**/api/ai/product-card", (route) => {
      calls++;
      return route.fulfill({
        json: { card: { title: `Торт ${calls}`, description_ru: "Описание", description_kz: "Сипаттама", category: "Торты", tags: [] }, kzDropped: false, remaining: 10 },
      });
    });
    await page.goto("/dashboard/products/batch");
    await page.waitForLoadState("networkidle");
    await page.locator("#batch-files").setInputFiles(["public/icon-192.png", "public/icon-512.png"]);

    await expect(page.getByLabel("Название 1")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Название 2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Сохранить 2 товаров" })).toBeEnabled();

    // «Точная» цена без суммы блокирует сохранение, с суммой пропускает.
    await page.getByRole("group", { name: "Цена 2" }).getByRole("button", { name: "Точная" }).click();
    await expect(page.getByRole("button", { name: "Сохранить 2 товаров" })).toBeDisabled();
    await page.getByLabel("Цена 2, ₸").fill("9000");
    await page.getByRole("button", { name: "Сохранить 2 товаров" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    await expect(page.getByText("Товары · 2")).toBeVisible();
    await expect(page.getByText("Цена по запросу")).toBeVisible();
    await expect(page.getByText("9 000 ₸")).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("Telegram: привязка по ссылке и уведомление о новом заказе", async ({ page, request, browser }) => {
  test.setTimeout(120_000);
  const mock = await startTelegramMock(TELEGRAM_MOCK_PORT);
  const s = stamp();
  const email = `tg-${s}@example.test`;
  const slug = `tg-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Торт для Telegram", price: 7000 }] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const base = test.info().project.use.baseURL;
  try {
    // База шлёт уведомления на адрес тестового сервера (контейнер видит хост как host.docker.internal).
    const port = new URL(base!).port;
    const { error } = await admin.rpc("set_notify_config", { p_url: `http://host.docker.internal:${port}/api/telegram/notify`, p_secret: NOTIFY_SECRET });
    expect(error).toBeNull();

    await loginAs(page, request, email);
    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Подключить Telegram" }).click();
    const link = await page.getByRole("link", { name: "Открыть Telegram" }).getAttribute("href");
    expect(link).toMatch(/^https:\/\/t\.me\/sore_e2e_bot\?start=[A-Za-z0-9_-]{8,}$/);
    const code = link!.split("start=")[1];

    // Без секрета webhook закрыт, с секретом /start привязывает чат.
    const denied = await request.post(`${base}/api/telegram/webhook`, { data: { message: { text: `/start ${code}`, chat: { id: 555, type: "private" } } } });
    expect(denied.status()).toBe(403);
    const ok = await request.post(`${base}/api/telegram/webhook`, {
      headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
      data: { message: { text: `/start ${code}`, chat: { id: 555, type: "private" } } },
    });
    expect(ok.status()).toBe(200);
    await expect(page.getByText("Telegram подключён")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => mock.messages.some((m) => String(m.chat_id) === "555" && m.text.includes("подключён"))).toBe(true);

    // Покупатель оформляет заказ, продавцу приходит сообщение.
    const buyer = await ctx.newPage();
    await buyer.clock.install();
    await buyer.goto(`${base}/${slug}`);
    await buyer.waitForLoadState("networkidle");
    await buyer.getByRole("button", { name: "В корзину", exact: true }).click();
    await buyer.getByRole("link", { name: /Корзина/ }).click();
    await buyer.getByLabel("Имя", { exact: true }).fill("Мадина <b>");
    await buyer.getByLabel("Телефон", { exact: true }).fill("87015550777");
    await buyer.getByLabel("Адрес", { exact: true }).fill("Самал-2, 14");
    await buyer.route("https://wa.me/**", (route) => route.fulfill({ status: 204 }));
    await buyer.clock.fastForward(2_000);
    await buyer.getByRole("button", { name: "Заказать в WhatsApp" }).click();

    await expect.poll(() => mock.messages.find((m) => m.text.includes("Новый заказ")), { timeout: 30_000 }).toBeTruthy();
    const msg = mock.messages.find((m) => m.text.includes("Новый заказ"))!;
    expect(String(msg.chat_id)).toBe("555");
    expect(msg.text).toContain("Торт для Telegram × 1 — 7 000 ₸");
    expect(msg.text).toContain("Мадина &lt;b&gt;"); // пользовательский текст экранирован
    expect(msg.reply_markup?.inline_keyboard.flat().map((b) => b.text)).toEqual(["Открыть заказы", "Написать клиенту в WhatsApp", "✅ Выполнен", "✖️ Отменить"]);

    // Чужой секрет не пропускает запрос уведомления.
    const forged = await request.post(`${base}/api/telegram/notify`, { headers: { "x-notify-secret": "wrong" }, data: { order_id: "00000000-0000-0000-0000-000000000000" } });
    expect(forged.status()).toBe(403);

    // /stop отключает.
    await request.post(`${base}/api/telegram/webhook`, {
      headers: { "x-telegram-bot-api-secret-token": WEBHOOK_SECRET },
      data: { message: { text: "/stop", chat: { id: 555, type: "private" } } },
    });
    const { data: row } = await admin.from("shop_telegram").select("chat_id").eq("shop_id", shopId).single();
    expect(row?.chat_id).toBeNull();
  } finally {
    await ctx.close();
    await mock.close();
    await cleanupUser(admin, email);
  }
});

test("ошибка из браузера доходит владельцу сервиса в Telegram", async ({ request }) => {
  const mock = await startTelegramMock(TELEGRAM_MOCK_PORT);
  try {
    const base = test.info().project.use.baseURL;
    const unique = `boom-${stamp()}`;
    const res = await request.post(`${base}/api/report-error`, { data: { message: unique, path: "/demo", digest: "abc" } });
    expect(res.status()).toBe(200);
    await expect.poll(() => mock.messages.find((m) => m.text.includes(unique))).toBeTruthy();
    expect(String(mock.messages.find((m) => m.text.includes(unique))!.chat_id)).toBe(String(ADMIN_CHAT));
    expect((await request.post(`${base}/api/report-error`, { data: { nonsense: true } })).status()).toBe(400);
  } finally {
    await mock.close();
  }
});

test("условия и конфиденциальность доступны со всех нужных мест", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Условия" }).click();
  await expect(page.getByRole("heading", { name: "Условия использования" })).toBeVisible();
  await page.getByRole("link", { name: "На главную" }).click();
  await page.getByRole("link", { name: "Конфиденциальность" }).click();
  await expect(page.getByRole("heading", { name: "Политика конфиденциальности" })).toBeVisible();

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "условиями" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "политикой конфиденциальности" })).toHaveAttribute("href", "/privacy");
});

test("удаление магазина и аккаунта: нужно ввести адрес, после него данных не остаётся", async ({ page, request }) => {
  const s = stamp();
  const email = `del-${s}@example.test`;
  const slug = `del-${s}`;
  const { ownerId, shopId } = await seedShop(admin, { email, slug, products: [{ title: "Удалится", price: 1000 }] });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/products/new");
    await page.getByLabel("Название", { exact: true }).fill("Фото при удалении аккаунта");
    await page.getByLabel("Цена, ₸").fill("2500");
    await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
    await expect(page.getByAltText("Фото товара")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить товар" }).click();
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
    const photos = await storedFiles(admin, ownerId);
    expect(photos).toHaveLength(2);
    expect(photos.some((name) => name.endsWith("_s.jpg"))).toBe(true);

    await page.goto("/dashboard/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Удалить магазин и аккаунт" }).click();
    await page.getByLabel(/Для подтверждения введите адрес/).fill("не-тот-адрес");
    await page.getByRole("button", { name: "Удалить навсегда" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "введите адрес магазина" })).toBeVisible();
    expect((await admin.from("shops").select("id").eq("id", shopId).maybeSingle()).data).not.toBeNull();

    await page.getByLabel(/Для подтверждения введите адрес/).fill(slug);
    await page.getByRole("button", { name: "Удалить навсегда" }).click();
    await expect(page).toHaveURL(/\/\?deleted=1$/);
    expect((await admin.from("shops").select("id").eq("id", shopId).maybeSingle()).data).toBeNull();
    expect((await admin.from("products").select("id").eq("shop_id", shopId)).data).toHaveLength(0);
    expect((await admin.auth.admin.getUserById(ownerId)).data.user).toBeNull();
    expect(await storedFiles(admin, ownerId)).toEqual([]);
  } finally {
    await cleanupUser(admin, email);
  }
});
