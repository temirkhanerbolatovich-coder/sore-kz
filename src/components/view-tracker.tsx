"use client";

import { useEffect } from "react";
import { hasSellerSession, publicRpc } from "@/lib/public-rpc";

/** Считает один просмотр магазина за сессию браузера. */
export function ViewTracker({ shopId }: { shopId: string }) {
  useEffect(() => {
    if (hasSellerSession(document.cookie)) return;
    const key = `sore-view-${shopId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage недоступен (приватный режим) — считаем просмотр один раз за загрузку.
    }
    let client = crypto.randomUUID();
    try {
      client = localStorage.getItem("sore-client") || client;
      localStorage.setItem("sore-client", client);
    } catch { /* Storage may be disabled; the server still enforces the per-client quota. */ }
    void publicRpc("record_view", { p_shop: shopId, p_client: client }, true).catch(() => undefined);
  }, [shopId]);

  return null;
}
