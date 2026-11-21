import Link from "next/link";
import { T, type Lang } from "@/lib/lang";

/** Плашка демо-магазина (адрес demo-…): магазин вымышленный, заказы и вопросы никуда не отправляются. */
export function DemoNotice({ lang, className = "" }: { lang: Lang; className?: string }) {
  const t = T[lang];
  return (
    <div role="note" className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm ${className}`}>
      <span className="font-semibold">{t.demoBanner}</span>
      <Link href="/" className="font-bold underline">
        {t.demoCta}
      </Link>
    </div>
  );
}

/** Плашка «магазин не принимает заказы» (переключатель продавца). */
export function PausedNotice({ lang, className = "" }: { lang: Lang; className?: string }) {
  return (
    <div role="note" className={`rounded-xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-dark ${className}`}>
      {T[lang].paused}
    </div>
  );
}

/** Вместо кнопки «В корзину», пока магазин не принимает заказы. */
export function PausedActionStub({ lang, className = "h-11 text-sm" }: { lang: Lang; className?: string }) {
  return (
    <span aria-disabled="true" className={`flex w-full items-center justify-center rounded-xl border-[1.5px] border-dashed border-field px-3 text-center font-bold text-muted ${className}`}>
      {T[lang].pausedShort}
    </span>
  );
}

/** Вместо кнопки WhatsApp в демо-магазине: видно, где была бы кнопка, но никуда не ведёт. */
export function DemoActionStub({ lang, className = "h-11 text-sm" }: { lang: Lang; className?: string }) {
  return (
    <span aria-disabled="true" className={`flex w-full items-center justify-center rounded-xl border-[1.5px] border-dashed border-field px-3 text-center font-bold text-muted ${className}`}>
      {T[lang].demoNoOrder}
    </span>
  );
}
