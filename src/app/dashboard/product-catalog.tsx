"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/types";
import { priceLabel } from "@/lib/order";
import { variantsOf } from "@/lib/variants";
import { GripIcon, BoxIcon } from "@/components/icons";
import { ProductPhoto } from "@/components/product-photo";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionForm } from "@/components/action-form";
import { moveProduct, toggleHidden, toggleStock } from "./products/actions";
import { useTr, useUiLang } from "@/components/ui-lang";

export function ProductCatalog({ products }: { products: Product[] }) {
  const tr = useTr();
  const lang = useUiLang();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [dragged, setDragged] = useState<string>();
  const [target, setTarget] = useState<string>();
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const moving = useRef(false);
  const router = useRouter();
  const visible = products.filter((product) => product.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")) &&
    (filter === "all" || (filter === "stock" && product.in_stock) || (filter === "out" && !product.in_stock) || (filter === "review" && product.price_needs_review) || (filter === "hidden" && product.is_hidden)));
  const canDrag = !query.trim() && filter === "all" && !pending;

  function reorder(id: string, destination?: string) {
    setDragged(undefined); setTarget(undefined);
    if (!destination || destination === id || moving.current) return;
    const from = products.findIndex((product) => product.id === id);
    const to = products.findIndex((product) => product.id === destination);
    if (from < 0 || to < 0) return;
    moving.current = true;
    start(async () => {
      setMessage("");
      try {
        // API перемещает на одну позицию. Выполняем шаги последовательно, без нового контракта.
        for (let index = 0; index < Math.abs(to - from); index++) {
          const data = new FormData(); data.set("id", id); data.set("direction", String(Math.sign(to - from)));
          await moveProduct(data);
        }
        setMessage(tr("Порядок сохранён.", "Реті сақталды."));
      } catch { setMessage(tr("Не удалось завершить перемещение. Проверьте текущий порядок и повторите.", "Жылжыту аяқталмады. Ағымдағы ретті тексеріп, қайталаңыз.")); }
      finally { moving.current = false; router.refresh(); }
    });
  }

  if (!products.length) return null; // Пустой кабинет показывает блок «Как добавить товары?» над списком.
  return <section className="px-5 pt-3" aria-label={tr("Каталог товаров", "Тауарлар каталогы")} aria-busy={pending}>
    <label htmlFor="catalog-search" className="text-sm font-semibold">{tr("Найти товар", "Тауар іздеу")}</label>
    <input id="catalog-search" type="search" className="input mt-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Название товара", "Тауар атауы")} />
    <div className="my-3 flex flex-wrap gap-2" aria-label={tr("Фильтры товаров", "Тауар сүзгілері")}>
      {[["all", tr("Все", "Барлығы")], ["stock", tr("В наличии", "Бар")], ["out", tr("Нет в наличии", "Қалмады")], ["review", tr("Цена не проверена", "Бағасы тексерілмеген")], ["hidden", tr("Скрытые", "Жасырын")]].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 rounded-xl border border-field px-3 text-sm font-semibold ${filter === value ? "bg-ink text-cream" : "bg-surface"}`}>{label}</button>)}
    </div>
    <p role="status" className="mb-3 text-sm text-muted">{tr("Найдено", "Табылды")} {visible.length} {tr("из", "/")} {products.length}. {message}</p>
    {!canDrag && <p className="mb-3 text-sm text-muted">{tr("Для перетаскивания выберите «Все» и очистите поиск. Кнопки «Выше» и «Ниже» меняют общий порядок.", "Сүйреу үшін «Барлығы» таңдап, іздеуді тазалаңыз. «Жоғары» және «Төмен» батырмалары жалпы ретті өзгертеді.")}</p>}
    {!visible.length && <EmptyState icon={<BoxIcon />} title={tr("Товары не найдены", "Тауар табылмады")} description={tr("Попробуйте другое название или сбросьте фильтры.", "Басқа атауды қолданыңыз немесе сүзгілерді тазалаңыз.")} action={<button className="btn-outline" onClick={() => { setQuery(""); setFilter("all"); }}>{tr("Сбросить фильтры", "Сүзгілерді тазалау")}</button>} />}
    <ul className="grid gap-3 lg:grid-cols-2">
      {visible.map((product) => <li key={product.id} data-product-id={product.id} className={`card flex flex-col gap-1 p-2.5 ${target === product.id ? "ring-2 ring-[var(--focus)]" : ""}`}>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!canDrag} aria-label={`${tr("Переместить", "Жылжыту")}: ${product.title}`} aria-describedby="catalog-drag-help" className="min-h-11 min-w-11 touch-none rounded-xl border border-field text-xl" style={{ touchAction: "none" }}
            onPointerDown={(event) => { if (event.button !== 0 || !canDrag) return; event.currentTarget.setPointerCapture(event.pointerId); setDragged(product.id); }}
            onPointerMove={(event) => { if (dragged === product.id) setTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-product-id]")?.dataset.productId); }}
            onPointerUp={(event) => { if (dragged === product.id) reorder(product.id, document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-product-id]")?.dataset.productId); }}
            onPointerCancel={() => { setDragged(undefined); setTarget(undefined); }}
            onKeyDown={(event) => { if (event.key === "Escape") { setDragged(undefined); setTarget(undefined); } }}><GripIcon /></button>
          <Link href={`/dashboard/products/${product.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3">
            <ProductPhoto url={product.photo_url} alt="" initial={product.title} thumbnail className="size-14 flex-none rounded-xl" />
            <div className="min-w-0"><div className="break-words font-semibold">{product.title}</div><div className="text-sm text-muted">{priceLabel(product.price, product.price_mode, lang, variantsOf(product).length > 0)}</div></div>
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2 text-sm"><span className={`rounded-full px-2 py-1 ${product.in_stock ? "bg-ok-bg text-ok-ink" : "bg-accent-soft text-accent-dark"}`}>{product.in_stock ? tr("В наличии", "Бар") : tr("Нет в наличии", "Қалмады")}</span>{product.is_hidden && <span className="rounded-full border border-field px-2 py-1">{tr("Скрыт с витрины", "Витринада жасырын")}</span>}{product.price_needs_review && <span className="rounded-full border border-field px-2 py-1">{tr("Цена не проверена", "Бағасы тексерілмеген")}</span>}</div>
          <ActionForm action={toggleStock}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="next" value={String(!product.in_stock)} /><button disabled={pending} type="submit" role="switch" aria-checked={product.in_stock} aria-label={`${tr("В наличии", "Бар")}: ${product.title}`} className="min-h-11 text-sm font-semibold underline">{product.in_stock ? tr("Отметить отсутствие", "Жоқ деп белгілеу") : tr("Вернуть в наличие", "Қайта қолжетімді ету")}</button></ActionForm>
        </div>
        <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted">{tr("Действия с товаром", "Тауармен әрекеттер")}</summary>
          <Link href={`/dashboard/products/${product.id}/edit`} className="flex min-h-11 items-center underline">{tr("Редактировать", "Өңдеу")}</Link>
          <ActionForm action={toggleHidden}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="next" value={String(!product.is_hidden)} /><button disabled={pending} type="submit" className="min-h-11 text-left underline">{product.is_hidden ? tr("Показать на витрине", "Витринада көрсету") : tr("Скрыть с витрины", "Витринадан жасыру")}</button></ActionForm>
          <div className="flex gap-3">{[-1, 1].map((direction) => <ActionForm key={direction} action={moveProduct}><input type="hidden" name="id" value={product.id} /><input type="hidden" name="direction" value={direction} /><button disabled={pending} className="min-h-11 min-w-11 px-2" aria-label={direction < 0 ? tr("Выше", "Жоғары") : tr("Ниже", "Төмен")}>{direction < 0 ? `↑ ${tr("Выше", "Жоғары")}` : `↓ ${tr("Ниже", "Төмен")}`}</button></ActionForm>)}</div>
        </details>
      </li>)}
    </ul>
    <p id="catalog-drag-help" className="mt-3 text-sm text-muted">{tr("Перетащите за ручку ↕ мышью или пальцем. С клавиатуры используйте «Действия с товаром» → «Выше» / «Ниже».", "Тұтқадан ↕ тінтуірмен немесе саусақпен сүйреңіз. Пернетақтада «Тауармен әрекеттер» → «Жоғары» / «Төмен» қолданыңыз.")}</p>
  </section>;
}
