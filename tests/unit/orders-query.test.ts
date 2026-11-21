import { describe, expect, it } from "vitest";
import { buildOrdersCsv, csvCell, type CsvOrder } from "@/lib/orders-csv";
import { applyOrderFilters, cleanSearch, filterQuery, parseOrderFilters, searchCondition } from "@/lib/orders-query";

describe("поиск по заказам", () => {
  it("убирает служебные символы PostgREST и подстановки LIKE", () => {
    const backslash = String.fromCharCode(92);
    expect(cleanSearch(`a,b)(c"d%e_f*g${backslash}h'i`)).toBe("a b c d e f g h i");
    expect(cleanSearch("  Айгерим   Б ")).toBe("Айгерим Б");
    expect(cleanSearch("x".repeat(100))).toHaveLength(40);
    expect(cleanSearch(undefined)).toBe("");
  });

  it("не даёт вставить в условие чужой фильтр", () => {
    const condition = searchCondition(cleanSearch("x),status.eq.done,(y"));
    expect(condition).toBe("customer_name.ilike.*x status.eq.done y*");
    expect(condition?.split(",")).toHaveLength(1);
  });

  it("ищет по номеру, имени и телефону", () => {
    expect(searchCondition("")).toBeNull();
    expect(searchCondition("Данияр")).toBe("customer_name.ilike.*Данияр*");
    // Длинная цифровая строка ищется и как часть телефона, и как номер заказа.
    expect(searchCondition("5550101")).toBe("customer_name.ilike.*5550101*,customer_phone.ilike.*5550101*,number.eq.5550101");
    expect(searchCondition("+7 701 555")).toBe("customer_name.ilike.*+7 701 555*,customer_phone.ilike.*7701555*");
    expect(searchCondition("№12")).toBe("customer_name.ilike.*№12*,number.eq.12");
    expect(searchCondition("7")).toBe("customer_name.ilike.*7*,number.eq.7");
  });

  it("разбирает параметры страницы и отбрасывает неверную дату", () => {
    expect(parseOrderFilters({ status: "new", q: " Анна ", date: "2026-11-20" })).toEqual({ onlyNew: true, q: "Анна", date: "2026-11-20" });
    expect(parseOrderFilters({ date: "завтра" }).date).toBe("");
    expect(parseOrderFilters({ date: "2026-13-45" }).date).toBe("");
    expect(parseOrderFilters({}).onlyNew).toBe(false);
  });

  it("сохраняет поиск в ссылках списка", () => {
    const filters = parseOrderFilters({ status: "new", q: "Анна", date: "2026-11-20" });
    expect(filterQuery(filters)).toBe("?status=new&q=%D0%90%D0%BD%D0%BD%D0%B0&date=2026-11-20");
    expect(filterQuery({ ...filters, onlyNew: false, q: "", date: "" }, { page: "2" })).toBe("?status=all&page=2");
  });

  it("применяет фильтры к запросу", () => {
    const calls: string[] = [];
    const query = { eq: (c: string, v: string) => (calls.push(`eq ${c}=${v}`), query), or: (f: string) => (calls.push(`or ${f}`), query) };
    applyOrderFilters(query, parseOrderFilters({ status: "new", q: "Анна", date: "2026-11-20" }));
    expect(calls).toEqual(["eq status=new", "eq needed_date=2026-11-20", "or customer_name.ilike.*Анна*"]);
  });
});

describe("CSV заказов", () => {
  const order: CsvOrder = {
    number: 1001, created_at: "2026-11-16T07:30:00Z", status: "done", customer_name: '=HYPERLINK("http://evil")', customer_phone: "77015550101",
    address: "ул. Абая, 10", comment: "+7 подъезд", needed_date: "2026-11-20", needed_time: "18:00",
    items: [{ title: "Торт Прага · 2 кг", qty: 1, price: 22000 }, { title: "Эклеры", qty: 3, price: 500 }], total: 23500,
  };

  it("нейтрализует формулы и экранирует кавычки", () => {
    expect(csvCell("=1+1")).toBe("\"'=1+1\"");
    expect(csvCell("+7 701")).toBe("\"'+7 701\"");
    expect(csvCell("-1")).toBe("\"'-1\"");
    expect(csvCell("@cmd")).toBe("\"'@cmd\"");
    expect(csvCell('Сказал "привет"')).toBe('"Сказал ""привет"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(23500)).toBe('"23500"');
  });

  it("собирает файл для Excel: BOM, заголовок, «;», CRLF", () => {
    const csv = buildOrdersCsv([order, { ...order, number: 1002, address: "Самовывоз", status: "new" }]);
    expect(csv.startsWith("\uFEFF\"№\";\"Создан\"")).toBe(true);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("\"1001\";\"16.11.2026, 12:30\";\"Выполнен\";\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(lines[1]).toContain("\"Доставка\";\"ул. Абая, 10\"");
    expect(lines[1]).toContain("\"Торт Прага · 2 кг × 1; Эклеры × 3\";\"23500\"");
    expect(lines[2]).toContain("\"Самовывоз\";\"\"");
  });
});
