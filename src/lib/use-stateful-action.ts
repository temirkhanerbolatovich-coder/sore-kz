"use client";

import { useState, useTransition } from "react";

/**
 * Замена useActionState для форм, где важно не терять введённое при ошибке.
 * React 19 после каждого действия формы очищает неуправляемые поля; здесь форма отправляется через onSubmit,
 * поэтому введённые значения остаются на месте, а сервер по-прежнему возвращает состояние (ошибку, подсказку).
 */
export function useStatefulAction<S>(action: (prev: S, data: FormData) => Promise<S>, initial: S) {
  const [state, setState] = useState<S>(initial);
  const [pending, start] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    start(async () => {
      setState(await action(state, data));
    });
  }

  return [state, onSubmit, pending] as const;
}
