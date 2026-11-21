/** Запись CSV для Excel. Без зависимостей: используется и в браузере (отчёт об ошибках), и на сервере (шаблон). */

/** Ячейка CSV, безопасная для Excel: защита от формул (=, +, -, @) и экранирование кавычек. */
export function csvCell(value: string | number): string {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV для Excel: BOM, разделитель «;», перевод строки CRLF. */
export function toCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
