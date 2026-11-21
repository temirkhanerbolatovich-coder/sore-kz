"use client";
// Переключатель светлой и тёмной темы. Выбор хранится в localStorage («sore-theme»);
// пока пользователь ничего не выбрал, тема следует за системой (и меняется вместе с ней).
// Обе иконки всегда в разметке, видимую выбирает CSS по data-theme: нет расхождения при гидратации.
import { useEffect, useSyncExternalStore } from "react";
import { MoonIcon, SunIcon } from "./icons";

export const THEME_STORAGE_KEY = "sore-theme";

function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Восстанавливает тему при клиентском отображении страницы ошибки Next.js. */
export function ThemeInitializer() {
  useEffect(() => {
    const saved = readStoredTheme();
    applyTheme(saved ? (saved === "dark" ? "dark" : "light") : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  return null;
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeToTheme, isDarkTheme, () => false);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const followSystem = () => {
      if (!readStoredTheme()) {
        applyTheme(media.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", followSystem);
    return () => media.removeEventListener("change", followSystem);
  }, []);

  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    // Плавный переход цветов только на время самой смены темы.
    const root = document.documentElement;
    root.classList.add("theme-fade");
    applyTheme(next);
    window.setTimeout(() => root.classList.remove("theme-fade"), 260);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Приватный режим браузера: тема просто не запомнится.
    }
  };

  return (
    <button
      type="button"
      className={`btn-icon theme-toggle ${className}`.trim()}
      onClick={toggle}
      aria-label="Светлая или тёмная тема"
      aria-pressed={dark}
      title="Светлая или тёмная тема"
    >
      <SunIcon className="theme-toggle-sun" />
      <MoonIcon className="theme-toggle-moon" />
    </button>
  );
}

function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  // Цвет адресной строки на телефоне следует за темой.
  const color = theme === "dark" ? "#17110c" : "#fff8f0";
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", color));
}
