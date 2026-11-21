"use client";
import { useState, useTransition } from "react";

/** Small mutations retain their errors beside the triggering control. */
export function ActionForm({ action, children, className }: {
  action: (data: FormData) => Promise<void>; children: React.ReactNode; className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <form className={className} action={(data) => start(async () => {
    setError("");
    try { await action(data); } catch { setError("Не удалось сохранить изменение. Попробуйте ещё раз."); }
  })}>
    <fieldset disabled={pending} className="min-w-0 disabled:opacity-60">{children}</fieldset>
    {error && <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm text-accent-dark">{error}</p>}
  </form>;
}
