"use client";

import { useEffect } from "react";

/** Отправляет сбой браузера владельцу сервиса (один раз на показ страницы ошибки). */
export function ReportClientError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);
  return null;
}
