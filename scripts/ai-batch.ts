/**
 * Пакетный прогон ИИ-карточки по папке с фото: npm run ai:batch -- папка_с_фото
 * Как реальный сервис: цепочка провайдеров, первый рабочий отвечает. Результат печатается и пишется в reports/ai-batch.json.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error("Укажите папку: npm run ai:batch -- путь/к/папке"); process.exit(2); }
  const { generateCard, aiConfigured } = await import("@/lib/ai-providers");
  if (!aiConfigured()) { console.error("ИИ-ключи не заданы в .env.local"); process.exit(2); }

  const files = (await readdir(dir)).filter((f) => MIME[path.extname(f).toLowerCase()]).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
  const rows: unknown[] = [];
  for (const f of files) {
    const started = Date.now();
    try {
      const bytes = await readFile(path.join(dir, f));
      const r = await generateCard({ base64: bytes.toString("base64"), mime: MIME[path.extname(f).toLowerCase()] });
      const ms = Date.now() - started;
      rows.push({ file: f, ms, provider: r.provider, kzDropped: r.kzDropped, ...r.card });
      console.log(`\n[${f}] ${r.provider} ${ms} мс${r.kzDropped ? " (KZ отброшен)" : ""}\n  ${r.card.title} | ${r.card.category} | ${r.card.tags.join(", ")}\n  RU: ${r.card.description_ru}\n  KZ: ${r.card.description_kz}`);
    } catch (e) {
      rows.push({ file: f, error: String(e) });
      console.log(`\n[${f}] ОШИБКА: ${e instanceof Error ? e.message : e}`);
    }
  }
  await mkdir("reports", { recursive: true });
  await writeFile("reports/ai-batch.json", JSON.stringify(rows, null, 2));
  console.log(`\nГотово: ${rows.filter((r) => !(r as { error?: string }).error).length} из ${files.length}`);
}
main();
