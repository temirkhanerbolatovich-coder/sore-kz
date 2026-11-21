import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, kzUsable, parseCard, type AiCard } from "@/lib/ai-card";

/**
 * Цепочка ИИ-провайдеров для карточки товара по фото. Порядок задаёт AI_PROVIDERS
 * (по умолчанию: gemini → openrouter → anthropic). Провайдер без ключа пропускается,
 * при ошибке, лимите (429) или нечитаемом ответе берётся следующий.
 *
 * Бесплатные варианты (проверено 16.11.2026):
 * - Google Gemini API: ключ из AI Studio. Живая проверка 16.11.2026: gemini-3.1-flash-lite (~2 с), gemini-3.5-flash-lite (~8 с),
 *   gemini-3.6-flash (~10 с) отвечают; gemini-2.5-* дают 404, алиасы *-latest нестабильны (таймаут/503).
 *   Внимание: на бесплатном тарифе Google может использовать запросы для улучшения своих продуктов.
 * - OpenRouter: модели с суффиксом :free. Проверка 16.11.2026: nemotron-3.5-super-vl отвечает (~10 с, reasoning-модель,
 *   нужен max_tokens 4096), gemma-4-* временами дают 429 «rate-limited upstream», ling-3.2-flash слишком медленный (~60 с).
 */

/** categories: уже существующие категории магазина (для единообразия карточек). */
export type ImageInput = { base64: string; mime: string; categories?: string[] };
export type AiResult = { card: AiCard; provider: string; kzDropped: boolean };

const STEP_TIMEOUT_MS = 25_000;
/** Общий бюджет цепочки: маршрут живёт не дольше 60 с, поэтому после 50 с новые модели не запускаем. */
const TOTAL_BUDGET_MS = 50_000;
/** Если модель не ответила за 8 с, параллельно стартует следующая (у бесплатных моделей бывают хвосты 25+ с). */
const HEDGE_MS = 8_000;
/** Что спросить у модели: системный промпт, текст запроса и потолок длины ответа. */
export type AiTask = { system: string; prompt: string; maxTokens: number };

type Step = { label: string; run: (img: ImageInput, timeoutMs: number, task: AiTask) => Promise<string> };

const list = (value: string | undefined, fallback: string) =>
  (value || fallback).split(",").map((s) => s.trim()).filter(Boolean);

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function geminiSteps(): Step[] {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  return list(process.env.GEMINI_MODELS, "gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.6-flash").map((model) => ({
    label: `gemini:${model}`,
    run: async (img, timeoutMs, task) => {
      const json = (await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { "x-goog-api-key": key },
        {
          systemInstruction: { parts: [{ text: task.system }] },
          contents: [{ role: "user", parts: [{ inline_data: { mime_type: img.mime, data: img.base64 } }, { text: task.prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: task.maxTokens },
        },
        timeoutMs,
      )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    },
  }));
}

function openRouterSteps(): Step[] {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return [];
  const models = list(process.env.OPENROUTER_MODELS, "nvidia/nemotron-3.5-super-vl:free,google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,openrouter/free");
  return models.map((model) => ({
    label: `openrouter:${model}`,
    run: async (img, timeoutMs, task) => {
      const json = (await postJson(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          Authorization: `Bearer ${key}`,
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "X-Title": "Sore",
        },
        {
          model,
          // Reasoning-модели тратят токены на «размышления»: при малом лимите content приходит пустым.
          max_tokens: Math.max(task.maxTokens, 4096),
          temperature: 0.4,
          messages: [
            { role: "system", content: task.system },
            {
              role: "user",
              content: [
                { type: "text", text: task.prompt },
                { type: "image_url", image_url: { url: `data:${img.mime};base64,${img.base64}` } },
              ],
            },
          ],
        },
        timeoutMs,
      )) as { choices?: { message?: { content?: string | { text?: string }[] } }[] };
      const content = json.choices?.[0]?.message?.content;
      return Array.isArray(content) ? content.map((c) => c.text ?? "").join("") : (content ?? "");
    },
  }));
}

function anthropicSteps(): Step[] {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return [];
  return [
    {
      label: "anthropic",
      run: async (img, timeoutMs, task) => {
        const client = new Anthropic({ apiKey: key, timeout: timeoutMs, maxRetries: 0 });
        const message = await client.messages.create({
          model: process.env.AI_MODEL ?? "claude-sonnet-5-5",
          max_tokens: task.maxTokens,
          system: task.system,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: img.mime as "image/jpeg" | "image/png" | "image/webp", data: img.base64 } },
                { type: "text", text: task.prompt },
              ],
            },
          ],
        });
        return message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      },
    },
  ];
}

const BUILDERS: Record<string, () => Step[]> = { gemini: geminiSteps, openrouter: openRouterSteps, anthropic: anthropicSteps };

/** Шаги цепочки в порядке приоритета; пусто, если не задан ни один ключ. */
export function aiSteps(): Step[] {
  return list(process.env.AI_PROVIDERS, "gemini,openrouter,anthropic").flatMap((id) => BUILDERS[id]?.() ?? []);
}

export const aiConfigured = () => aiSteps().length > 0;

/**
 * Запрашивает модели по цепочке и отдаёт первый ответ, который принял accept. Следующая модель стартует, когда предыдущая
 * упала или молчит дольше HEDGE_MS, поэтому медленный ответ одной модели не растягивает ожидание продавца.
 * Бросает ошибку, только если не получилось ни у одной.
 */
export function runChain<T>(img: ImageInput, task: AiTask, accept: (text: string) => T | null): Promise<{ value: T; provider: string }> {
  const steps = aiSteps();
  if (steps.length === 0) return Promise.reject(new Error("no provider"));

  const started = Date.now();
  return new Promise((resolve, reject) => {
    const failures: string[] = [];
    let next = 0;
    let pending = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const launch = () => {
      clearTimeout(hedgeTimer);
      if (settled) return;
      const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
      if (next >= steps.length || remaining < 4_000) {
        if (next < steps.length) failures.push(`${steps[next].label}: не хватило времени`);
        if (pending === 0) {
          settled = true;
          reject(new Error(failures.join("; ") || "no provider"));
        }
        return;
      }
      const step = steps[next++];
      pending++;
      hedgeTimer = setTimeout(launch, HEDGE_MS);

      step
        .run(img, Math.min(STEP_TIMEOUT_MS, remaining), task)
        .then((text) => {
          const value = accept(text);
          if (value === null) throw new Error("нечитаемый ответ");
          if (settled) return;
          settled = true;
          clearTimeout(hedgeTimer);
          resolve({ value, provider: step.label });
        })
        .catch((e) => {
          failures.push(`${step.label}: ${e instanceof Error ? e.message : "ошибка"}`);
        })
        .finally(() => {
          pending--;
          if (!settled) launch(); // эта модель закончилась неудачей: сразу берём следующую
        });
    };

    launch();
  });
}

/** Запрос «карточка одного товара по фото». */
export const cardTask = (categories?: string[]): AiTask => ({
  system: buildSystemPrompt(categories),
  prompt: "Составь карточку товара по этому фото.",
  maxTokens: 4096,
});

/** Карточка одного товара по фото. */
export async function generateCard(img: ImageInput): Promise<AiResult> {
  const { value: card, provider } = await runChain(img, cardTask(img.categories), (text) => {
    const parsed = parseCard(text);
    return parsed && parsed.title ? parsed : null;
  });
  // Слабая модель могла ответить «казахским» латиницей: лучше пустое поле, чем мусор.
  const kzDropped = card.description_ru !== "" && !kzUsable(card.description_kz);
  return { card: kzDropped ? { ...card, description_kz: "" } : card, provider, kzDropped };
}
