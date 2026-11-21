"use client";

import { lineKey, useCart, useShopLines } from "@/lib/cart";
import { tFor, type Lang } from "@/lib/lang";
import type { Product } from "@/lib/types";
import type { Variant } from "@/lib/variants";
import { CartIcon, CheckIcon } from "@/components/icons";

/** Кнопка «В корзину» и счётчик «− 1 +». Для товара с вариантами передаётся выбранный вариант. */
export function AddToCart({
  slug,
  product,
  lang,
  variant = null,
  booking = false,
}: {
  slug: string;
  product: Product;
  lang: Lang;
  variant?: Variant | null;
  booking?: boolean;
}) {
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const lines = useShopLines(slug);
  const key = lineKey({ id: product.id, variantId: variant?.id ?? null });
  const qty = lines.find((l) => lineKey(l) === key)?.qty ?? 0;
  const t = tFor(lang, booking);

  if (!product.in_stock) {
    return (
      <div className="flex h-11 items-center justify-center rounded-xl bg-line text-sm font-bold text-muted">
        {t.out}
      </div>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() =>
          add(slug, {
            id: product.id,
            title: product.title,
            price: variant?.price ?? product.price,
            photo: product.photo_url,
            variantId: variant?.id ?? null,
            variantTitle: variant?.title ?? null,
          })
        }
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-ink bg-surface text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream"
      >
        <CartIcon size={18} />
        {t.add}
      </button>
    );
  }

  // Запись не бывает «×2»: услуга либо выбрана, либо нет.
  if (booking) {
    return (
      <button
        type="button"
        onClick={() => setQty(key, 0)}
        aria-label={`${t.unselect}: ${product.title}`}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-ink text-sm font-bold text-cream"
      >
        <CheckIcon size={18} />
        {t.selected} · {t.unselect}
      </button>
    );
  }

  return (
    <div className="flex h-11 items-center justify-between rounded-xl border-[1.5px] border-ink bg-surface px-1">
      <button
        type="button"
        aria-label="Уменьшить количество"
        onClick={() => setQty(key, qty - 1)}
        className="size-11 rounded-lg text-xl font-bold"
      >
        −
      </button>
      <span className="font-bold" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        aria-label="Увеличить количество"
        onClick={() => setQty(key, qty + 1)}
        className="size-11 rounded-lg text-xl font-bold"
      >
        +
      </button>
    </div>
  );
}
