import { z } from "zod";
import { csvCell, toCsv } from "@/lib/csv-export";
import { assertSafeZip, UnsafeZipError } from "@/lib/zip-guard";

/**
 * Разбор прайса (.xlsx или .csv) в строки товаров. Чистая функция: ничего не пишет в базу.
 * Колонки (английские, русские и казахские заголовки, регистр и пробелы не важны):
 *   обязательные: название (name), цена (price_kzt);
 *   по желанию:   артикул (sku), категория (category), описание (description), описание на казахском (description_kz),
 *                 количество (quantity): 0 → «нет в наличии», больше 0 → «в наличии».
 * Ошибка в строке не останавливает импорт: строка попадает в отчёт, остальные загружаются.
 */

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_ROWS = 2000;
const MAX_COLUMNS = 40;

export type CatalogField = "title" | "price" | "sku" | "category" | "description" | "descriptionKz" | "quantity";

const HEADERS: Record<CatalogField, string[]> = {
  title: ["name", "name_ru", "title", "название", "название товара", "наименование", "наименование товара", "товар", "атауы"],
  price: ["price_kzt", "price", "цена", "цена тг", "цена тенге", "цена kzt", "стоимость", "баға", "бағасы"],
  sku: ["sku", "артикул", "код", "код товара", "article", "артикул товара"],
  category: ["category", "категория", "группа", "санат"],
  description: ["description", "description_ru", "описание", "описание рус", "сипаттама рус"],
  descriptionKz: ["description_kz", "description_kk", "описание каз", "описание на казахском", "сипаттама", "сипаттамасы"],
  quantity: ["quantity", "qty", "количество", "кол-во", "кол во", "остаток", "остатки", "саны"],
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[()₸,.:;"'«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const LOOKUP = new Map<string, CatalogField>(
  Object.entries(HEADERS).flatMap(([field, names]) => names.map((name) => [normalizeHeader(name), field as CatalogField] as const)),
);

export class CatalogFileError extends Error {
  constructor(readonly userMessage: string) {
    super(userMessage);
    this.name = "CatalogFileError";
  }
}

export type CatalogKind = "xlsx" | "csv";

/** Формат по имени файла; .xls и остальное не поддерживается. */
export function detectKind(fileName: string): CatalogKind | "xls" | null {
  const name = fileName.toLowerCase();
  if (name.endsWith(".xlsx")) return "xlsx";
  if (name.endsWith(".csv") || name.endsWith(".txt")) return "csv";
  if (name.endsWith(".xls")) return "xls";
  return null;
}

// ---------- числа ----------

const NBSP = /[\s   ]/g;

/**
 * «1 500,50 ₸» → 1500.5, «1.500» → 1500, «1,500» → 1500, «12000тг» → 12000, «1.234,56» → 1234.56.
 * Одиночный разделитель с ровно тремя цифрами после (и 1–3 цифрами до) считается разделителем тысяч:
 * цены в тенге целые, дробные тенге встречаются редко. Остальное: запятая и точка — десятичные.
 * undefined — пусто, NaN — не число.
 */
export function parsePrice(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  if (typeof value !== "string") return Number.NaN;
  let s = value.replace(NBSP, "").replace(/(тенге|тг|₸|kzt|т)\.?$/i, "");
  if (s === "") return undefined;
  if (!/^-?[0-9.,]+$/.test(s)) return Number.NaN;
  const dots = (s.match(/\./g) ?? []).length;
  const commas = (s.match(/,/g) ?? []).length;
  if (dots && commas) {
    const decimal = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else if (dots + commas > 0) {
    const sep = dots ? "." : ",";
    const parts = s.split(sep);
    const grouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && /^-?[1-9][0-9]{0,2}$/.test(parts[0]);
    s = grouped ? parts.join("") : parts.length === 2 ? `${parts[0]}.${parts[1]}` : "x";
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

// ---------- CSV ----------

function decodeCsv(buf: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    // Русский Excel сохраняет CSV в Windows-1251.
    text = new TextDecoder("windows-1251").decode(buf);
  }
  return text.replace(/^﻿/, "");
}

function detectDelimiter(text: string): string {
  // Считаем разделители только в первой непустой строке и вне кавычек.
  const line = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== "") ?? "";
  const counts: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ";";
}

/** RFC 4180: кавычки, удвоенные кавычки, переводы строк внутри полей. */
export function parseCsvText(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      if (rows.length > MAX_ROWS + 50) throw new CatalogFileError(`В файле больше ${MAX_ROWS} строк. Разбейте его на части.`);
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// ---------- XLSX ----------

type CellValue = string | number | boolean | Date | null | undefined | { text?: unknown; result?: unknown; richText?: { text: string }[]; hyperlink?: string; error?: string };

function cellToValue(value: CellValue): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value && value.result !== undefined) return cellToValue(value.result as CellValue); // формула: берём результат
    if (value.richText) return value.richText.map((r) => r.text).join("");
    if ("text" in value && value.text !== undefined) return value.text;
    return undefined;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

async function readXlsx(buf: Buffer): Promise<unknown[][]> {
  try {
    assertSafeZip(buf);
  } catch (error) {
    if (error instanceof UnsafeZipError) throw new CatalogFileError(`Не удалось открыть файл: ${error.message}. Пересохраните прайс в Excel как .xlsx.`);
    throw error;
  }
  // exceljs тяжёлый: подключаем только когда пришёл именно xlsx.
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buf as unknown as ArrayBuffer);
  } catch {
    throw new CatalogFileError("Не получилось открыть .xlsx. Пересохраните файл в Excel и загрузите ещё раз.");
  }
  const sheet = workbook.worksheets.find((s) => s.rowCount > 0);
  if (!sheet) throw new CatalogFileError("В файле нет листа с данными.");
  const table: unknown[][] = [];
  let seen = 0;
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (++seen > MAX_ROWS + 50) throw new CatalogFileError(`В файле больше ${MAX_ROWS} строк. Разбейте его на части.`);
    const values = (row.values as CellValue[]).slice(1, MAX_COLUMNS + 1); // values[0] пустой
    table[rowNumber - 1] = values.map(cellToValue);
  });
  return Array.from(table, (cells) => cells ?? []);
}

// ---------- проверка строк ----------

const text = (max: number, label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? undefined : String(v).replace(/\s+/g, " ").trim() || undefined),
    z.string().max(max, `${label}: не длиннее ${max} символов`).optional(),
  );

const rowSchema = z.object({
  title: z.preprocess(
    (v) => (v === undefined || v === null ? "" : String(v).replace(/\s+/g, " ").trim()),
    z.string().min(1, "нет названия").max(120, "название длиннее 120 символов"),
  ),
  price: z.unknown().transform((raw, ctx) => {
    const n = parsePrice(raw);
    const fail = (message: string) => {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    };
    if (n === undefined) return fail("нет цены");
    if (Number.isNaN(n)) return fail("цена — не число");
    if (n < 0) return fail("цена отрицательная");
    if (n > 100_000_000) return fail("слишком большая цена");
    return Math.round(n);
  }),
  sku: text(100, "артикул"),
  category: text(60, "категория"),
  description: text(1000, "описание"),
  descriptionKz: text(1000, "описание на казахском"),
  quantity: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === "string" && v.trim() === "") ? undefined : parsePrice(v)),
    z
      .number()
      .refine((n) => !Number.isNaN(n), "количество — не число")
      .refine((n) => n >= 0 && n <= 1_000_000, "количество от 0 до 1 000 000")
      .optional(),
  ),
});

export type CatalogRow = {
  /** Номер строки в файле, как в Excel (заголовок — строка 1). */
  row: number;
  title: string;
  price: number;
  sku: string | null;
  category: string | null;
  description: string | null;
  description_kz: string | null;
  in_stock: boolean | null;
};

export type CatalogError = { row: number; message: string };

export type ParsedCatalog = { rows: CatalogRow[]; errors: CatalogError[]; total: number; columns: CatalogField[] };

/** Разбирает файл. Бросает CatalogFileError с понятным текстом, если файл целиком непригоден. */
export async function parseCatalog(data: Buffer, kind: CatalogKind): Promise<ParsedCatalog> {
  if (data.length === 0) throw new CatalogFileError("Файл пустой.");
  if (data.length > MAX_FILE_BYTES) throw new CatalogFileError("Файл больше 4 МБ. Разбейте прайс на части.");
  const table = kind === "xlsx" ? await readXlsx(data) : parseCsvText(decodeCsv(data));

  const isBlank = (cells: unknown[]) => cells.every((c) => c === undefined || c === null || String(c).trim() === "");
  if (table.every(isBlank)) throw new CatalogFileError("Файл пустой.");
  // Над таблицей бывает заголовок прайса («Прайс на ноябрь»): шапкой считаем первую из 20 строк, где есть название и цена.
  let headerIndex = -1;
  let fieldByColumn: (CatalogField | undefined)[] = [];
  for (let i = 0; i < Math.min(table.length, 20) && headerIndex < 0; i++) {
    const mapped = (table[i] ?? []).map((cell) => LOOKUP.get(normalizeHeader(cell)));
    if (mapped.includes("title") && mapped.includes("price")) {
      headerIndex = i;
      fieldByColumn = mapped;
    }
  }
  if (headerIndex < 0) {
    throw new CatalogFileError("Не нашли колонки с названием и ценой. В первой строке нужны заголовки, например: «Название» и «Цена» (или name, price_kzt). Скачайте шаблон.");
  }
  const columns = [...new Set(fieldByColumn.filter((f): f is CatalogField => Boolean(f)))];

  const dataRows = table.slice(headerIndex + 1);
  if (dataRows.length > MAX_ROWS + 20) throw new CatalogFileError(`В файле больше ${MAX_ROWS} строк. Разбейте его на части.`);

  const errors: CatalogError[] = [];
  const bySku = new Map<string, number>(); // артикул → индекс в rows
  const rows: CatalogRow[] = [];
  let total = 0;
  dataRows.forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    if (cells.every((c) => c === undefined || c === null || String(c).trim() === "")) return; // пустые строки не считаем
    total++;
    const raw: Partial<Record<CatalogField, unknown>> = {};
    fieldByColumn.forEach((field, index) => {
      if (field && raw[field] === undefined) raw[field] = cells[index];
    });
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      // Все сообщения схемы самодостаточны («нет цены», «цена — не число»), поэтому префикс с названием поля не нужен.
      const messages = parsed.error.issues.map((i) => i.message);
      errors.push({ row: rowNumber, message: [...new Set(messages)].join("; ") });
      return;
    }
    const v = parsed.data;
    const row: CatalogRow = {
      row: rowNumber,
      title: v.title,
      price: v.price,
      sku: v.sku ?? null,
      category: v.category ?? null,
      description: v.description ?? null,
      description_kz: v.descriptionKz ?? null,
      in_stock: v.quantity === undefined ? null : v.quantity > 0,
    };
    // Один артикул дважды в файле: берём последнюю строку, раннюю — в отчёт.
    if (row.sku) {
      const earlier = bySku.get(row.sku);
      if (earlier !== undefined) {
        const dropped = rows[earlier];
        errors.push({ row: dropped.row, message: `артикул «${row.sku}» повторяется, взята строка ${row.row}` });
        rows[earlier] = row;
        return;
      }
      bySku.set(row.sku, rows.length);
    }
    rows.push(row);
  });
  errors.sort((a, b) => a.row - b.row);
  if (total === 0) throw new CatalogFileError("В файле только заголовки, товаров нет.");
  if (total > MAX_ROWS) throw new CatalogFileError(`В файле ${total} товаров, за раз можно не больше ${MAX_ROWS}. Разбейте его на части.`);
  return { rows, errors, total, columns };
}

// ---------- отчёт и шаблон ----------

export { csvCell, toCsv };

export const TEMPLATE_HEADER = ["Название", "Цена", "Артикул", "Категория", "Описание", "Описание (каз)", "Количество"];
export const TEMPLATE_EXAMPLES: (string | number)[][] = [
  ["Торт «Прага» 1 кг", 12000, "CAKE-001", "Торты", "Шоколадный бисквит с кремом.", "Кремі бар шоколадты бисквит.", 5],
  ["Капкейки, набор 6 шт", 4500, "CUP-006", "Десерты", "", "", 0],
];
