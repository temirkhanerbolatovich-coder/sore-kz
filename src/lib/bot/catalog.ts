// Прайс из бота: тот же разбор (parseCatalog) и та же функция базы (import_products), что у веб-кабинета.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CatalogFileError, detectKind, MAX_FILE_BYTES, parseCatalog, toCsv } from "@/lib/catalog-file";
import { IMPORT_SKIP_REASON } from "@/lib/catalog-template";
import { refreshStorefront, type LinkedShop } from "@/lib/bot/shop-link";
import { checkRateLimit } from "@/lib/rate-limit";

export { MAX_FILE_BYTES as MAX_CATALOG_BYTES, detectKind as detectCatalogKind };

export type ImportResult =
  | { ok: true; created: number; updated: number; skipped: number; total: number; reportCsv: string | null }
  | { ok: false; message: string };

/** Проверка до скачивания: тип и размер известны из сообщения Telegram. */
export function precheckCatalog(fileName: string, size: number | undefined): string | null {
  const kind = detectKind(fileName);
  if (kind === "xls") return "Формат .xls не поддерживается. Сохраните файл в Excel как .xlsx и пришлите снова.";
  if (!kind) return "Нужен файл .xlsx или .csv.";
  if ((size ?? 0) > MAX_FILE_BYTES) return "Файл больше 4 МБ. Разбейте прайс на части.";
  return null;
}

export async function importCatalogFromBot(db: SupabaseClient, shop: LinkedShop, fileName: string, data: Buffer): Promise<ImportResult> {
  const kind = detectKind(fileName);
  if (kind !== "xlsx" && kind !== "csv") return { ok: false, message: "Нужен файл .xlsx или .csv." };
  // Ключ общий с веб-маршрутом: 20 загрузок в час на магазин, откуда бы они ни пришли.
  if ((await checkRateLimit(`import:${shop.id}`, 3600, 20)) !== 200) {
    return { ok: false, message: "Слишком много загрузок за час. Попробуйте позже." };
  }

  let parsed: Awaited<ReturnType<typeof parseCatalog>>;
  try {
    parsed = await parseCatalog(data, kind);
  } catch (error) {
    if (error instanceof CatalogFileError) return { ok: false, message: error.userMessage };
    console.error("bot import parse failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Не удалось прочитать файл. Пересохраните его в Excel и пришлите ещё раз." };
  }

  let created = 0;
  let updated = 0;
  let skipped: { row: number; reason: string }[] = [];
  if (parsed.rows.length > 0) {
    // Сервисная роль: владельца уже проверила привязка чата (findLinkedShop), shop_id явный.
    const { data: result, error } = await db.rpc("import_products", { p_shop: shop.id, p_rows: parsed.rows });
    if (error) {
      if (error.message.includes("import in progress")) return { ok: false, message: "⏳ Предыдущий файл ещё загружается. Подождите минуту и пришлите снова." };
      console.error("bot import_products failed:", error.message);
      return { ok: false, message: "Не удалось сохранить товары. Попробуйте ещё раз." };
    }
    const r = result as { created: number; updated: number; skipped: { row: number; reason: string }[] };
    created = r.created;
    updated = r.updated;
    skipped = r.skipped;
    refreshStorefront(shop.slug);
  }

  const report = [...parsed.errors, ...skipped.map((s) => ({ row: s.row, message: IMPORT_SKIP_REASON[s.reason] ?? IMPORT_SKIP_REASON.invalid }))].sort((a, b) => a.row - b.row);
  return {
    ok: true,
    created,
    updated,
    skipped: report.length,
    total: parsed.total,
    reportCsv: report.length > 0 ? toCsv([["Строка", "Ошибка"], ...report.map((r) => [r.row, r.message])]) : null,
  };
}
