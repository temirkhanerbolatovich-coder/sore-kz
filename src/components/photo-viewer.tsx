"use client";

import { useRef, type ReactNode } from "react";

/** Тап по фото открывает его на весь экран. Нативный <dialog>: Esc закрывает, фокус возвращается на кнопку. */
export function PhotoViewer({ url, alt, zoomLabel, closeLabel, children }: {
  url: string;
  alt: string;
  zoomLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" aria-label={`${zoomLabel}: ${alt}`} onClick={() => dialog.current?.showModal()} className="block w-full cursor-zoom-in md:rounded-2xl">
        {children}
      </button>
      <dialog
        ref={dialog}
        aria-label={alt}
        onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}
        className="m-auto max-h-[100dvh] w-full max-w-5xl bg-transparent p-0 backdrop:bg-ink/80"
      >
        <div className="flex flex-col items-center gap-2 p-3">
          <button type="button" autoFocus onClick={() => dialog.current?.close()} className="btn-accent self-end">
            {closeLabel}
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-h-[80dvh] w-auto max-w-full rounded-xl object-contain" onClick={() => dialog.current?.close()} />
        </div>
      </dialog>
    </>
  );
}
