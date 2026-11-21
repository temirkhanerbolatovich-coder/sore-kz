import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

async function xlsxFile(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Прайс");
  rows.forEach((r) => ws.addRow(r));
  return { name: "price.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}
const csvFile = (text: string, name = "price.csv") => ({ name, mimeType: "text/csv", buffer: Buffer.from(text, "utf8") });

test("импорт прайса: шаблон, загрузка, обновление по артикулу и отчёт об ошибках", async ({ page, request }) => {
  const s = stamp();
  const email = `import-${s}@example.test`;
  const slug = `import-${s}`;
  const { shopId } = await seedShop(admin, { email, slug });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Прайс из Excel", exact: true })).toHaveAttribute("href", "/dashboard/products/import");
    await page.goto("/dashboard/products/import");
    await page.waitForLoadState("networkidle");

    // Шаблоны отдаются и разбираются самим приложением.
    for (const format of ["xlsx", "csv"]) {
      const response = await request.get(`/api/import/template?format=${format}`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-disposition"]).toContain(`sore-price-template.${format}`);
    }
    expect((await (await request.get("/api/import/template?format=csv")).text()).startsWith("﻿Название;Цена;")).toBe(true);

    // 1. Первая загрузка: два товара, одна битая строка.
    await page.locator("#import-file").setInputFiles(
      await xlsxFile([["Название", "Цена", "Артикул", "Категория", "Количество"], ["Хлеб белый", "250", "BR-1", "Выпечка", 12], ["Сок яблочный", "1 200 ₸", "JU-1", "Напитки", 0], ["Без цены", "", "NP-1", "", ""]]),
    );
    await page.getByRole("button", { name: "Загрузить прайс" }).click();
    const summary = page.getByRole("status", { name: "Итог загрузки" });
    await expect(summary).toContainText("Прайс загружен");
    await expect(summary).toContainText("Добавлено: 2");
    await expect(summary).toContainText("Обновлено: 0");
    await expect(summary).toContainText("Пропущено: 1 из 3");
    await expect(summary).toContainText("Строка 4: нет цены");

    // Отчёт скачивается как CSV для Excel.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Скачать отчёт об ошибках" }).click()]);
    const report = (await readFile((await download.path())!, "utf8")).replace(/^﻿/, "");
    expect(report).toContain("Строка;Причина");
    expect(report).toContain("4;нет цены");

    const { data: first } = await admin.from("products").select("title,price,price_mode,category,sku,in_stock").eq("shop_id", shopId).order("sort");
    expect(first).toEqual([
      { title: "Хлеб белый", price: 250, price_mode: "fixed", category: "Выпечка", sku: "BR-1", in_stock: true },
      { title: "Сок яблочный", price: 1200, price_mode: "fixed", category: "Напитки", sku: "JU-1", in_stock: false },
    ]);

    // 2. Повторная загрузка: артикулы совпали — товары обновляются, дублей нет.
    await page.getByRole("link", { name: "К товарам" }).click();
    await page.goto("/dashboard/products/import");
    await page.waitForLoadState("networkidle");
    await page.locator("#import-file").setInputFiles(csvFile("Название;Цена;Артикул\nХлеб белый «Новый»;300;BR-1\nМолоко;450;MI-1\n"));
    await page.getByRole("button", { name: "Загрузить прайс" }).click();
    await expect(page.getByRole("status", { name: "Итог загрузки" })).toContainText("Добавлено: 1");
    await expect(page.getByRole("status", { name: "Итог загрузки" })).toContainText("Обновлено: 1");

    const { data: second } = await admin.from("products").select("title,price,category,sku").eq("shop_id", shopId).order("sort");
    expect(second).toHaveLength(3);
    // Пустая категория в файле не затирает уже заполненную.
    expect(second!.find((p) => p.sku === "BR-1")).toEqual({ title: "Хлеб белый «Новый»", price: 300, category: "Выпечка", sku: "BR-1" });

    // 3. Витрина видит новые товары сразу (кэш сброшен).
    await page.goto(`/${slug}`);
    await expect(page.getByText("Молоко")).toBeVisible();
    await expect(page.getByText("Хлеб белый «Новый»")).toBeVisible();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("импорт прайса: сверх бесплатного лимита строки идут в отчёт, существующие обновляются", async ({ page, request }) => {
  const s = stamp();
  const email = `import-limit-${s}@example.test`;
  const { shopId } = await seedShop(admin, { email, slug: `import-limit-${s}` });
  try {
    await loginAs(page, request, email);
    await page.goto("/dashboard/products/import");
    await page.waitForLoadState("networkidle");
    const rows = Array.from({ length: 20 }, (_, i) => `Товар ${i + 1};${100 + i};SKU-${i + 1}`).join("\n");
    await page.locator("#import-file").setInputFiles(csvFile(`Название;Цена;Артикул\n${rows}\n`));
    await page.getByRole("button", { name: "Загрузить прайс" }).click();
    const summary = page.getByRole("status", { name: "Итог загрузки" });
    await expect(summary).toContainText("Добавлено: 15");
    await expect(summary).toContainText("Пропущено: 5 из 20");
    await expect(summary).toContainText("лимит товаров вашего тарифа");
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shopId);
    expect(count).toBe(15);

    // Лимит исчерпан: новые не добавляются, но обновить существующий по артикулу можно.
    await page.goto("/dashboard/products/import");
    await page.waitForLoadState("networkidle");
    await page.locator("#import-file").setInputFiles(csvFile("Название;Цена;Артикул\nТовар 1 обновлён;999;SKU-1\nЛишний;1;NEW-1\n"));
    await expect(page.getByRole("button", { name: "Загрузить прайс" })).toBeDisabled();
  } finally {
    await cleanupUser(admin, email);
  }
});

test("импорт прайса: понятные ошибки файла и закрытый доступ", async ({ page, request }) => {
  const s = stamp();
  const email = `import-bad-${s}@example.test`;
  await seedShop(admin, { email, slug: `import-bad-${s}` });
  try {
    // Без входа
    const anonymous = await request.post("/api/import", { multipart: { file: csvFile("Название;Цена\nА;1\n") } });
    expect(anonymous.status()).toBe(401);

    await loginAs(page, request, email);
    await page.goto("/dashboard/products/import");
    await page.waitForLoadState("networkidle");
    const upload = async (file: { name: string; mimeType: string; buffer: Buffer }) => {
      await page.locator("#import-file").setInputFiles(file);
      await page.getByRole("button", { name: "Загрузить прайс" }).click();
    };
    await upload(csvFile("Foo;Bar\n1;2\n"));
    await expect(page.locator("p[role=alert]")).toContainText("Не нашли колонки с названием и ценой");
    await upload({ name: "old.xls", mimeType: "application/vnd.ms-excel", buffer: Buffer.from("x") });
    await expect(page.locator("p[role=alert]")).toContainText("Сохраните файл в Excel как .xlsx");
    await upload({ name: "fake.xlsx", mimeType: "application/octet-stream", buffer: Buffer.from("это не архив") });
    await expect(page.locator("p[role=alert]")).toContainText("Не удалось открыть файл");
    await upload({ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") });
    await expect(page.locator("p[role=alert]")).toContainText("Нужен файл .xlsx или .csv");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  } finally {
    await cleanupUser(admin, email);
  }
});
