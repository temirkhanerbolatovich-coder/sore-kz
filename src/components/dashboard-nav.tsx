"use client";

import Link from "next/link";
import { useTr } from "@/components/ui-lang";
import { BoxIcon, CartIcon, ShopIcon } from "@/components/icons";

const items = [
  { key: "products", label: ["Товары", "Тауарлар"], href: "/dashboard", Icon: BoxIcon },
  { key: "orders", label: ["Заказы", "Тапсырыстар"], href: "/dashboard/orders", Icon: CartIcon },
  { key: "settings", label: ["Настройки", "Баптаулар"], href: "/dashboard/settings", Icon: ShopIcon },
] as const;

export function DashboardNav({ active, newOrders = 0, desktop = false }: { active: "products" | "orders" | "settings"; newOrders?: number; desktop?: boolean }) {
  const tr = useTr();
  return (
    <nav className={desktop ? "hidden border-b border-line bg-surface lg:block" : "fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface lg:hidden"} aria-label={tr("Разделы кабинета", "Кабинет бөлімдері")}>
      <div className="mx-auto grid h-[68px] max-w-md grid-cols-3 items-center text-center text-caption font-semibold lg:max-w-6xl lg:grid-cols-[repeat(3,8rem)] lg:justify-start lg:gap-2 lg:px-5">
        {items.map((i) => (
          <Link
            key={i.key}
            href={i.href}
            aria-current={active === i.key ? "page" : undefined}
            className={`flex h-full items-center justify-center gap-1.5 ${active === i.key ? "text-accent" : "text-muted"}`}
          >
            <i.Icon size={18} />
            {tr(i.label[0], i.label[1])}
            {i.key === "orders" && newOrders > 0 && (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold leading-none text-on-accent">
                {newOrders}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
