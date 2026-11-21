"use client";

import { useRef, useState } from "react";
import { plural } from "@/lib/plural";
import Link from "next/link";
import { toCsv } from "@/lib/csv-export";
import { CheckIcon, DownloadIcon, FileIcon, UploadIcon } from "@/components/icons";
import { useTr, useUiLang } from "@/components/ui-lang";

type Report = { row: number; message: string };
type Result = { created: number; updated: number; skipped: number; total: number; report: Report[] };

const SHOWN_ERRORS = 8;

/** Скачивает отчёт об ошибках как CSV для Excel (BOM, «;»). Строится в браузере из ответа сервера. */
function downloadReport(report: Report[], headers: [string, string]) {
  const csv = toCsv([headers, ...report.map((r) => [r.row, r.message])]);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "sore-import-errors.csv";
  a.click();
  // Адрес освобождаем не сразу: под нагрузкой браузер может ещё читать файл (иначе скачивание обрывается).
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Прайс из Excel или CSV: выбрать файл → загрузить → итог и отчёт об ошибках. */
export function ImportForm({ slots }: { slots: number }) {
  const tr = useTr();
  const lang = useUiLang();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/import", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string };
      if (!res.ok) throw new Error(json.error || tr("Не удалось загрузить файл. Попробуйте ещё раз.", "Файлды жүктеу мүмкін болмады. Қайталап көріңіз."));
      setResult(json as Result);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : tr("Нет связи. Проверьте интернет и попробуйте ещё раз.", "Байланыс жоқ. Интернетті тексеріп, қайталап көріңіз."));
    } finally {
      setBusy(false);
    }
  }

  const changed = result ? result.created + result.updated : 0;

  return (
    <form id="main-content" tabIndex={-1} onSubmit={onSubmit} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="card icon-host flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="icon-badge">
              <FileIcon size={24} />
            </div>
            <p className="text-lg font-bold leading-tight">{tr("Загрузите прайс одним файлом", "Прайсты бір файлмен жүктеңіз")}</p>
          </div>
          <p className="text-body leading-relaxed text-muted">
            {tr(`Нужны колонки «Название» и «Цена». По желанию: «Артикул», «Категория», «Описание», «Количество». Если артикул уже есть в магазине, товар обновится, а не задвоится. Бесплатно можно держать до 15 товаров, сейчас свободно мест: ${slots}.`, `«Название» және «Цена» бағандары керек. Қалауыңызша: «Артикул», «Категория», «Описание», «Количество». Артикул дүкенде бар болса, тауар қайталанбай жаңарады. Тегін 15 тауарға дейін ұстауға болады, қазір бос орын: ${slots}.`)}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Скачивание файла: клиентская навигация Next.js здесь не подходит. */}
            <a href="/api/import/template?format=xlsx" download className="btn-outline h-11 min-h-11 px-2 text-sm">
              <DownloadIcon size={18} />
              {tr("Шаблон .xlsx", ".xlsx үлгісі")}
            </a>
            {/* Скачивание файла: клиентская навигация Next.js здесь не подходит. */}
            <a href="/api/import/template?format=csv" download className="btn-outline h-11 min-h-11 px-2 text-sm">
              <DownloadIcon size={18} />
              {tr("Шаблон .csv", ".csv үлгісі")}
            </a>
          </div>
        </div>

        <input
          ref={fileRef}
          id="import-file"
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError("");
            setResult(null);
          }}
        />
        <label htmlFor="import-file" className="btn-dark h-14 w-full cursor-pointer text-lg has-[:disabled]:opacity-60">
          <UploadIcon />
          {file ? tr("Выбрать другой файл", "Басқа файл таңдау") : tr("Выбрать файл", "Файл таңдау")}
        </label>
        {file && (
          <p className="truncate text-center text-body font-semibold" title={file.name}>
            {file.name} · {Math.max(1, Math.round(file.size / 1024))} {tr("КБ", "КБ")}
          </p>
        )}

        {busy && (
          <p role="status" className="text-center text-sm font-semibold text-muted">
            {tr("Загружаем и проверяем строки…", "Жолдар жүктеліп, тексерілуде…")}
          </p>
        )}

        {error && (
          <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="card border-accent p-4 text-body font-semibold text-accent-dark">
            {error}
          </p>
        )}

        {result && (
          <section role="status" aria-label={tr("Итог загрузки", "Жүктеу қорытындысы")} className="card rise-in flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <CheckIcon size={22} className="text-wa" />
              {changed > 0 ? tr("Прайс загружен", "Прайс жүктелді") : tr("Ничего не загружено", "Ештеңе жүктелмеді")}
            </div>
            <ul className="flex flex-col gap-1 text-body">
              <li>
                {tr("Добавлено", "Қосылды")}: <b>{result.created}</b>
              </li>
              <li>
                {tr("Обновлено", "Жаңартылды")}: <b>{result.updated}</b>
              </li>
              <li>
                {tr("Пропущено", "Өткізілді")}: <b>{result.skipped}</b> {tr("из", "/")} {result.total} {lang === "kz" ? "жол" : plural(result.total, "строки", "строк", "строк")}
              </li>
            </ul>
            {result.report.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <p className="text-sm font-bold">{tr("Что не загрузилось", "Не жүктелмеді")}</p>
                <ul className="flex flex-col gap-1 text-caption text-muted">
                  {result.report.slice(0, SHOWN_ERRORS).map((r) => (
                    <li key={`${r.row}-${r.message}`}>
                      {tr("Строка", "Жол")} {r.row}: {r.message}
                    </li>
                  ))}
                </ul>
                {result.report.length > SHOWN_ERRORS && <p className="text-caption text-muted">{tr(`…и ещё ${result.report.length - SHOWN_ERRORS}. Все строки в отчёте.`, `…және тағы ${result.report.length - SHOWN_ERRORS}. Барлық жол есепте.`)}</p>}
                <button type="button" onClick={() => downloadReport(result.report, [tr("Строка", "Жол"), tr("Причина", "Себебі")])} className="btn-outline h-11 min-h-11 text-sm">
                  <DownloadIcon size={18} />
                  {tr("Скачать отчёт об ошибках", "Қателер есебін жүктеу")}
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface p-5">
        {!result && (
          <button type="submit" disabled={!file || busy || slots === 0} className="btn-accent h-14 w-full text-lg disabled:opacity-60">
            {busy ? tr("Загружаем…", "Жүктелуде…") : tr("Загрузить прайс", "Прайсты жүктеу")}
          </button>
        )}
        {slots === 0 && !result && <p className="text-center text-caption text-muted">{tr("Лимит исчерпан: обновить существующие товары по артикулу можно, добавить новые нельзя.", "Шек таусылды: бар тауарларды артикул бойынша жаңартуға болады, жаңаларын қосуға болмайды.")}</p>}
        <Link href="/dashboard" className={`${result ? "btn-accent" : "btn-outline"} h-12 w-full`}>
          {result ? tr("К товарам", "Тауарларға") : tr("Назад", "Артқа")}
        </Link>
      </div>
    </form>
  );
}
