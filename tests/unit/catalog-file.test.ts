import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { CatalogFileError, csvCell, detectKind, MAX_FILE_BYTES, MAX_ROWS, parseCatalog, parseCsvText, parsePrice, TEMPLATE_EXAMPLES, TEMPLATE_HEADER, toCsv } from "@/lib/catalog-file";
import { assertSafeZip, UnsafeZipError } from "@/lib/zip-guard";

const csv = (text: string, encoding: "utf8" | "win1251" = "utf8") => (encoding === "utf8" ? Buffer.from(text, "utf8") : Buffer.from(toWin1251(text), "latin1"));

/** Минимальный кодировщик Windows-1251 для теста (кириллица и цифры). */
function toWin1251(text: string): string {
  const map = new Map<string, number>();
  for (let i = 0; i < 64; i++) map.set(String.fromCharCode(0x410 + i), 0xc0 + i);
  map.set("Ё", 0xa8);
  map.set("ё", 0xb8);
  return [...text].map((ch) => String.fromCharCode(ch.charCodeAt(0) < 128 ? ch.charCodeAt(0) : (map.get(ch) ?? 0x3f))).join("");
}

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Прайс");
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Собирает zip вручную, чтобы можно было «соврать» в заголовках про размер. */
function zip(entries: { name: string; data: Buffer; method?: 0 | 8; declared?: number }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const method = e.method ?? 8;
    const body = method === 8 ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(e.data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.declared ?? e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, body);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt32LE(crc32(e.data), 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(e.declared ?? e.data.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, name);
    offset += 30 + name.length + body.length;
  }
  const dirBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dirBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dirBuf, end]);
}

describe("parsePrice", () => {
  it.each([
    ["1 500,50 ₸", 1500.5],
    ["1 500", 1500],
    ["12000тг", 12000],
    ["12 000 тенге", 12000],
    ["1.500", 1500],
    ["1,500", 1500],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["0.5", 0.5],
    ["450,5", 450.5],
    ["  900  ", 900],
    [350, 350],
  ])("%j → %j", (input, expected) => expect(parsePrice(input)).toBe(expected));

  it("пусто — undefined, мусор — NaN", () => {
    expect(parsePrice("")).toBeUndefined();
    expect(parsePrice(null)).toBeUndefined();
    for (const bad of ["abc", "12abc", "1,5,3", "--5", "1e3", {}]) expect(parsePrice(bad)).toBeNaN();
  });
});

describe("CSV", () => {
  it("читает ; , и табуляцию", async () => {
    for (const d of [";", ",", "\t"]) {
      const out = await parseCatalog(csv(`Название${d}Цена\nХлеб${d}250\n`), "csv");
      expect(out.rows).toEqual([expect.objectContaining({ title: "Хлеб", price: 250, row: 2 })]);
    }
  });

  it("RFC 4180: кавычки, «;» и перевод строки внутри поля", async () => {
    const out = await parseCatalog(csv('name;price_kzt;description\n"Торт ""Прага""; 1 кг";12 000;"Две\nстроки"\n'), "csv");
    expect(out.rows[0]).toMatchObject({ title: 'Торт "Прага"; 1 кг', price: 12000, description: "Две строки" });
  });

  it("UTF-8 с BOM и Windows-1251 (русский Excel)", async () => {
    const text = "Название;Цена\nМолоко;450\n";
    expect((await parseCatalog(csv("﻿" + text), "csv")).rows[0].title).toBe("Молоко");
    expect((await parseCatalog(csv(text, "win1251"), "csv")).rows[0].title).toBe("Молоко");
  });

  it("разные переводы строк и пустые строки", async () => {
    const out = await parseCatalog(csv("Название;Цена\r\nА;1\r\n\r\n;;\r\nБ;2\r\n"), "csv");
    expect(out.rows.map((r) => [r.title, r.row])).toEqual([["А", 2], ["Б", 5]]);
    expect(out.total).toBe(2);
  });

  it("parseCsvText без заголовков тоже работает", () => {
    expect(parseCsvText("a,b\n1,2", ",")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("заголовки и значения", () => {
  it("русские, казахские и английские заголовки, лишние пробелы и регистр", async () => {
    for (const header of ["Название;Цена, ₸;Артикул;Категория", "  НАИМЕНОВАНИЕ ;Цена (тг);Код;Группа", "Атауы;Баға;sku;Санат", "name;price_kzt;sku;category"]) {
      const out = await parseCatalog(csv(`${header}\nЧай;1 200,5;T-1;Напитки\n`), "csv");
      expect(out.rows[0]).toMatchObject({ title: "Чай", price: 1201, sku: "T-1", category: "Напитки" });
    }
  });

  it("количество → наличие, описание на казахском", async () => {
    const out = await parseCatalog(csv("Название;Цена;Количество;Описание (каз)\nА;1;0;Сипаттама\nБ;2;5;\nВ;3;;\n"), "csv");
    expect(out.rows.map((r) => r.in_stock)).toEqual([false, true, null]);
    expect(out.rows[0].description_kz).toBe("Сипаттама");
  });

  it("цена 0 допустима (по запросу), пустая — ошибка", async () => {
    const out = await parseCatalog(csv("Название;Цена\nУслуга;0\nБез цены;\n"), "csv");
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].price).toBe(0);
    expect(out.errors).toEqual([{ row: 3, message: expect.stringContaining("нет цены") }]);
  });

  it("ошибки строк не останавливают импорт и называют номер строки как в Excel", async () => {
    const out = await parseCatalog(csv(`Название;Цена\nОк;100\n;100\nБитая;abc\nМинус;-5\nГигант;999999999999\n${"Д".repeat(121)};5\nХорошая;200\n`), "csv");
    expect(out.rows.map((r) => r.title)).toEqual(["Ок", "Хорошая"]);
    expect(out.errors.map((e) => e.row)).toEqual([3, 4, 5, 6, 7]);
    expect(out.errors[0].message).toContain("нет названия");
    expect(out.errors[1].message).toContain("не число");
    expect(out.errors[2].message).toContain("отрицательная");
    expect(out.errors[3].message).toContain("слишком большая");
    expect(out.errors[4].message).toContain("120");
    expect(out.total).toBe(7);
  });

  it("дубль артикула в файле: побеждает последняя строка, ранняя уходит в отчёт", async () => {
    const out = await parseCatalog(csv("Название;Цена;Артикул\nСтарое;10;A-1\nДругое;20;B-2\nНовое;30;A-1\n"), "csv");
    expect(out.rows.map((r) => [r.title, r.sku])).toEqual([["Новое", "A-1"], ["Другое", "B-2"]]);
    expect(out.errors).toEqual([{ row: 2, message: expect.stringContaining("взята строка 4") }]);
  });

  it("нет колонок названия и цены — понятная ошибка", async () => {
    await expect(parseCatalog(csv("Foo;Bar\n1;2\n"), "csv")).rejects.toThrow(CatalogFileError);
    await expect(parseCatalog(csv("Foo;Bar\n1;2\n"), "csv")).rejects.toThrow(/Название[\s\S]*Цена/);
  });

  it("пустой файл и только заголовки", async () => {
    await expect(parseCatalog(Buffer.alloc(0), "csv")).rejects.toThrow("Файл пустой");
    await expect(parseCatalog(csv("\n\n"), "csv")).rejects.toThrow("Файл пустой");
    await expect(parseCatalog(csv("Название;Цена\n"), "csv")).rejects.toThrow("товаров нет");
  });

  it("лимиты: размер файла и число строк", async () => {
    await expect(parseCatalog(Buffer.alloc(MAX_FILE_BYTES + 1), "csv")).rejects.toThrow("4 МБ");
    const many = "Название;Цена\n" + Array.from({ length: MAX_ROWS + 1 }, (_, i) => `Т${i};1`).join("\n");
    await expect(parseCatalog(csv(many), "csv")).rejects.toThrow(String(MAX_ROWS));
    const ok = "Название;Цена\n" + Array.from({ length: MAX_ROWS }, (_, i) => `Т${i};1`).join("\n");
    expect((await parseCatalog(csv(ok), "csv")).rows).toHaveLength(MAX_ROWS);
  });
});

describe("XLSX", () => {
  it("читает числа, текст, формулы и строки со смещением заголовка", async () => {
    const buf = await xlsx([["Прайс на ноябрь"], ["Название", "Цена", "Артикул", "Количество"], ["Хлеб", 250, "H-1", 10], ["Сок", { formula: "100*2", result: 200 }, "S-1", 0], ["Вода", "1 200 ₸", "V-1"]]);
    const out = await parseCatalog(buf, "xlsx");
    expect(out.rows.map((r) => [r.title, r.price, r.sku, r.in_stock, r.row])).toEqual([
      ["Хлеб", 250, "H-1", true, 3],
      ["Сок", 200, "S-1", false, 4],
      ["Вода", 1200, "V-1", null, 5],
    ]);
  });

  it("шаблон из приложения разбирается без ошибок", async () => {
    const out = await parseCatalog(await xlsx([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES]), "xlsx");
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(2);
    const fromCsv = await parseCatalog(Buffer.from(toCsv([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES]), "utf8"), "csv");
    expect(fromCsv.rows).toEqual(out.rows);
  });

  it("не xlsx под видом xlsx — понятная ошибка, а не падение", async () => {
    await expect(parseCatalog(Buffer.from("Название;Цена\nА;1\n"), "xlsx")).rejects.toThrow(CatalogFileError);
  });
});

describe("zip-бомба", () => {
  const big = Buffer.alloc(64 * 1024 * 1024); // 64 МБ нулей: в архиве около 64 КБ

  it("обычный xlsx проходит проверку", async () => {
    expect(() => assertSafeZip(Buffer.from(Buffer.alloc(0)))).toThrow(UnsafeZipError);
    await expect(xlsx([["Название", "Цена"], ["А", 1]]).then(assertSafeZip)).resolves.toBeUndefined();
  });

  it("настоящая распаковка выше лимита отклоняется, даже если заголовок «врёт» про размер", async () => {
    const bomb = zip([{ name: "xl/worksheets/sheet1.xml", data: big, declared: 10 }]);
    expect(bomb.length).toBeLessThan(200_000);
    expect(() => assertSafeZip(bomb)).toThrow(/слишком большой после распаковки/);
    await expect(parseCatalog(bomb, "xlsx")).rejects.toThrow(CatalogFileError);
  });

  it("много записей, шифрование, zip64 и обрезанный архив отклоняются", () => {
    const entries = Array.from({ length: 201 }, (_, i) => ({ name: `f${i}.xml`, data: Buffer.from("x") }));
    expect(() => assertSafeZip(zip(entries))).toThrow(/слишком много/);
    const ok = zip([{ name: "a.xml", data: Buffer.from("<a/>") }]);
    expect(() => assertSafeZip(ok)).not.toThrow();
    expect(() => assertSafeZip(ok.subarray(0, ok.length - 30))).toThrow(UnsafeZipError);
    const encrypted = Buffer.from(ok);
    encrypted.writeUInt16LE(1, encrypted.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 8);
    expect(() => assertSafeZip(encrypted)).toThrow(/зашифрован/);
  });
});

describe("служебное", () => {
  it("detectKind", () => {
    expect(detectKind("Прайс.XLSX")).toBe("xlsx");
    expect(detectKind("a.csv")).toBe("csv");
    expect(detectKind("a.xls")).toBe("xls");
    expect(detectKind("a.pdf")).toBeNull();
  });

  it("CSV безопасен для Excel: формулы экранируются, кавычки удваиваются", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+7 701")).toBe("'+7 701");
    expect(csvCell("а;б")).toBe('"а;б"');
    expect(csvCell(5)).toBe("5");
    expect(toCsv([["a", "b"]]).startsWith("﻿a;b\r\n")).toBe(true);
  });
});
