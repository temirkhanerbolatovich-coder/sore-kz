// Заказы в боте: список последних и смена статуса кнопкой. Заказ меняется только в магазине этого чата.
import type { SupabaseClient } from "@supabase/supabase-js";
import { findLinkedShop } from "@/lib/bot/shop-link";
import type { OrderForList } from "@/lib/bot/texts";

export type BotOrder = OrderForList & { id: string };

export async function recentOrders(db: SupabaseClient, shopId: string, limit = 5): Promise<BotOrder[]> {
  const { data } = await db
    .from("orders")
    .select("id,number,created_at,customer_name,total,status,items")
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((o) => ({
    ...(o as Omit<BotOrder, "items">),
    items: Array.isArray(o.items) ? (o.items as { title: string; qty: number }[]) : [],
  }));
}

/** Возвращает номер заказа или null, если заказа нет в магазине этого чата. */
export async function setOrderStatusFromChat(
  db: SupabaseClient,
  chatId: number,
  orderId: string,
  status: "done" | "cancelled",
): Promise<number | null> {
  const shop = await findLinkedShop(db, chatId);
  if (!shop) return null;
  const { data } = await db.from("orders").update({ status }).eq("id", orderId).eq("shop_id", shop.id).select("number").maybeSingle();
  return (data?.number as number | undefined) ?? null;
}
