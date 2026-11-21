export type CsvOrder = {
  number: number;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  comment: string | null;
  needed_date: string | null;
  needed_time: string | null;
  items: { title: string; qty: number; price: number }[];
  total: number;
};

const STATUS: Record<string, string> = { new: "Новый", done: "Выполнен", cancelled: "Отменён" };
const stamp = new Intl.DateTimeFormat("ru-RU", {
  timeZone: "Asia/Almaty",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const HEADER = ["№", "Создан", "Статус", "Клиент", "Телефон", "Получение", "Адрес", "Когда нужно", "Время", "Комментарий", "Состав", "Сумма, ₸"];

/**
 * Ячейка CSV в кавычках. Текст, который Excel или Google Таблицы принимают за формулу (начинается с = + - @ или
 * управляющего символа), дополняется апострофом: иначе покупатель мог бы подсунуть продавцу формулу в имени или комментарии.
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** UTF-8 с BOM (чтобы Excel открыл кириллицу), разделитель «;» (как ждёт русская локаль Excel), строки через CRLF. */
export function buildOrdersCsv(rows: CsvOrder[]): string {
  const lines = [HEADER.map(csvCell).join(";")];
  for (const order of rows) {
    const pickup = order.address === "Самовывоз";
    lines.push(
      [
        order.number,
        stamp.format(new Date(order.created_at)),
        STATUS[order.status] ?? order.status,
        order.customer_name,
        order.customer_phone,
        pickup ? "Самовывоз" : "Доставка",
        pickup ? "" : order.address,
        order.needed_date,
        order.needed_time,
        order.comment,
        order.items.map((item) => `${item.title} × ${item.qty}`).join("; "),
        order.total,
      ]
        .map(csvCell)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
