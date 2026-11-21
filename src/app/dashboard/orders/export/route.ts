import { NextResponse } from "next/server";
import { requireShop } from "@/lib/shop";
import { applyOrderFilters, parseOrderFilters } from "@/lib/orders-query";
import { buildOrdersCsv, type CsvOrder } from "@/lib/orders-csv";

const MAX_ROWS = 5000;

/** CSV с заказами магазина текущего продавца; поиск, дата и статус те же, что на странице заказов. */
export async function GET(request: Request) {
  const { supabase, shop } = await requireShop();
  const filters = parseOrderFilters(Object.fromEntries(new URL(request.url).searchParams));
  const query = applyOrderFilters(
    supabase.from("orders").select("*").eq("shop_id", shop.id).order("created_at", { ascending: false }).order("id", { ascending: false }),
    filters,
  );
  const { data, error } = await query.limit(MAX_ROWS);
  if (error) return NextResponse.json({ error: "Не удалось выгрузить заказы" }, { status: 500 });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(new Date());
  return new NextResponse(buildOrdersCsv((data ?? []) as unknown as CsvOrder[]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${shop.slug}-${today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
