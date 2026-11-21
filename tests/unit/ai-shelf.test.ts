import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { iou, MAX_SHELF_ITEMS, normalizeBox, parseShelf } from "@/lib/ai-shelf";
import { asBBox } from "@/lib/bbox";
import { CROP_SIZE, cropRect, cropShelfPhoto } from "@/lib/shelf-crops";

const item = (box: unknown, extra: Record<string, unknown> = {}) => ({
  title: "Вода «Тассай» 1 л",
  description_ru: "Бутылка воды на полке.",
  description_kz: "Сөредегі су бөтелкесі.",
  category: "Напитки",
  box,
  price: null,
  ...extra,
});

describe("parseShelf", () => {
  it("разбирает валидный ответ в обёртке ```json", () => {
    const text = "```json\n" + JSON.stringify({ items: [item([0.1, 0.2, 0.4, 0.8], { price: 350 })] }) + "\n```";
    expect(parseShelf(text)).toEqual([
      {
        title: "Вода «Тассай» 1 л",
        description_ru: "Бутылка воды на полке.",
        description_kz: "Сөредегі су бөтелкесі.",
        category: "Напитки",
        bbox: { x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.8 },
        price_hint: 350,
      },
    ]);
  });

  it("принимает голый массив и рамку объектом", () => {
    expect(parseShelf(JSON.stringify([item({ x1: 0, y1: 0, x2: 0.5, y2: 0.5 })]))?.[0].bbox).toEqual({ x1: 0, y1: 0, x2: 0.5, y2: 0.5 });
  });

  it("мусор и не-JSON дают null, пустой список — []", () => {
    expect(parseShelf("Не могу помочь")).toBeNull();
    expect(parseShelf("{ items: [oops")).toBeNull();
    expect(parseShelf('{"foo": 1}')).toBeNull();
    expect(parseShelf('{"items": []}')).toEqual([]);
  });

  it("обрезает рамки по кадру, переворачивает перепутанные углы и переводит 0..1000", () => {
    const [a, b, c] = parseShelf(
      JSON.stringify({ items: [item([-0.2, 0.1, 0.3, 1.4]), item([0.9, 0.9, 0.6, 0.5]), item([100, 200, 400, 900])] }),
    )!;
    expect(a.bbox).toEqual({ x1: 0, y1: 0.1, x2: 0.3, y2: 1 });
    expect(b.bbox).toEqual({ x1: 0.6, y1: 0.5, x2: 0.9, y2: 0.9 });
    expect(c.bbox).toEqual({ x1: 0.1, y1: 0.2, x2: 0.4, y2: 0.9 });
  });

  it("отбрасывает крошечные, вырожденные и битые рамки", () => {
    const items = parseShelf(
      JSON.stringify({ items: [item([0.1, 0.1, 0.12, 0.12]), item([0.2, 0.2, 0.2, 0.9]), item(["a", 0, 1, 1]), item(null), item([0, 0, 1])] }),
    );
    expect(items).toEqual([]);
  });

  it("схлопывает дубли по пересечению рамок", () => {
    const items = parseShelf(JSON.stringify({ items: [item([0.1, 0.1, 0.5, 0.5]), item([0.12, 0.1, 0.5, 0.52]), item([0.6, 0.1, 0.9, 0.5])] }))!;
    expect(items).toHaveLength(2);
  });

  it("не больше 12 товаров", () => {
    const many = Array.from({ length: 20 }, (_, i) => item([(i % 5) * 0.2, Math.floor(i / 5) * 0.25, (i % 5) * 0.2 + 0.19, Math.floor(i / 5) * 0.25 + 0.24]));
    expect(parseShelf(JSON.stringify({ items: many }))).toHaveLength(MAX_SHELF_ITEMS);
  });

  it("чистит поля: «Товар» → пусто, казахский латиницей → пусто, цена только целая и положительная", () => {
    const [a] = parseShelf(JSON.stringify({ items: [item([0, 0, 0.5, 0.5], { title: "Товар", description_kz: "Su botelkesi", price: 12.5 })] }))!;
    expect(a.title).toBe("");
    expect(a.description_kz).toBe("");
    expect(a.price_hint).toBeNull();
    const [b] = parseShelf(JSON.stringify({ items: [item([0, 0, 0.5, 0.5], { price: "-10" })] }))!;
    expect(b.price_hint).toBeNull();
  });
});

describe("рамки", () => {
  it("normalizeBox и iou", () => {
    expect(normalizeBox([0, 0, 1, 1])).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(normalizeBox([0, 0, 2000, 1])).toBeNull();
    expect(iou({ x1: 0, y1: 0, x2: 1, y2: 1 }, { x1: 0, y1: 0, x2: 1, y2: 1 })).toBe(1);
    expect(iou({ x1: 0, y1: 0, x2: 0.5, y2: 0.5 }, { x1: 0.5, y1: 0.5, x2: 1, y2: 1 })).toBe(0);
  });

  it("asBBox принимает только корректную рамку из базы", () => {
    expect(asBBox({ x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.3 })).toEqual({ x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.3 });
    for (const bad of [null, [], "x", { x1: 0.3, y1: 0.1, x2: 0.2, y2: 0.3 }, { x1: 0, y1: 0, x2: 2, y2: 1 }, { x1: "0", y1: 0, x2: 1, y2: 1 }]) {
      expect(asBBox(bad)).toBeNull();
    }
  });
});

describe("вырезки", () => {
  it("cropRect добавляет отступ, тянет к квадрату и не выходит за кадр", () => {
    const rect = cropRect({ x1: 0.4, y1: 0.4, x2: 0.5, y2: 0.6 }, 1000, 500);
    expect(rect.width).toBe(rect.height);
    expect(rect.width).toBeGreaterThan(100);
    const edge = cropRect({ x1: 0.9, y1: 0.8, x2: 1, y2: 1 }, 1000, 500);
    expect(edge.left + edge.width).toBeLessThanOrEqual(1000);
    expect(edge.top + edge.height).toBeLessThanOrEqual(500);
    const wide = cropRect({ x1: 0, y1: 0.3, x2: 1, y2: 0.5 }, 1000, 500);
    expect(wide).toEqual({ left: 0, top: 0, width: 1000, height: 500 });
  });

  it("режет настоящую картинку в квадрат 600×600 и миниатюру", async () => {
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 120, b: 40 } } }).jpeg().toBuffer();
    const [crop, other] = await cropShelfPhoto(photo, [
      { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.9 },
      { x1: 0.5, y1: 0.2, x2: 0.9, y2: 0.4 },
    ]);
    expect(crop && other).toBeTruthy();
    const full = await sharp(crop!.full).metadata();
    const thumb = await sharp(crop!.thumb).metadata();
    expect([full.format, full.width, full.height]).toEqual(["jpeg", CROP_SIZE, CROP_SIZE]);
    expect([thumb.format, thumb.width]).toEqual(["jpeg", 480]);
  });

  it("битое изображение — ошибка, а не тихий мусор", async () => {
    await expect(cropShelfPhoto(Buffer.from("not an image"), [{ x1: 0, y1: 0, x2: 1, y2: 1 }])).rejects.toThrow();
  });
});
