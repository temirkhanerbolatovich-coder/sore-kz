import ExcelJS from "exceljs";
import { TEMPLATE_EXAMPLES, TEMPLATE_HEADER } from "@/lib/catalog-file";

/** Шаблон прайса .xlsx: общий для кабинета (/api/import/template) и бота (/import). */
export async function catalogTemplateXlsx(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Прайс");
  sheet.addRow(TEMPLATE_HEADER).font = { bold: true };
  TEMPLATE_EXAMPLES.forEach((row) => sheet.addRow(row));
  [28, 10, 14, 16, 34, 34, 12].forEach((width, i) => (sheet.getColumn(i + 1).width = width));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Причины пропуска строк из import_products, понятные продавцу. */
export const IMPORT_SKIP_REASON: Record<string, string> = {
  limit: "лимит товаров вашего тарифа",
  invalid: "база не приняла значения строки",
};
