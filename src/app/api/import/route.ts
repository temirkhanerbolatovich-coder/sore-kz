import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CatalogFileError, detectKind, MAX_FILE_BYTES, parseCatalog } from "@/lib/catalog-file";
import { IMPORT_SKIP_REASON } from "@/lib/catalog-template";
import { checkRateLimit } from "@/lib/rate-limit";
import { invalidateShopFromRoute } from "@/lib/shop-data";
import { getUiLang, tr } from "@/lib/ui-lang";
import { importMessageKz } from "@/lib/import-messages";

/**
 * Импорт прайса: файл → проверка строк → одна транзакция в БД (функция import_products от имени продавца,
 * RLS и лимит тарифа действуют как обычно). Server Actions ограничены 1 МБ, поэтому Route Handler.
 * Строки с ошибками не останавливают импорт: они возвращаются в отчёте.
 */
export const maxDuration = 60;

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const lang = await getUiLang();
  const t = (ru: string, kz: string) => tr(lang, ru, kz);
  // Сообщения разбора файла приходят по-русски; для казахского кабинета переводим их по шаблонам.
  const msg = (ru: string) => (lang === "kz" ? importMessageKz(ru) : ru);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, t("Войдите в аккаунт.", "Аккаунтқа кіріңіз."));
  const { data: shop } = await supabase.from("shops").select("id,slug").eq("owner_id", user.id).maybeSingle();
  if (!shop) return fail(404, t("Сначала создайте магазин.", "Алдымен дүкен ашыңыз."));

  // Заранее отсекаем заведомо большой запрос, не читая тело.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 256 * 1024) return fail(413, msg("Файл больше 4 МБ. Разбейте прайс на части."));

  if ((await checkRateLimit(`import:${shop.id}`, 3600, 20)) !== 200) {
    return fail(429, t("Слишком много загрузок за час. Попробуйте позже.", "Бір сағатта жүктеу тым көп. Кейінірек қайталап көріңіз."));
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(400, t("Выберите файл .xlsx или .csv.", ".xlsx немесе .csv файлын таңдаңыз."));
  if (file.size > MAX_FILE_BYTES) return fail(413, msg("Файл больше 4 МБ. Разбейте прайс на части."));
  const kind = detectKind(file.name);
  if (kind === "xls") return fail(400, t("Формат .xls не поддерживается. Сохраните файл в Excel как .xlsx.", ".xls пішімі қолдау таппайды. Файлды Excel-де .xlsx ретінде сақтаңыз."));
  if (!kind) return fail(400, t("Нужен файл .xlsx или .csv.", ".xlsx немесе .csv файлы керек."));

  let parsed: Awaited<ReturnType<typeof parseCatalog>>;
  try {
    parsed = await parseCatalog(Buffer.from(await file.arrayBuffer()), kind);
  } catch (error) {
    if (error instanceof CatalogFileError) return fail(400, msg(error.userMessage));
    console.error("import parse failed:", error instanceof Error ? error.message : error);
    return fail(400, t("Не удалось прочитать файл. Пересохраните его в Excel и загрузите ещё раз.", "Файлды оқу мүмкін болмады. Оны Excel-де қайта сақтап, қайта жүктеңіз."));
  }

  let created = 0;
  let updated = 0;
  let skipped: { row: number; reason: string }[] = [];
  if (parsed.rows.length > 0) {
    const { data, error } = await supabase.rpc("import_products", { p_shop: shop.id, p_rows: parsed.rows });
    if (error) {
      if (error.message.includes("import in progress")) return fail(409, t("Предыдущий файл ещё загружается. Подождите минуту и повторите.", "Алдыңғы файл әлі жүктелуде. Бір минут күтіп, қайталаңыз."));
      if (error.message.includes("not owner")) return fail(403, t("Нет доступа к магазину.", "Дүкенге қолжетім жоқ."));
      console.error("import_products failed:", error.message);
      return fail(500, t("Не удалось сохранить товары. Попробуйте ещё раз.", "Тауарларды сақтау мүмкін болмады. Қайталап көріңіз."));
    }
    const result = data as { created: number; updated: number; skipped: { row: number; reason: string }[] };
    created = result.created;
    updated = result.updated;
    skipped = result.skipped;
    invalidateShopFromRoute(shop.slug);
  }

  const report = [...parsed.errors, ...skipped.map((s) => ({ row: s.row, message: IMPORT_SKIP_REASON[s.reason] ?? IMPORT_SKIP_REASON.invalid }))]
    .map((r) => ({ ...r, message: msg(r.message) }))
    .sort((a, b) => a.row - b.row);
  return NextResponse.json({ created, updated, skipped: report.length, total: parsed.total, report });
}
