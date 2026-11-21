"use client";

import { useTr } from "@/components/ui-lang";

/** Декоративная заглушка: подпись загрузки задаёт контейнер. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-xl bg-line motion-safe:animate-pulse ${className}`} />;
}

/** Каркасы повторяют основные блоки страниц, не изображая реальные данные. */
export function DashboardSkeleton() {
  const tr = useTr();
  return (
    <main id="main-content" tabIndex={-1} role="status" className="mx-auto w-full max-w-md space-y-4 p-5 lg:max-w-6xl">
      <span className="sr-only">{tr("Загружаем кабинет…", "Кабинет жүктелуде…")}</span>
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-14 w-full" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}

export function OrdersSkeleton() {
  const tr = useTr();
  return (
    <main id="main-content" tabIndex={-1} role="status" className="mx-auto w-full max-w-md space-y-4 p-5 lg:max-w-6xl">
      <span className="sr-only">{tr("Загружаем заказы…", "Тапсырыстар жүктелуде…")}</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
    </main>
  );
}

export function StoreSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="mx-auto w-full max-w-6xl space-y-4 p-5">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-56" />)}
      </div>
    </div>
  );
}
