import { TEMPLATE_EXAMPLES, TEMPLATE_HEADER, toCsv } from "@/lib/catalog-file";
import { catalogTemplateXlsx } from "@/lib/catalog-template";

/** Шаблон прайса: ?format=xlsx (по умолчанию) или ?format=csv. Статичен, входа не требует. */
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const headers = { "Cache-Control": "public, max-age=86400" };

  if (format === "csv") {
    return new Response(toCsv([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES]), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=\"sore-price-template.csv\"" },
    });
  }

  const body = await catalogTemplateXlsx();
  return new Response(new Uint8Array(body), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=\"sore-price-template.xlsx\"",
    },
  });
}
