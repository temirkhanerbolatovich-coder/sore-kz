import { describe, expect, it } from "vitest";
import { importMessageKz } from "@/lib/import-messages";
import { parseCatalog } from "@/lib/catalog-file";

describe("сообщения импорта на казахском", () => {
  it("переводит ошибки файла и строк, неизвестное оставляет как есть", () => {
    expect(importMessageKz("Файл пустой.")).toBe("Файл бос.");
    expect(importMessageKz("нет цены")).toBe("бағасы жоқ");
    expect(importMessageKz("нет названия; цена — не число")).toBe("атауы жоқ; баға — сан емес");
    expect(importMessageKz("В файле больше 500 строк. Разбейте его на части.")).toContain("500");
    expect(importMessageKz("артикул «A-1» повторяется, взята строка 7")).toBe("«A-1» артикулі қайталанады, 7-жол алынды");
    expect(importMessageKz("описание: не длиннее 1000 символов")).toBe("сипаттама: 1000 таңбадан ұзын емес болуы керек");
    expect(importMessageKz("что-то новое")).toBe("что-то новое");
  });

  it("переводит реальные сообщения разбора csv", async () => {
    const csv = "Название,Цена\n,100\nТорт,abc\n";
    const { errors } = await parseCatalog(Buffer.from(csv), "csv");
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) expect(importMessageKz(e.message)).not.toBe(e.message);
  });
});
