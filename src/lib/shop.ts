import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Shop } from "@/lib/types";

/** Текущий пользователь и его магазин; без входа или магазина — редирект. */
export async function requireShop() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase
    .from("shops")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<Shop>();
  if (!shop) redirect("/dashboard/onboarding");

  return { supabase, user, shop };
}
