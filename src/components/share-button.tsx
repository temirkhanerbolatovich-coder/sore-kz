"use client";

import { useState } from "react";
import { ShareIcon } from "./icons";

/** «Поделиться»: системное меню на телефоне, а где его нет, копирование ссылки. */
export function ShareButton({ title, label = "Поделиться", copiedLabel = "Ссылка скопирована", className = "" }: { title: string; label?: string; copiedLabel?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      // Пользователь закрыл меню «Поделиться» — это не ошибка.
      if (e instanceof DOMException && e.name === "AbortError") return;
      window.prompt("Скопируйте ссылку:", url);
    }
  }

  return (
    <button type="button" onClick={share} className={`flex min-h-11 items-center gap-1.5 px-2 text-sm font-semibold ${className}`}>
      <ShareIcon size={18} />
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}
