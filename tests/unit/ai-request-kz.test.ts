import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn() }));

import { reserveAi } from "@/lib/ai-request";

// Минимальный клиент продавца: срок Pro и счётчик генераций.
const shopClient = {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {} }), gte: async () => ({ count: 0 }) }) }) }),
} as never;

beforeEach(() => mocks.rpc.mockReset());

describe("ошибки квоты ИИ по языкам", () => {
  it("личный лимит: по-русски и по-казахски", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "ai limit exceeded" } });
    const ru = await reserveAi(shopClient, "shop", "заполните карточку вручную");
    const kz = await reserveAi(shopClient, "shop", "карточканы қолмен толтырыңыз", "kz");
    expect(ru.ok === false && ru.error).toContain("Лимит ИИ на сегодня исчерпан");
    expect(kz.ok === false && kz.error).toMatch(/^Бүгінгі ЖИ шегі таусылды \(\d+\)\. Карточканы қолмен толтырыңыз немесе ертең/);
  });

  it("общий потолок: 503 на казахском", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "ai global limit exceeded" } });
    const kz = await reserveAi(shopClient, "shop", "тауарларды қолмен қосыңыз", "kz");
    expect(kz.ok === false && kz.status).toBe(503);
    expect(kz.ok === false && kz.error).toContain("шамадан тыс жүктелген");
  });
});
