"use client";

import { useActionState, useRef, useState } from "react";
import { useTr } from "@/components/ui-lang";
import { deleteAccount, type DeleteState } from "./account-actions";

const initial: DeleteState = {};

/** Удаление магазина и аккаунта: сначала раскрывается предупреждение, затем нужно ввести адрес магазина. */
export function DangerZone({ slug }: { slug: string }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Поле управляется состоянием: иначе React очищает его после каждой попытки и приходится вводить адрес заново.
  const [confirm, setConfirm] = useState("");
  const [state, action, pending] = useActionState(deleteAccount, initial);

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5" aria-labelledby="danger-title">
      <h2 id="danger-title" className="text-lg font-bold">
        {tr("Удаление", "Жою")}
      </h2>
      <button ref={triggerRef} type="button" aria-expanded={open} aria-controls="delete-account-form" onClick={() => setOpen(!open)} className="min-h-11 self-start text-sm font-semibold text-accent-dark underline">
          {tr("Удалить магазин и аккаунт", "Дүкен мен аккаунтты жою")}
      </button>
      {open && (
        <form id="delete-account-form" action={action} className="card flex flex-col gap-3 p-4">
          <p className="text-body leading-relaxed">
            {tr("Будут безвозвратно удалены магазин, все товары, фото и заказы, а также ваш аккаунт. Отменить это нельзя.", "Дүкен, барлық тауар, фото мен тапсырыстар, сондай-ақ аккаунтыңыз біржола жойылады. Мұны қайтару мүмкін емес.")}
          </p>
          <label htmlFor="confirm-slug" className="text-sm font-semibold">
            {tr("Для подтверждения введите адрес магазина", "Растау үшін дүкен мекенжайын енгізіңіз")}: <b>{slug}</b>
          </label>
          <input id="confirm-slug" name="confirm" autoComplete="off" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" />
          {state.error && (
            <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm font-semibold text-accent-dark">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-accent h-12 flex-1 disabled:opacity-60">
              {pending ? tr("Удаляем…", "Жойылуда…") : tr("Удалить навсегда", "Біржола жою")}
            </button>
            <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="btn-outline h-12 flex-1">
              {tr("Отмена", "Бас тарту")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
