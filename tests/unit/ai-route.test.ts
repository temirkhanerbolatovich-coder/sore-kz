import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), download: vi.fn(), rpc: vi.fn(), remove: vi.fn(), send: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: mocks.create }; } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  storage: { from: () => ({ download: mocks.download }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "shop" } }), gte: async () => ({ count: 0 }) }) }) }),
}) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ delete: () => ({ eq: mocks.remove }) }) }) }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: mocks.send }));
import { POST } from "@/app/api/ai/product-card/route";
const url = "https://test.supabase.co/storage/v1/object/public/product-photos/owner/a.jpg";
const request = (photo_url: unknown = url) => new Request("http://localhost/api/ai/product-card", { method: "POST", body: JSON.stringify({ photo_url }) });
beforeEach(() => {
  vi.stubEnv("AI_PROVIDERS", "gemini,openrouter,anthropic"); vi.stubEnv("GEMINI_API_KEY", ""); vi.stubEnv("OPENROUTER_API_KEY", ""); vi.stubEnv("ANTHROPIC_API_KEY", "test"); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  mocks.rpc.mockResolvedValue({ data: "reservation", error: null }); mocks.download.mockResolvedValue({ data: new Blob(["test"], { type: "image/jpeg" }) });
  mocks.create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify({ title: "Товар", description_ru: "Описание", description_kz: "Сипаттама", category: "Торты" }) }] });
  vi.stubEnv("AI_GLOBAL_DAILY_LIMIT", undefined);
  mocks.send.mockResolvedValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
it("без ключа возвращает понятный 503", async () => { vi.stubEnv("ANTHROPIC_API_KEY", ""); expect((await POST(request())).status).toBe(503); });
it("вызывает подменённый Anthropic и возвращает карточку", async () => { const response = await POST(request()); expect(response.status).toBe(200); expect((await response.json()).card.title).toBe("Товар"); });
it.each(["https://evil.test/a.jpg", url.replace("owner", "other"), url.replace("a.jpg", "../other/a.jpg"), 123])("отклоняет чужое/некорректное фото %s", async (value) => expect((await POST(request(value))).status).toBe(400));
it("проверяет существование, тип и размер файла", async () => {
  for (const data of [null, new Blob(["x"], { type: "image/svg+xml" }), new Blob([new Uint8Array(6*1024*1024)], { type: "image/jpeg" })]) {
    mocks.download.mockResolvedValue({ data }); expect((await POST(request())).status).toBe(400);
  }
});
it("возвращает ошибку модели и освобождает попытку", async () => { mocks.create.mockRejectedValue(new Error("offline")); expect((await POST(request())).status).toBe(502); expect(mocks.remove).toHaveBeenCalledWith("id", "reservation"); });

it("резервирует попытку с общим лимитом по умолчанию", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("reserve_ai", expect.objectContaining({ p_global_limit: 300 }));
});

it("при достижении общего потолка отвечает 503 без провайдера и отправляет одно уведомление", async () => {
  vi.stubEnv("AI_GLOBAL_DAILY_LIMIT", "120");
  vi.stubEnv("ADMIN_TELEGRAM_CHAT_ID", "999");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test");
  const cap = { data: null, error: { message: "ai global limit exceeded" } };
  mocks.rpc.mockResolvedValueOnce(cap).mockResolvedValueOnce({ data: true, error: null })
    .mockResolvedValueOnce(cap).mockResolvedValueOnce({ data: false, error: null });

  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "ИИ сегодня перегружен, заполните карточку вручную." });
  expect((await POST(request())).status).toBe(503);
  expect(mocks.rpc).toHaveBeenCalledWith("reserve_ai", expect.objectContaining({ p_global_limit: 120 }));
  expect(mocks.rpc).toHaveBeenCalledWith("rate_limit_hit", { p_key: "ai-global-limit:alert", p_seconds: 86400, p_limit: 1 });
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith("999", expect.stringContaining("120"));
  expect(mocks.create).not.toHaveBeenCalled();
});

it("личный лимит по-прежнему отвечает 429", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "ai limit exceeded" } });
  expect((await POST(request())).status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
});
