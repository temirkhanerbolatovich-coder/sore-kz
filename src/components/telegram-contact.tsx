"use client";

import { useState } from "react";
import { telegramChatUrl } from "@/lib/telegram-username";
import { TelegramIcon } from "@/components/icons";

/** Копирует текст в буфер обмена. Запасной путь для браузеров, где Clipboard API недоступен. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const area = document.createElement("textarea");
    try {
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      return ok;
    } catch {
      return false;
    } finally {
      area.remove();
      previousFocus?.focus();
    }
  }
}

/**
 * Кнопка «Написать в Telegram». Ссылка t.me/<ник> открывает личный чат, но подставить в него текст нельзя
 * (параметр text работает только у ссылок «поделиться»). Поэтому по нажатию текст заказа копируется,
 * а покупателю подсказываем вставить его в чат.
 */
export function TelegramContact({ username, text, label, copiedLabel }: { username: string; text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <a
        href={telegramChatUrl(username)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => void copyText(text).then(setCopied)}
        className="btn-outline h-14 w-full text-lg"
      >
        <TelegramIcon />
        {label}
      </a>
      {copied && (
        <p role="status" className="text-center text-caption font-semibold text-muted">
          {copiedLabel}
        </p>
      )}
    </>
  );
}
