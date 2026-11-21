import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  removeFiles: vi.fn(),
  rpc: vi.fn(),
  release: vi.fn(),
  user: { id: "owner" } as { id: string } | null,
}));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { messages = { create: mocks.create }; } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
    storage: {
      from: () => ({
        download: mocks.download,
        upload: mocks.upload,
        remove: mocks.removeFiles,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/product-photos/${path}` } }),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { id: "shop" } }), gte: async () => ({ count: 0 }), then: (r: (v: unknown) => void) => r({ data: [] }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ delete: () => ({ eq: mocks.release }) }) }) }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));
import { POST } from "@/app/api/ai/shelf/route";

const url = "https://test.supabase.co/storage/v1/object/public/product-photos/owner/shelf.jpg";
const request = (photo_url: unknown = url) => new Request("http://localhost/api/ai/shelf", { method: "POST", body: JSON.stringify({ photo_url }) });
const answer = (items: unknown[]) => ({ content: [{ type: "text", text: JSON.stringify({ items }) }] });
const water = { title: "Вода", description_ru: "Бутылка.", description_kz: "Бөтелке.", category: "Напитки", box: [0.1, 0.1, 0.4, 0.9], price: 300 };
const juice = { title: "Сок", description_ru: "Пакет.", description_kz: "Қорап.", category: "Напитки", box: [0.5, 0.1, 0.9, 0.9], price: null };

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("AI_PROVIDERS", "anthropic");
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test");
  mocks.user = { id: "owner" };
  const jpeg = await sharp({ create: { width: 400, height: 300, channels: 3, background: { r: 30, g: 90, b: 160 } } }).jpeg().toBuffer();
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(jpeg)], { type: "image/jpeg" }) });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.removeFiles.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: "reservation", error: null });
  mocks.create.mockResolvedValue(answer([water, juice]));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("без входа — 401, без ключа ИИ — 503, ничего не тратит", async () => {
  mocks.user = null;
  expect((await POST(request())).status).toBe(401);
  mocks.user = { id: "owner" };
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  expect((await POST(request())).status).toBe(503);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each(["https://evil.test/a.jpg", url.replace("owner", "other"), 123])("отклоняет чужое фото %s", async (value) => {
  expect((await POST(request(value))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("одна попытка ИИ на всё фото, вырезки и миниатюры в папке продавца", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  const json = await response.json();
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
  expect(json.items).toHaveLength(2);
  expect(json.items[0]).toMatchObject({ title: "Вода", price_hint: 300, bbox: { x1: 0.1, y1: 0.1, x2: 0.4, y2: 0.9 } });
  expect(json.items[0].photo_url).toMatch(/^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/product-photos\/owner\/[0-9a-f-]+\.jpg$/);
  const paths = mocks.upload.mock.calls.map((call) => call[0] as string);
  expect(paths).toHaveLength(4);
  expect(paths.every((p) => p.startsWith("owner/"))).toBe(true);
  expect(paths.filter((p) => p.endsWith("_s.jpg"))).toHaveLength(2);
});

it("не загрузилась вырезка — товар остаётся без своего фото", async () => {
  mocks.upload.mockResolvedValueOnce({ error: { message: "quota" } });
  const json = await (await POST(request())).json();
  expect(json.items.filter((i: { photo_url: string | null }) => i.photo_url === null)).toHaveLength(1);
});

it("ИИ не нашёл товаров — 422 и попытка возвращается", async () => {
  mocks.create.mockResolvedValue(answer([]));
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(mocks.release).toHaveBeenCalledWith("id", "reservation");
  expect(mocks.upload).not.toHaveBeenCalled();
});

it("ИИ упал — 502 и попытка возвращается", async () => {
  mocks.create.mockRejectedValue(new Error("offline"));
  expect((await POST(request())).status).toBe(502);
  expect(mocks.release).toHaveBeenCalled();
});

it("личный лимит исчерпан — 429 без обращения к ИИ", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "ai limit exceeded" } });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect((await response.json()).error).toContain("Добавьте товары вручную");
  expect(mocks.create).not.toHaveBeenCalled();
});
