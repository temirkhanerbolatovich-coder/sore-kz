import type { BBox } from "@/lib/bbox";

/**
 * Когда у ИИ-черновика товара стоит метка «Проверьте». Уверенность модели не используем (она себя переоценивает),
 * смотрим на признаки, по которым черновик чаще всего приходится править: пустое или слишком короткое название,
 * нет категории, очень маленькая рамка (скорее всего это часть товара или ценник).
 */
const MIN_TITLE = 3;
const SMALL_BOX_AREA = 0.03;

export type ShelfReviewInput = { title: string; category: string; bbox: BBox };

export function shelfReviewReason(draft: ShelfReviewInput): string | null {
  const title = draft.title.trim();
  if (title.length < MIN_TITLE) return "название";
  if (!draft.category.trim()) return "категория";
  const { x1, y1, x2, y2 } = draft.bbox;
  if ((x2 - x1) * (y2 - y1) < SMALL_BOX_AREA) return "снимок товара";
  return null;
}
