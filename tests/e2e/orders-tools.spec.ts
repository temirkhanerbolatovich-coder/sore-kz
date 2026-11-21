import { test, expect } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const almatyDate = (plusDays: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(Date.now() + plusDays * 86_400_000);

test("заказы: поиск, фильтр по дате и выгрузка CSV", async ({ page, request }) => {
  const s = stamp();
  const email = `orders-${s}@example.test`;
  const { shopId } = await seedShop(admin, { email, slug: `orders-${s}` });
  const needed = almatyDate(5);
  const item = (title: string, price: number) => [{ id: "00000000-0000-4000-8000-000000000001", title, qty: 1, price }];
  const { error } = await admin.from("orders").insert([
    { number: 1, shop_id: shopId, items: item("Торт", 5000), total: 5000, customer_name: "Айгерим", customer_phone: "77015550101", address: "Самовывоз", status: "new", needed_date: needed, needed_time: "18:00" },
    { number: 2, shop_id: shopId, items: item("Эклеры", 3000), total: 3000, customer_name: "Данияр", customer_phone: "77025550202", address: "ул. Абая 1", status: "new", comment: "=1+1" },
    { number: 3, shop_id: shopId, items: item("Пирог", 1000), total: 1000, customer_name: "Айгерим Б", customer_phone: "77015550303", address: "Самовывоз", status: "done" },
  ]);
  expect(error).toBeNull();
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/orders?status=all");
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toBeVisible();
    await expect(page.getByText("№2 · Данияр", { exact: true })).toBeVisible();
    await expect(page.getByText("№3 · Айгерим Б", { exact: true })).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Поиск по номеру, имени или телефону" });
    const submit = page.getByRole("button", { name: "Найти", exact: true });

    // По имени.
    await search.fill("Данияр");
    await submit.click();
    await expect(page).toHaveURL(/q=%D0%94/);
    await expect(page.getByText("№2 · Данияр", { exact: true })).toBeVisible();
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toHaveCount(0);

    // По части телефона.
    await search.fill("5550101");
    await submit.click();
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toBeVisible();
    await expect(page.getByText("№2 · Данияр", { exact: true })).toHaveCount(0);

    // По номеру заказа.
    await search.fill("2");
    await submit.click();
    await expect(page.getByText("№2 · Данияр", { exact: true })).toBeVisible();
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toHaveCount(0);

    // Служебные символы в поиске не ломают страницу и ничего не находят.
    await search.fill("x),status.eq.done,(y");
    await submit.click();
    await expect(page.getByText("Ничего не найдено")).toBeVisible();

    // Сброс возвращает все заказы.
    await page.getByRole("link", { name: "Сбросить поиск" }).click();
    await expect(page.getByText("№3 · Айгерим Б", { exact: true })).toBeVisible();
    await expect(page.getByText("№2 · Данияр", { exact: true })).toBeVisible();

    // Дата «когда нужно».
    await page.getByLabel("Когда нужно").fill(needed);
    await submit.click();
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toBeVisible();
    await expect(page.getByText("№2 · Данияр", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Сбросить поиск" }).click();

    // «Новые» + поиск: выполненный заказ №3 скрыт.
    await page.getByRole("link", { name: "Новые", exact: true }).click();
    await search.fill("Айгерим");
    await submit.click();
    await expect(page.getByText("№1 · Айгерим", { exact: true })).toBeVisible();
    await expect(page.getByText("№3 · Айгерим Б", { exact: true })).toHaveCount(0);

    // CSV: только найденное, формулы нейтрализованы, формат для Excel.
    const filtered = await page.request.get("/dashboard/orders/export?status=all&q=%D0%94%D0%B0%D0%BD%D0%B8%D1%8F%D1%80");
    expect(filtered.status()).toBe(200);
    expect(filtered.headers()["content-type"]).toContain("text/csv");
    expect(filtered.headers()["content-disposition"]).toMatch(/^attachment; filename="orders-orders-.*\.csv"$/);
    const csv = await filtered.text();
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Данияр");
    expect(csv).toContain("'=1+1");
    expect(csv).not.toContain("Айгерим");

    const all = (await (await page.request.get("/dashboard/orders/export?status=all")).text()).trimEnd().split("\r\n");
    expect(all).toHaveLength(4);

    // Без входа выгрузка недоступна.
    const anonymous = await request.get("/dashboard/orders/export", { maxRedirects: 0 });
    expect([307, 308]).toContain(anonymous.status());
    expect(anonymous.headers().location).toContain("/login");
  } finally {
    await cleanupUser(admin, email);
  }
});
