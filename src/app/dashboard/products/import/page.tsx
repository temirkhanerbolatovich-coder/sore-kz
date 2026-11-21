import { requireShop } from "@/lib/shop";
import { productLimit } from "@/lib/types";
import { FormHeader } from "../product-form";
import { getUiLang, tr } from "@/lib/ui-lang";
import { ImportForm } from "./import-form";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Прайс из Excel — SÖRE", "Excel прайсы — SÖRE") };
}

export default async function ImportPage() {
  const { supabase, shop } = await requireShop();
  const lang = await getUiLang();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  const slots = Math.max(0, productLimit(shop.pro_until) - (count ?? 0));

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-2xl flex-1 flex-col">
      <FormHeader title={tr(lang, "Прайс из Excel", "Excel прайсы")} />
      <ImportForm slots={slots} />
    </main>
  );
}
