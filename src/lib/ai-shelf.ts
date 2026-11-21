import { categoryRuleFor, kzUsable } from "@/lib/ai-card";
import { runChain, type AiTask, type ImageInput } from "@/lib/ai-providers";
import type { BBox } from "@/lib/bbox";

/**
 * «Фото полки → много товаров»: одна фотография полки или витрины даёт до 12 черновиков товаров.
 * Модель возвращает рамку каждого товара в долях кадра; разбор ниже не доверяет ей: обрезает рамки по кадру,
 * отбрасывает крошечные и повторяющиеся, ограничивает число товаров.
 */

export const MAX_SHELF_ITEMS = 12;
/** Рамка меньше 1% кадра (или уже 3% по стороне) почти всегда ошибка модели, а не товар. */
const MIN_AREA = 0.01;
const MIN_SIDE = 0.03;
/** Рамки, перекрывающиеся сильнее, считаются одним товаром. */
const DUPLICATE_IOU = 0.6;

const SHELF_CATEGORIES =
  "Продукты, Напитки, Сладости, Торты, Пироги и выпечка, Десерты, Бытовая химия, Косметика, Одежда, Обувь, Аксессуары, Канцтовары, Игрушки, Электроника, Цветы, Хендмейд, Другое";

export type { BBox };

export type ShelfItem = {
  title: string;
  description_ru: string;
  description_kz: string;
  category: string;
  bbox: BBox;
  /** Цена, прочитанная с ценника на фото. Продавец обязан её проверить. */
  price_hint: number | null;
};

export function buildShelfPrompt(categories: string[] = []): string {
  return `Ты помогаешь продавцу из Казахстана выложить товары с одной фотографии полки или витрины.
Найди на фото отдельные товары для продажи, не больше ${MAX_SHELF_ITEMS}. Верни ТОЛЬКО JSON без пояснений и без markdown:
{"items": [{"title": string, "description_ru": string, "description_kz": string, "category": string, "box": [x1, y1, x2, y2], "price": number | null}]}
Правила:
- box: рамка вокруг видимого товара в долях ширины и высоты кадра, числа от 0 до 1. x1, y1 — левый верхний угол, x2, y2 — правый нижний. Одна рамка на товар. Несколько одинаковых товаров рядом (ряд одинаковых бутылок) — это один товар с одной рамкой вокруг всего ряда.
- title: короткое название на русском, до 60 символов. Называй то, что видно; бренд пиши, только если он чётко читается на упаковке.
- description_ru и description_kz: одно предложение на русском и на казахском, только то, что видно: упаковка, цвет, форма.
- Не выдумывай факты: состав, вкус, вес, объём, размер, срок, «домашний», «свежий», если этого не видно на упаковке.
- price: только если цена ИМЕННО этого товара чётко видна на ценнике на фото — целое число в тенге. Иначе null. Не оценивай цену сам.
- Не используй рекламные штампы. Никогда не переписывай с фото телефоны, адреса, имена и ники.
- category: ${categoryRuleFor(categories, SHELF_CATEGORIES)}
- Людей, мебель, стены, ценники и пустые места товарами не считай. Если на фото нет товаров, верни {"items": []}.`;
}

export const shelfTask = (categories?: string[]): AiTask => ({
  system: buildShelfPrompt(categories),
  prompt: "Найди товары на этом фото полки и верни JSON.",
  maxTokens: 4096,
});

const str = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
const num = (value: unknown) => (typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN);

/** Рамка из [x1,y1,x2,y2] или {x1,y1,x2,y2}. Значения 0..1000 (так отвечают некоторые модели) переводятся в доли. */
export function normalizeBox(raw: unknown): BBox | null {
  let values: number[];
  if (Array.isArray(raw)) values = raw.slice(0, 5).map(num);
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    values = [o.x1, o.y1, o.x2, o.y2].map(num);
  } else return null;
  if (values.length !== 4 || values.some((v) => !Number.isFinite(v))) return null;
  // Чуть больше 1 — это доли с выходом за край (обрежем ниже); заметно больше — шкала 0..1000.
  const max = Math.max(...values);
  if (max > 1.5) {
    if (max > 1000) return null;
    values = values.map((v) => v / 1000);
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const [a, b, c, d] = values.map(clamp);
  const round = (v: number) => Math.round(v * 10_000) / 10_000;
  const box = { x1: round(Math.min(a, c)), y1: round(Math.min(b, d)), x2: round(Math.max(a, c)), y2: round(Math.max(b, d)) };
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  if (w < MIN_SIDE || h < MIN_SIDE || w * h < MIN_AREA) return null;
  return box;
}

export function iou(a: BBox, b: BBox): number {
  const w = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const h = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = w * h;
  const union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

function priceHint(value: unknown): number | null {
  const n = num(value);
  return Number.isInteger(n) && n > 0 && n <= 100_000_000 ? n : null;
}

/** Достаёт товары из ответа модели. null — ответ нечитаем; [] — модель уверенно не нашла товаров. */
export function parseShelf(text: string): ShelfItem[] | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  const close = text[start] === "{" ? "}" : "]";
  const end = text.lastIndexOf(close);
  if (end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = Array.isArray(json) ? json : json && typeof json === "object" ? (json as { items?: unknown }).items : undefined;
  if (!Array.isArray(list)) return null;

  const items: ShelfItem[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const bbox = normalizeBox(r.box ?? r.bbox);
    if (!bbox) continue;
    if (items.some((kept) => iou(kept.bbox, bbox) > DUPLICATE_IOU)) continue;
    const title = str(r.title, 120);
    const descriptionKz = str(r.description_kz, 1000);
    items.push({
      title: title === "Товар" ? "" : title,
      description_ru: str(r.description_ru, 1000),
      // Слабая модель могла ответить «казахским» латиницей: лучше пустое поле, чем мусор.
      description_kz: kzUsable(descriptionKz) ? descriptionKz : "",
      category: str(r.category, 60),
      bbox,
      price_hint: priceHint(r.price ?? r.price_hint),
    });
    if (items.length === MAX_SHELF_ITEMS) break;
  }
  return items;
}

export class ShelfEmptyError extends Error {
  constructor() {
    super("на фото не найдено товаров");
    this.name = "ShelfEmptyError";
  }
}

/**
 * Распознаёт полку по цепочке провайдеров. Пустой список не принимается сразу: следующая модель может найти больше.
 * Если все модели ответили «товаров нет», бросается ShelfEmptyError, если ни одна не ответила — обычная ошибка.
 */
export async function generateShelf(img: ImageInput): Promise<{ items: ShelfItem[]; provider: string }> {
  let sawEmpty = false;
  try {
    const { value, provider } = await runChain(img, shelfTask(img.categories), (text) => {
      const items = parseShelf(text);
      if (items && items.length === 0) sawEmpty = true;
      return items && items.length > 0 ? items : null;
    });
    return { items: value, provider };
  } catch (error) {
    if (sawEmpty) throw new ShelfEmptyError();
    throw error;
  }
}
