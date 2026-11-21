"use client";

import { useState, type ReactNode } from "react";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";

type Item = { id: string; /** Уже в нижнем регистре: название, категория, описания. */ text: string; node: ReactNode };

/**
 * Список товаров витрины с поиском. Карточки отрисованы на сервере и приходят готовыми,
 * поэтому кэш страницы и размер клиентского кода не растут: фильтруется только набор показанных элементов.
 */
export function ProductFilter({
  items,
  minItems,
  labels,
}: {
  items: Item[];
  /** Поле поиска показывается, когда в списке не меньше стольких товаров. */
  minItems: number;
  labels: { placeholder: string; empty: string; reset: string; clear: string; found: string };
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("ru");
  const shown = needle ? items.filter((item) => item.text.includes(needle)) : items;

  return (
    <>
      {items.length >= minItems && (
        <div className="flex flex-col gap-1.5 pb-3">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
              enterKeyHint="search"
              autoComplete="off"
              maxLength={60}
              className="input w-full pr-24 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="absolute inset-y-0 right-1 min-h-11 px-3 text-sm font-semibold underline">
                {labels.clear}
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
            {needle ? labels.found.replace("{n}", String(shown.length)) : ""}
          </p>
        </div>
      )}
      {shown.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={24} />}
          title={labels.empty}
          description=""
          action={<button type="button" className="btn-outline h-11" onClick={() => setQuery("")}>{labels.reset}</button>}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-4">{shown.map((item) => item.node)}</ul>
      )}
    </>
  );
}
