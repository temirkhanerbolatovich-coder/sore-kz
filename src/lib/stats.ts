import type { SupabaseClient } from "@supabase/supabase-js";

export async function getStats(supabase: SupabaseClient, shopId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const count = (type: "view" | "order_click") =>
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("type", type)
      .gte("created_at", since);

  const [views, clicks, fresh] = await Promise.all([
    count("view"),
    count("order_click"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "new"),
  ]);

  return { views: views.count ?? 0, clicks: clicks.count ?? 0, newOrders: fresh.count ?? 0 };
}
