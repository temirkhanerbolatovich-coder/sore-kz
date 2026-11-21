"use client";

import { createContext, useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Lang } from "@/lib/lang";

const COOKIE = "sore-lang";
const LangContext = createContext<Lang>("ru");

function saveLang(lang: Lang) {
  document.cookie = `${COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/** Передаёт язык интерфейса клиентским компонентам и выставляет lang документа. */
export function UiLangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = lang === "kz" ? "kk" : "ru";
    return () => { document.documentElement.lang = "ru"; };
  }, [lang]);
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useUiLang = () => useContext(LangContext);

/** tr("по-русски", "қазақша") выбирает подпись по языку интерфейса. */
export function useTr() {
  const lang = useUiLang();
  return (ru: string, kz: string) => (lang === "kz" ? kz : ru);
}

/** Запоминает язык, пришедший параметром ?lang=, чтобы кабинет открылся на нём же. */
export function RememberLang({ lang }: { lang: Lang }) {
  useEffect(() => saveLang(lang), [lang]);
  return null;
}

/** Переключатель RU/KZ: сохраняет выбор в cookie и перерисовывает страницу. */
export function UiLangSwitch({ className = "" }: { className?: string }) {
  const lang = useUiLang();
  const router = useRouter();
  const pick = (next: Lang) => {
    if (next === lang) return;
    saveLang(next);
    router.refresh();
  };
  const item = (value: Lang, label: string, rounded: string) => (
    <button
      type="button"
      aria-pressed={lang === value}
      onClick={() => pick(value)}
      className={`flex min-h-11 min-w-11 items-center justify-center px-3 ${rounded} ${lang === value ? "bg-ink text-cream" : "text-muted"}`}
    >
      {label}
    </button>
  );
  return (
    <div className={`flex rounded-full border-[1.5px] border-field text-caption font-bold ${className}`} role="group" aria-label={lang === "kz" ? "Тіл" : "Язык"}>
      {item("ru", "RU", "rounded-l-full")}
      {item("kz", "KZ", "rounded-r-full")}
    </div>
  );
}
