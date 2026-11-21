import { expect, test, type Page } from "@playwright/test";
import { adminClient, cleanupUser, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

async function openCart(page: Page, slug: string, titles: string[]) {
  await page.goto(`/${slug}`);
  for (const title of titles) {
    await page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "В корзину", exact: true }).click();
  }
  await page.getByRole("link", { name: /Корзина/ }).click();
}

test("поле телефона форматируется, ошибки доступны и заказ отправляется один раз", async ({ page }) => {
  const s = stamp();
  const email = `cart-input-${s}@example.test`;
  const slug = `cart-input-${s}`;
  const { shopId } = await seedShop(admin, { email, slug, products: [{ title: "Пирог", price: 1000 }] });
  try {
    await page.clock.install();
    await openCart(page, slug, ["Пирог"]);
    const name = page.getByLabel("Имя", { exact: true });
    const phone = page.getByLabel("Телефон", { exact: true });
    const address = page.getByLabel("Адрес", { exact: true });
    const submit = page.getByRole("button", { name: /Заказать в WhatsApp/ });

    await phone.fill("123");
    await phone.blur();
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    const errorId = await phone.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    await expect(page.locator(`#${errorId!.split(" ")[0]}`)).toBeVisible();

    await phone.fill("87011234567");
    await expect(phone).toHaveValue("+7 701 123 45 67");
    await phone.fill("+77011234567");
    await expect(phone).toHaveValue("+7 701 123 45 67");
    await submit.click();
    await expect(name).toBeFocused();
    await name.fill("Айгерим");
    await submit.click();
    await expect(address).toBeFocused();
    await address.fill("Абая 10");

    let requestCount = 0;
    let sentPhone = "";
    let releaseRequest!: () => void;
    const blocked = new Promise<void>((resolve) => { releaseRequest = resolve; });
    await page.route("**/rest/v1/rpc/create_order", async (route) => {
      requestCount++;
      sentPhone = route.request().postDataJSON().p_phone;
      await blocked;
      await route.continue();
    });
    await page.route("https://wa.me/**", (route) => route.fulfill({ status: 204 }));
    await page.clock.fastForward(2_000);
    await submit.click();
    await expect.poll(() => requestCount).toBe(1);
    await expect(page.getByRole("button", { name: "Оформляем…" })).toBeDisabled();
    expect(sentPhone).toBe("77011234567");
    releaseRequest();
    await expect(page.getByRole("heading", { name: /Заказ принят/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть WhatsApp" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Следить за заказом" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Сделать новый заказ" })).toBeVisible();
    const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
    expect(error).toBeNull();
    expect(count).toBe(1);
    expect(requestCount).toBe(1);
  } finally {
    await cleanupUser(admin, email);
  }
});

test("количество озвучивается, удаление последней позиции можно отменить", async ({ page }) => {
  const s = stamp();
  const email = `cart-undo-${s}@example.test`;
  const slug = `cart-undo-${s}`;
  await seedShop(admin, { email, slug, products: [{ title: "Пирог", price: 1000 }] });
  try {
    await openCart(page, slug, ["Пирог"]);
    const line = page.getByRole("listitem").filter({ hasText: "Пирог" });
    const increase = line.getByRole("button", { name: "Увеличить" });
    const decrease = line.getByRole("button", { name: "Уменьшить" });
    for (const button of [increase, decrease]) {
      await expect(button).toBeVisible();
      await expect.poll(async () => (await button.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(44);
      await expect.poll(async () => (await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await increase.click();
    await expect(line.locator('[aria-live="polite"], [role="status"]')).toContainText("2");
    await decrease.click();
    await decrease.click();
    await expect(page.getByRole("heading", { name: "Корзина пуста" })).toBeVisible();
    await page.getByRole("button", { name: "Вернуть" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: "Пирог" })).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("ошибка сети оставляет заказ в корзине и разрешает повторить", async ({ page }) => {
  const s = stamp();
  const email = `cart-offline-${s}@example.test`;
  const slug = `cart-offline-${s}`;
  await seedShop(admin, { email, slug, products: [{ title: "Пирог", price: 1000 }] });
  try {
    await page.clock.install();
    await openCart(page, slug, ["Пирог"]);
    await page.getByLabel("Имя", { exact: true }).fill("Айгерим");
    await page.getByLabel("Телефон", { exact: true }).fill("87015550123");
    await page.getByLabel("Адрес", { exact: true }).fill("Абая 10");
    await page.route("**/rest/v1/rpc/create_order", (route) => route.abort("failed"));
    await page.clock.fastForward(2_000);
    await page.getByRole("button", { name: /Заказать в WhatsApp/ }).click();
    await expect(page.locator("p[role=alert]")).toContainText("Не удалось оформить заказ");
    await expect(page.getByRole("button", { name: /Заказать в WhatsApp/ })).toBeEnabled();
    await expect(page.getByRole("listitem").filter({ hasText: "Пирог" })).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("лента показывает фактический статус заказа на RU и KZ в обеих темах", async ({ page }) => {
  const s = stamp();
  const email = `cart-status-${s}@example.test`;
  const slug = `cart-status-${s}`;
  const { shopId } = await seedShop(admin, { email, slug });
  try {
    const { data, error } = await admin.from("orders").insert({
      shop_id: shopId,
      number: 1,
      items: [{ title: "Пирог", qty: 1, price: 1000 }],
      total: 1000,
      customer_name: "Айгерим",
      customer_phone: "77015550123",
      address: "Самовывоз",
      status: "new",
    }).select("id,public_code").single();
    expect(error).toBeNull();
    expect(data).toBeTruthy();

    for (const theme of ["light", "dark"]) {
      await page.goto(`/${slug}`);
      await page.evaluate((value) => localStorage.setItem("sore-theme", value), theme);
      for (const [status, ru, kz] of [
        ["new", "Принят", "Қабылданды"],
        ["done", "Выполнен", "Орындалды"],
        ["cancelled", "Отменён", "Бас тартылды"],
      ] as const) {
        const update = await admin.from("orders").update({ status }).eq("id", data!.id);
        expect(update.error).toBeNull();
        for (const [query, label] of [["", ru], ["?lang=kz", kz]]) {
          await page.goto(`/o/${data!.public_code}${query}`);
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          const timeline = page.locator("main ol");
          await expect(timeline).toBeVisible();
          await expect(timeline.getByText(label, { exact: true })).toBeVisible();
          if (status !== "new") await expect(timeline.locator("li")).toHaveCount(2);
        }
      }
    }
  } finally {
    await cleanupUser(admin, email);
  }
});
