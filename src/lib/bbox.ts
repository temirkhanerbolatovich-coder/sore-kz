/** Рамка товара на снимке полки в долях кадра (0..1). Лёгкий модуль без зависимостей: нужен и витрине. */
export type BBox = { x1: number; y1: number; x2: number; y2: number };

/** Рамка из JSON базы или null, если её нет или она повреждена. */
export function asBBox(value: unknown): BBox | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { x1, y1, x2, y2 } = value as Record<string, unknown>;
  const ok = [x1, y1, x2, y2].every((v) => typeof v === "number" && v >= 0 && v <= 1);
  if (!ok) return null;
  const box = { x1, y1, x2, y2 } as BBox;
  return box.x1 < box.x2 && box.y1 < box.y2 ? box : null;
}
