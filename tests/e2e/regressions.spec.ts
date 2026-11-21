import { test, expect, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop, storedFiles } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const addToCart = (page: Page, title: string, label = "В корзину") =>
  page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: label, exact: true }).click();

test.describe("покупатель", () => {
  test("перед открытием корзины цены и остатки сверяются с магазином", async ({ browser, page, request }) => {
    const s = stamp();
    const email = `price-${s}@example.test`;
    const slug = `price-${s}`;
    const { products } = await seedShop(admin, {
      email,
      slug,
      products: [{ title: "Торт А", price: 5000 }, { title: "Торт Б", price: 3000 }],
    });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const buyer = await ctx.newPage();
    try {
      await buyer.goto(`${test.info().project.use.baseURL}/${slug}`);
      await addToCart(buyer, "Торт А");
      await addToCart(buyer, "Торт Б");

      // Продавец поменял цену А и снял Б с наличия, пока покупатель думал.
      await loginAs(page, request, email);
      await page.goto(`/dashboard/products/${products[0].id}/edit`);
      await page.getByLabel("Цена, ₸", { exact: true }).fill("6000");
      await page.getByRole("button", { name: "Сохранить товар" }).click();
      await expect(page).toHaveURL(/dashboard\?saved=updated/);
      const stock = page.getByRole("switch", { name: "В наличии: Торт Б" });
      await stock.click();
      await expect(stock).toHaveAttribute("aria-checked", "false");

      await buyer.goto(`${test.info().project.use.baseURL}/${slug}/cart`);
      await expect(buyer.getByRole("status")).toContainText("Корзина обновлена");
      await expect(buyer.getByText(/6\s000\s₸/).first()).toBeVisible();
      await expect(buyer.getByText("Торт Б")).toHaveCount(0);
    } finally {
      await ctx.close();
      await cleanupUser(admin, email);
    }
  });

  test("заказ на казахском, имя и телефон запоминаются и стираются", async ({ browser }) => {
    const s = stamp();
    const email = `kz-${s}@example.test`;
    const slug = `kz-${s}`;
    await seedShop(admin, { email, slug, products: [{ title: "Торт KZ", price: 4000 }] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const buyer = await ctx.newPage();
    await buyer.clock.install();
    const base = test.info().project.use.baseURL;
    try {
      await buyer.goto(`${base}/${slug}?lang=kz`);
      await addToCart(buyer, "Торт KZ", "Себетке");
      await buyer.getByRole("link", { name: /Себет/ }).click();
      await buyer.getByLabel("Аты", { exact: true }).fill("Айгерим");
      await buyer.getByLabel("Телефон", { exact: true }).fill("87015550011");
      await buyer.getByLabel("Мекенжай", { exact: true }).fill("Абай 10");
      // 204 оставляет страницу на месте (abort показал бы страницу ошибки браузера), так видно экран «Тапсырыс қабылданды».
      let whatsapp = "";
      await buyer.route("https://wa.me/**", (route) => { whatsapp = route.request().url(); return route.fulfill({ status: 204 }); });
      await buyer.clock.fastForward(2_000);
      await buyer.getByRole("button", { name: "WhatsApp арқылы тапсырыс беру" }).click();
      await expect(buyer.getByRole("heading", { name: "Тапсырыс қабылданды" })).toBeVisible();
      await expect(buyer.getByRole("link", { name: "WhatsApp ашу" })).toBeVisible();
      // Сообщение продавцу всегда на русском, даже если витрина на казахском.
      expect(new URL(whatsapp).searchParams.get("text")).toContain("Здравствуйте! Заказ из SÖRE (№1)");

      expect(JSON.parse((await buyer.evaluate(() => localStorage.getItem("sore-customer"))) || "{}")).toMatchObject({ name: "Айгерим", phone: "77015550011" });

      // Новая покупка: контакты подставляются сами, кнопка «Өшіру» их стирает.
      await buyer.goto(`${base}/${slug}?lang=kz`);
      await addToCart(buyer, "Торт KZ", "Себетке");
      await buyer.getByRole("link", { name: /Себет/ }).click();
      await expect(buyer.getByLabel("Аты", { exact: true })).toHaveValue("Айгерим");
      await buyer.getByRole("button", { name: "Сақталған ат пен телефонды өшіру" }).click();
      await expect(buyer.getByLabel("Аты", { exact: true })).toHaveValue("");
      expect(await buyer.evaluate(() => localStorage.getItem("sore-customer"))).toBeNull();
    } finally {
      await ctx.close();
      await cleanupUser(admin, email);
    }
  });
});

test.describe("продавец", () => {
  test("порядок товаров меняется кнопками и виден на витрине", async ({ page, request }) => {
    const s = stamp();
    const email = `sort-${s}@example.test`;
    const slug = `sort-${s}`;
    await seedShop(admin, { email, slug, products: [{ title: "Первый", price: 1000 }, { title: "Второй", price: 2000 }] });
    try {
      await loginAs(page, request, email);
      await page.goto("/dashboard");
      await page.getByText("Действия с товаром", { exact: true }).first().click();
      await page.getByRole("button", { name: "Ниже", exact: true }).first().click();
      await expect
        .poll(async () => {
          await page.reload();
          const text = await page.locator("main ul").first().innerText();
          return text.indexOf("Второй") !== -1 && text.indexOf("Второй") < text.indexOf("Первый");
        })
        .toBe(true);
      await page.goto(`/${slug}`);
      const names = await page.locator("main ul li a").allInnerTexts();
      expect(names.findIndex((n) => n.includes("Второй"))).toBeLessThan(names.findIndex((n) => n.includes("Первый")));
    } finally {
      await cleanupUser(admin, email);
    }
  });

  test("миниатюра на витрине и в кабинете, оригинал в карточке; Storage очищается при замене и удалении", async ({ page, request, browser }) => {
    const s = stamp();
    const email = `photo-${s}@example.test`;
    const slug = `photo-${s}`;
    const { ownerId } = await seedShop(admin, { email, slug });
    try {
      await loginAs(page, request, email);
      await page.goto("/dashboard/products/new");
      await page.getByLabel("Название", { exact: true }).fill("Фото-товар");
      await page.getByLabel("Цена, ₸").fill("2500");
      await page.locator('input[type="file"]').setInputFiles("public/icon-512.png");
      await expect(page.getByAltText("Фото товара")).toBeVisible();
      await page.getByRole("button", { name: "Сохранить товар" }).click();
      await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
      const first = await storedFiles(admin, ownerId);
      expect(first).toHaveLength(2);
      const original = first.find((name) => !name.endsWith("_s.jpg"))!;
      const thumbnail = original.replace(/\.jpg$/, "_s.jpg");
      expect(first).toContain(thumbnail);
      const storage = admin.storage.from("product-photos");
      const originalUrl = storage.getPublicUrl(`${ownerId}/${original}`).data.publicUrl;
      const thumbnailUrl = storage.getPublicUrl(`${ownerId}/${thumbnail}`).data.publicUrl;
      await expect(page.getByRole("link", { name: /Фото-товар/ }).locator("img")).toHaveAttribute("src", thumbnailUrl);

      await page.goto(`/${slug}`);
      const tile = page.getByAltText("Фото-товар", { exact: true });
      await expect(tile).toHaveAttribute("src", thumbnailUrl);
      await expect(tile).toHaveAttribute("fetchpriority", "high");
      await expect.poll(() => tile.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(480);
      await page.getByRole("link", { name: /Фото-товар/ }).click();
      await expect(page.getByAltText("Фото-товар", { exact: true })).toHaveAttribute("src", originalUrl);

      const legacy = await browser.newPage({ baseURL: test.info().project.use.baseURL });
      try {
        await legacy.route(thumbnailUrl, (route) => route.fulfill({ status: 404 }));
        await legacy.goto(`/${slug}`);
        const photo = legacy.getByAltText("Фото-товар", { exact: true });
        await expect(photo).toHaveAttribute("src", originalUrl);
        await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(512);
      } finally {
        await legacy.close();
      }

      await page.goto("/dashboard");
      await page.getByRole("link", { name: /Фото-товар/ }).click();
      await page.locator('input[type="file"]').setInputFiles("public/icon-192.png");
      await expect(page.getByAltText("Фото товара")).not.toHaveAttribute("src", originalUrl);
      await page.getByRole("button", { name: "Сохранить товар" }).click();
      await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
      const replacement = await storedFiles(admin, ownerId);
      expect(replacement).toHaveLength(2);
      expect(replacement.filter((name) => first.includes(name))).toEqual([]);

      await page.getByRole("link", { name: /Фото-товар/ }).click();
      page.once("dialog", (d) => void d.accept());
      await page.getByRole("button", { name: "Удалить товар" }).click();
      await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);
      await expect.poll(() => storedFiles(admin, ownerId)).toHaveLength(0);
    } finally {
      await cleanupUser(admin, email);
    }
  });

  test("загрузка аватара магазина сохраняется", async ({ page, request }) => {
    const s = stamp();
    const email = `avatar-${s}@example.test`;
    const { ownerId } = await seedShop(admin, { email, slug: `avatar-${s}` });
    try {
      await loginAs(page, request, email);
      await page.goto("/dashboard/settings");
      // Обработчик выбора файла появляется после гидратации: её признак — отрисованный QR-код (канвас перестаёт быть 300×150).
      await page.waitForFunction(() => (document.querySelector("canvas") as HTMLCanvasElement | null)?.width !== 300);
      await page.locator("#avatar").setInputFiles("public/icon-192.png");
      await expect(page.getByAltText("Фото магазина")).toBeVisible();
      await page.getByRole("button", { name: "Сохранить настройки" }).click();
      await expect(page.getByRole("status")).toContainText("Настройки сохранены");
      await page.reload();
      await expect(page.getByAltText("Фото магазина")).toBeVisible();
      expect(await storedFiles(admin, ownerId)).toHaveLength(1);
    } finally {
      await cleanupUser(admin, email);
    }
  });

  test("заказы показываются по 20 и «Показать ещё» открывает остальные", async ({ page, request }) => {
    const s = stamp();
    const email = `orders-${s}@example.test`;
    const { shopId } = await seedShop(admin, { email, slug: `orders-${s}` });
    try {
      const rows = Array.from({ length: 22 }, (_, i) => ({
        shop_id: shopId,
        number: i + 1,
        items: [{ id: "x", title: "Товар", qty: 1, price: 1000 }],
        total: 1000,
        customer_name: `Покупатель ${i + 1}`,
        customer_phone: "77015550011",
        address: "Самовывоз",
        created_at: new Date(Date.now() - (30 - i) * 60_000).toISOString(),
      }));
      const { error } = await admin.from("orders").insert(rows);
      expect(error).toBeNull();
      await admin.from("shops").update({ next_order_number: 23 }).eq("id", shopId);

      await loginAs(page, request, email);
      await page.goto("/dashboard/orders?status=all");
      await expect(page.locator("li.card")).toHaveCount(20);
      await expect(page.getByText("№1 · Покупатель 1", { exact: true })).toHaveCount(0);
      await page.getByRole("link", { name: "Показать ещё" }).click();
      await expect(page.getByText("№1 · Покупатель 1", { exact: true })).toBeVisible();
    } finally {
      await cleanupUser(admin, email);
    }
  });
});
