import { notFound } from "next/navigation";
import { requireShop } from "@/lib/shop";
import { getUiLang, tr } from "@/lib/ui-lang";
import type { Product } from "@/lib/types";
import { FormHeader, ProductForm } from "../../product-form";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Редактирование товара — SÖRE", "Тауарды өңдеу — SÖRE") };
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lang = await getUiLang();
  const { supabase, shop } = await requireShop();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .maybeSingle<Product>();
  if (!product) notFound();

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-2xl flex-1 flex-col">
      <FormHeader title={tr(lang, "Редактирование", "Өңдеу")} />
      <ProductForm product={product} />
    </main>
  );
}
