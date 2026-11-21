"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Временное сообщение. Таймер приостанавливается, пока пользователь работает с ним. */
export function Toast({ message, onClose, action, closeLabel = "Закрыть", duration = 5000, bottomClassName = "bottom-24 lg:bottom-5" }: {
  message: string;
  onClose: () => void;
  action?: ReactNode;
  closeLabel?: string;
  duration?: number;
  bottomClassName?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const onCloseRef = useRef(onClose);
  const previousFocus = useRef<HTMLElement | null>(null);
  const toast = useRef<HTMLDivElement>(null);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, hovered, focused]);

  function close() {
    if (toast.current?.contains(document.activeElement) && previousFocus.current?.isConnected) {
      previousFocus.current.focus();
    }
    onClose();
  }

  return (
    <div
      ref={toast}
      className={`fixed inset-x-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-cream shadow-[var(--shadow-toast)] ${bottomClassName}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          previousFocus.current = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
        }
        setFocused(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span role="status" aria-live="polite" className="min-w-0 flex-1">{message}</span>
      {action}
      <button type="button" className="min-h-11 px-2 underline" onClick={close}>{closeLabel}</button>
    </div>
  );
}
