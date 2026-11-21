"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/lib/order";
import type { Product } from "@/lib/types";
import { variantsOf } from "@/lib/variants";

export type StoredLine = CartLine & { photo: string | null; variantTitle?: string | null };

/** Одна позиция корзины = товар + выбранный вариант (1 кг и 2 кг одного торта это разные строки). */
export const lineKey = (l: { id: string; variantId?: string | null }) => `${l.id}:${l.variantId ?? ""}`;

type CartState = {
  shopSlug: string | null;
  lines: StoredLine[];
  add: (shopSlug: string, line: Omit<StoredLine, "qty">) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  reconcile: (slug: string, products: Product[]) => boolean;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      shopSlug: null,
      lines: [],
      add: (shopSlug, line) =>
        set((s) => {
          // Корзина привязана к одному магазину: при смене магазина начинаем заново.
          const base = s.shopSlug === shopSlug ? s.lines : [];
          const key = lineKey(line);
          const exists = base.find((l) => lineKey(l) === key);
          const lines = exists
            ? base.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(l.qty + 1, 99) } : l))
            : [...base, { ...line, qty: 1 }];
          return { shopSlug, lines };
        }),
      setQty: (key, qty) =>
        set((s) => ({
          lines: !Number.isFinite(qty)
            ? s.lines
            : qty <= 0
              ? s.lines.filter((l) => lineKey(l) !== key)
              : s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.max(1, Math.min(Math.floor(qty), 99)) } : l)),
        })),
      clear: () => set({ shopSlug: null, lines: [] }),
      /** Сверяет корзину со свежими данными магазина: цены, названия, варианты, наличие. true, если что-то изменилось. */
      reconcile: (slug, products) => {
        let changed = false;
        set((s) => {
          if (s.shopSlug !== slug) return s;
          const lines = s.lines.flatMap((line) => {
            const product = products.find((p) => p.id === line.id && p.in_stock && p.price_mode === "fixed");
            if (!product) {
              changed = true;
              return [];
            }
            const variants = variantsOf(product);
            let price = product.price;
            let variantTitle: string | null = null;
            if (variants.length > 0) {
              const v = variants.find((x) => x.id === line.variantId);
              if (!v) {
                changed = true;
                return [];
              }
              price = v.price;
              variantTitle = v.title;
            } else if (line.variantId) {
              changed = true;
              return [];
            }
            if (price !== line.price || product.title !== line.title || variantTitle !== (line.variantTitle ?? null)) changed = true;
            return [{ ...line, price, title: product.title, variantTitle, photo: product.photo_url }];
          });
          return { lines };
        });
        return changed;
      },
    }),
    { name: "sore-cart" },
  ),
);

/** true только после гидратации — чтобы разметка с сервера и клиента совпала. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/** Строки корзины для конкретного магазина (пусто до гидратации). */
export function useShopLines(slug: string): StoredLine[] {
  const hydrated = useHydrated();
  const shopSlug = useCart((s) => s.shopSlug);
  const lines = useCart((s) => s.lines);
  return hydrated && shopSlug === slug ? lines : [];
}
