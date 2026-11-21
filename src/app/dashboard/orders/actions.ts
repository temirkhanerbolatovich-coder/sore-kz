"use server";

import { revalidatePath } from "next/cache";
import { requireShop } from "@/lib/shop";

const STATUSES = ["new", "done", "cancelled"] as const;

export async function setOrderStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id).eq("shop_id", shop.id);
  if (error) throw new Error("Не удалось изменить статус");
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard");
}
