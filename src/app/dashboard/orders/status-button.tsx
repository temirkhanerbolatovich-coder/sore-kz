"use client";

import { ActionForm } from "@/components/action-form";
import { setOrderStatus } from "./actions";

/** Кнопка смены статуса заказа; для необратимо выглядящих действий спрашивает подтверждение. */
export function StatusButton({
  id,
  status,
  muted,
  confirmText,
  children,
}: {
  id: string;
  status: "new" | "done" | "cancelled";
  muted?: boolean;
  confirmText?: string;
  children: React.ReactNode;
}) {
  return (
    <ActionForm action={setOrderStatus} className="flex-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button
        type="submit"
        onClick={(e) => {
          if (confirmText && !window.confirm(confirmText)) e.preventDefault();
        }}
        className={`min-h-11 w-full rounded-[10px] text-sm font-bold ${muted ? "border-[1.5px] border-field text-muted" : "bg-ink text-cream"}`}
      >
        {children}
      </button>
    </ActionForm>
  );
}
