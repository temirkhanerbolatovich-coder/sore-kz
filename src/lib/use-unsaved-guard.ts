"use client";

import { useEffect } from "react";

/**
 * Защита от случайной потери введённых данных: пока dirty = true, переход по внутренним ссылкам
 * (в том числе «Назад» в шапке и нижнее меню) просит подтверждение, а закрытие вкладки или
 * обновление страницы вызывает системное предупреждение браузера.
 */
export function useUnsavedGuard(dirty: boolean, message = "Изменения не сохранены. Уйти без сохранения?") {
  useEffect(() => {
    if (!dirty) return;

    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
