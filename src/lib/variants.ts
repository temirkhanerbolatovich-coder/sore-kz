export type Variant = { id: string; title: string; price: number };

/** Варианты товара из jsonb; всё, что не подходит по форме, отбрасывается. */
export function variantsOf(product: { variants?: unknown }): Variant[] {
  const raw = product.variants;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v): Variant[] => {
    if (!v || typeof v !== "object") return [];
    const { id, title, price } = v as Record<string, unknown>;
    if (typeof id !== "string" || typeof title !== "string" || typeof price !== "number") return [];
    return [{ id, title, price }];
  });
}

export const newVariantId = () => Math.random().toString(36).slice(2, 8);

export function minVariantPrice(variants: Variant[]): number {
  return Math.min(...variants.map((v) => v.price));
}
