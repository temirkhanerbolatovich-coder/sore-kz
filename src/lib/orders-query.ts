/** Поиск и фильтры списка заказов: общие для страницы кабинета и экспорта в CSV. */

export type OrderFilters = {
  /** Только новые. */
  onlyNew: boolean;
  /** Поиск по номеру, имени или телефону (уже очищенный). */
  q: string;
  /** Дата «когда нужно», YYYY-MM-DD. */
  date: string;
};

type Params = { status?: string; q?: string; date?: string };

/**
 * Служебные символы PostgREST (запятая, скобки, кавычки) и подстановки LIKE (%, _, *) из поиска убираются:
 * иначе ввод пользователя менял бы смысл фильтра `or(...)`.
 */
export function cleanSearch(raw: string | undefined): string {
  return (raw ?? "").replace(/[%_*,()"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function parseOrderFilters(sp: Params): OrderFilters {
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(Date.parse(sp.date)) ? sp.date : "";
  return { onlyNew: sp.status === "new", q: cleanSearch(sp.q), date };
}

/** Условие для `.or(...)`: номер (если ввели число), имя и часть телефона (от трёх цифр). Пустой поиск даёт null. */
export function searchCondition(q: string): string | null {
  if (!q) return null;
  const parts = [`customer_name.ilike.*${q}*`];
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) parts.push(`customer_phone.ilike.*${digits}*`);
  if (/^№?\s*\d{1,9}$/.test(q)) parts.push(`number.eq.${Number(digits)}`);
  return parts.join(",");
}

/** Параметры строки запроса для ссылок внутри списка (пустые не добавляются). */
export function filterQuery(f: OrderFilters, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  params.set("status", f.onlyNew ? "new" : "all");
  if (f.q) params.set("q", f.q);
  if (f.date) params.set("date", f.date);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return `?${params.toString()}`;
}

type Filterable<T> = {
  eq(column: string, value: string): T;
  or(filter: string): T;
};

/** Применяет фильтры к запросу Supabase к таблице orders. */
export function applyOrderFilters<T extends Filterable<T>>(query: T, f: OrderFilters): T {
  let result = query;
  if (f.onlyNew) result = result.eq("status", "new");
  if (f.date) result = result.eq("needed_date", f.date);
  const condition = searchCondition(f.q);
  if (condition) result = result.or(condition);
  return result;
}
