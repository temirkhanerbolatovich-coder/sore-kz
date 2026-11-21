/**
 * Проверка ИИ-провайдеров на реальном фото: npm run ai:check -- путь/к/фото.jpg
 * Берёт ключи из .env.local, ничего не печатает про ключи, показывает кто ответил и что вернул.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { aiSteps, cardTask, generateCard } = await import("@/lib/ai-providers");
  const steps = aiSteps();
  if (steps.length === 0) {
    console.error("Ни один ИИ-провайдер не настроен. Задайте GEMINI_API_KEY и/или OPENROUTER_API_KEY в .env.local.");
    process.exit(2);
  }
  console.log("Цепочка:", steps.map((s) => s.label).join(" → "));

  const file = process.argv[2] ?? "public/icon-512.png";
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const base64 = (await readFile(file)).toString("base64");

  // Каждый шаг проверяем отдельно, чтобы увидеть, какие модели реально живы.
  let ok = 0;
  for (const step of steps) {
    const started = Date.now();
    try {
      const { parseCard } = await import("@/lib/ai-card");
      const card = parseCard(await step.run({ base64, mime }, 30_000, cardTask()));
      const ms = Date.now() - started;
      if (card) { ok++; console.log(`✔ ${step.label} (${ms} мс): «${card.title}» / ${card.category}\n   RU: ${card.description_ru}\n   KZ: ${card.description_kz}`); }
      else console.log(`✖ ${step.label} (${ms} мс): ответ не разобран`);
    } catch (e) {
      console.log(`✖ ${step.label}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\nРаботают: ${ok} из ${steps.length}`);
  // Итоговая проверка, как это увидит сервис.
  if (ok > 0) console.log("Сервис выберет первую рабочую модель:", (await generateCard({ base64, mime })).provider);
  process.exit(ok > 0 ? 0 : 1);
}
main();
