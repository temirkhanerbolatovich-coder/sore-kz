"use client";

import { useState } from "react";
import { AddToCart } from "@/components/add-to-cart";
import { T, type Lang } from "@/lib/lang";
import { formatPrice } from "@/lib/order";
import type { Product } from "@/lib/types";
import type { Variant } from "@/lib/variants";

/** Выбор варианта (вес, размер) и добавление в корзину на странице товара. */
export function ProductBuy({
  slug,
  product,
  variants,
  lang,
  booking = false,
}: {
  slug: string;
  product: Product;
  variants: Variant[];
  lang: Lang;
  booking?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
  const t = T[lang];

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">{t.chooseVariant}</legend>
        <div className="flex flex-wrap gap-2">
          {variants.map((v) => (
            <label
              key={v.id}
              className={`flex min-h-11 cursor-pointer items-center rounded-xl px-4 text-body font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink ${
                v.id === selected.id ? "bg-ink text-cream" : "border-[1.5px] border-field"
              }`}
            >
              <input
                type="radio"
                name="variant"
                value={v.id}
                checked={v.id === selected.id}
                onChange={() => setSelectedId(v.id)}
                className="sr-only"
              />
              {v.title}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="text-2xl font-extrabold" aria-live="polite">
        {formatPrice(selected.price)}
      </div>
      <AddToCart slug={slug} product={product} lang={lang} variant={selected} booking={booking} />
    </div>
  );
}
