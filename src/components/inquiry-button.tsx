"use client";

import { publicRpc } from "@/lib/public-rpc";
import { WhatsAppIcon } from "@/components/icons";

/**
 * «Узнать цену» для позиций «от» и «по запросу»: обычная ссылка на WhatsApp с готовым текстом
 * (работает и без JS), а по клику дополнительно считается обращение для статистики продавца.
 */
export function InquiryButton({
  shopId,
  productId,
  href,
  label,
}: {
  shopId: string;
  productId: string;
  href: string;
  label: string;
}) {
  function record() {
    let client = crypto.randomUUID();
    try {
      client = localStorage.getItem("sore-client") || client;
      localStorage.setItem("sore-client", client);
    } catch {
      /* Хранилище может быть отключено: сервер всё равно ограничивает частоту. */
    }
    void publicRpc("record_inquiry", { p_shop: shopId, p_product: productId, p_client: client }, true).catch(() => undefined);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={record}
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-wa px-3 text-sm font-bold text-on-accent"
    >
      <WhatsAppIcon size={18} />
      {label}
    </a>
  );
}
