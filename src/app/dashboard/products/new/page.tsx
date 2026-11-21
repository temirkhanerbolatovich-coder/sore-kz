import { requireShop } from "@/lib/shop";
import { getUiLang, tr } from "@/lib/ui-lang";
import { isPro, productLimit } from "@/lib/types";
import { FormHeader, ProductForm } from "../product-form";
import { proRequestUrl } from "@/lib/support";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Новый товар — SÖRE", "Жаңа тауар — SÖRE") };
}

export default async function NewProductPage() {
  const lang = await getUiLang();
  const { supabase, shop } = await requireShop();
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("shop_id", shop.id);
  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-2xl flex-1 flex-col">
      <FormHeader title={tr(lang, "Новый товар", "Жаңа тауар")} />
      <ProductForm atLimit={(count ?? 0) >= productLimit(shop.pro_until)} cap={productLimit(shop.pro_until)} proUrl={isPro(shop.pro_until) ? null : proRequestUrl(shop.slug)} />
    </main>
  );
}
