import { requireShop } from "@/lib/shop";
import { productLimit } from "@/lib/types";
import { FormHeader } from "../product-form";
import { getUiLang, tr } from "@/lib/ui-lang";
import { BatchForm } from "./batch-form";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Несколько фото — SÖRE", "Бірнеше фото — SÖRE") };
}

export default async function BatchPage() {
  const { supabase, shop } = await requireShop();
  const lang = await getUiLang();
  const { data } = await supabase.from("products").select("category").eq("shop_id", shop.id);
  const categories = [...new Set((data ?? []).map((p) => p.category).filter((c): c is string => Boolean(c)))];
  const slots = Math.max(0, productLimit(shop.pro_until) - (data?.length ?? 0));

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-2xl flex-1 flex-col">
      <FormHeader title={tr(lang, "Несколько фото сразу", "Бірнеше фото бірден")} />
      <BatchForm slots={slots} categories={categories} />
    </main>
  );
}
