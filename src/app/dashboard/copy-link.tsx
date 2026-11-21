"use client";

import { useState } from "react";
import { useTr } from "@/components/ui-lang";

export function CopyLink({ url }: { url: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(tr("Скопируйте ссылку:", "Сілтемені көшіріңіз:"), url);
    }
  }

  return (
    <button type="button" onClick={copy} className="h-11 w-full rounded-xl bg-ink px-3 text-sm font-semibold text-cream">
      {copied ? tr("Скопировано", "Көшірілді") : tr("Копировать", "Көшіру")}
    </button>
  );
}

/** Готовый текст для био Instagram или закрепа в Telegram: ссылка с призывом, чтобы покупатель понимал, что делать. */
export function CopyBio({ url }: { url: string }) {
  const tr = useTr();
  const [copied, setCopied] = useState(false);
  const text = `${tr("Каталог и заказ", "Каталог және тапсырыс")}: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(tr("Скопируйте текст:", "Мәтінді көшіріңіз:"), text);
    }
  }

  return (
    <button type="button" onClick={copy} className="min-h-11 self-start text-sm font-semibold underline">
      {copied ? tr("Скопировано", "Көшірілді") : tr("Скопировать текст для Instagram", "Instagram үшін мәтінді көшіру")}
    </button>
  );
}
