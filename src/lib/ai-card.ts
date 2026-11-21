import { z } from "zod";

const DEFAULT_CATEGORIES =
  "Торты, Пироги и выпечка, Печенье и кексы, Десерты, Закуски и салаты, Горячие блюда, Полуфабрикаты, Цветы, Хендмейд, Одежда, Косметика, Услуги, Другое";

/** Правило выбора категории: сначала свои категории магазина, потом общий список. */
export function categoryRuleFor(categories: string[], defaults: string): string {
  const own = categories.map((c) => c.trim()).filter(Boolean).slice(0, 20);
  return own.length
    ? `выбери ОДНУ подходящую по смыслу. Сначала смотри категории этого магазина: ${own.join(", ")}. Если ни одна из них не подходит по смыслу (например, магазин «Услуги», а на фото торт), выбери из общего списка: ${defaults}. Не подгоняй товар под неподходящую категорию.`
    : `выбери одну из: ${defaults}.`;
}

/**
 * Системный промпт карточки. categories: уже существующие категории магазина, чтобы ИИ не плодил новые
 * («Выпечка», «Пироги», «Торты и пироги» для однотипных товаров).
 */
export function buildSystemPrompt(categories: string[] = []): string {
  const categoryRule = categoryRuleFor(categories, DEFAULT_CATEGORIES);
  return `Ты помогаешь продавцу из Казахстана оформить карточку товара по фото.
Верни ТОЛЬКО JSON без пояснений и без markdown, ровно с такими полями:
{"title": string, "description_ru": string, "description_kz": string, "category": string, "tags": string[]}
Правила:
- title: короткое название на русском, до 60 символов. Называй то, что видно (например, «Торт с ореховой крошкой»). Название рецепта («Медовик», «Красный бархат») пиши, только если он однозначно очевиден по виду; иначе дай общее название.
- description_ru и description_kz: 1–2 предложения на русском и на казахском. Описывай только то, что видно: форму, цвет, украшения, посуду.
- Не выдумывай факты: состав и начинку, вкус, вес, размер, количество, температуру подачи («горячий», «свежий»), срок, цену, «домашний» или «ручной работы».
- Не используй рекламные штампы («аппетитный», «идеально подойдёт к чаю»).
- Никогда не переписывай с фото телефоны, адреса, имена и ники.
- category: ${categoryRule}
- tags: 3–5 коротких тегов на русском.
Если на фото не товар (меню, афиша, скриншот, люди и т.п.), верни title «Товар», пустые описания и category «Другое».`;
}

export const AI_SYSTEM_PROMPT = buildSystemPrompt();

const cut = (n: number) => z.string().transform((s) => s.trim().slice(0, n));

export const cardSchema = z.object({
  title: cut(120),
  description_ru: cut(1000),
  description_kz: cut(1000),
  category: cut(60),
  tags: z
    .array(z.string())
    .default([])
    .transform((a) => a.map((t) => t.trim()).filter(Boolean).slice(0, 5)),
});

export type AiCard = z.infer<typeof cardSchema>;

/**
 * Казахский текст пригоден, если почти все буквы кириллические. Слабые бесплатные модели иногда
 * отвечают «казахским» латиницей (транслитом), такой текст лучше оставить пустым, чем показать продавцу.
 */
export function kzUsable(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return false;
  const cyrillic = letters.filter((c) => /\p{Script=Cyrillic}/u.test(c)).length;
  return cyrillic / letters.length >= 0.9;
}

/** Достаёт JSON из ответа модели, даже если он обёрнут в ```json ... ```. */
export function parseCard(text: string): AiCard | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = cardSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
