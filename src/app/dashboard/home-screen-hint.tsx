"use client";

import { useEffect, useState } from "react";
import { useTr } from "@/components/ui-lang";

const KEY = "sore-home-hint-seen";
let shownThisSession = false;

export function HomeScreenHint() {
  const tr = useTr();
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">();
  useEffect(() => {
    if (shownThisSession || window.matchMedia("(display-mode: standalone)").matches) return;
    try { if (localStorage.getItem(KEY)) return; } catch { /* В приватном режиме действует память вкладки. */ }
    const agent = navigator.userAgent;
    const value = /iPhone|iPad|iPod/.test(agent) ? "ios" : /Android/.test(agent) ? "android" : "desktop";
    const timer = window.setTimeout(() => {
      shownThisSession = true;
      try { localStorage.setItem(KEY, "1"); } catch { /* Подсказка не должна блокировать кабинет. */ }
      setPlatform(value);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!platform) return null;
  const text = platform === "ios"
    ? tr("В Safari откройте «Поделиться» → «На экран Домой».", "Safari-де «Бөлісу» → «Үй экранына» тармағын ашыңыз.")
    : platform === "android"
      ? tr("Откройте меню браузера → «Добавить на главный экран», если этот пункт доступен.", "Браузер мәзірін ашыңыз → «Басты экранға қосу», егер бұл тармақ бар болса.")
      : tr("Сохраните страницу в закладки браузера, чтобы быстро возвращаться к заказам.", "Тапсырыстарға тез оралу үшін бетті браузер бетбелгісіне сақтаңыз.");
  return <aside className="card mx-5 mt-3 p-4" aria-label={tr("Быстрый доступ к магазину", "Дүкенге жылдам қол жеткізу")}>
    <h2 className="font-bold">{tr("Добавьте кабинет на главный экран", "Кабинетті басты экранға қосыңыз")}</h2>
    <p className="mt-2 text-sm text-muted">{text} {tr("Для работы нужен интернет.", "Жұмыс үшін интернет керек.")}</p>
    <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => setPlatform(undefined)}>{tr("Понятно", "Түсінікті")}</button>
  </aside>;
}
