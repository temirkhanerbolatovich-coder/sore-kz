"use client";

import type { ReactNode } from "react";
import { useTr } from "@/components/ui-lang";
import { BoxIcon } from "@/components/icons";

/** Для сбоя целого экрана; обработчик повторной попытки задаёт граница ошибки. */
export function ErrorState({ title, description, retry, children }: {
  title: string;
  description: string;
  retry: () => void;
  children?: ReactNode;
}) {
  const tr = useTr();
  return (
    <div className="flex flex-col items-start gap-4">
      <span className="icon-badge" aria-hidden="true"><BoxIcon size={24} /></span>
      <h1 className="text-xl font-bold">{title}</h1>
      <p role="alert">{description}</p>
      <button type="button" onClick={retry} className="btn-accent">{tr("Повторить", "Қайталау")}</button>
      {children}
    </div>
  );
}
