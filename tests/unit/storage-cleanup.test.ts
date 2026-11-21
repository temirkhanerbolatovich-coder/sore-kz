import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { removeOrphanPhotos } from "@/lib/storage-cleanup";

/** Уборка осиротевших фото (#30): пачки, сбои удаления, секрет Vercel Cron. Поиск сирот проверяет supabase/tests/storage_cleanup.sql. */

type Fake = { orphans: string[]; failOn: Set<string>; removed: string[]; rpcError: string | null };
const fake: Fake = { orphans: [], failOn: new Set(), removed: [], rpcError: null };

function client() {
  return {
    rpc: async (_name: string, args: { p_limit: number }) =>
      fake.rpcError ? { data: null, error: { message: fake.rpcError } } : { data: fake.orphans.slice(0, args.p_limit).map((name) => ({ name })), error: null },
    storage: {
      from: () => ({
        remove: async (names: string[]) => {
          if (names.some((n) => fake.failOn.has(n))) return { data: null, error: { message: "boom" } };
          fake.removed.push(...names);
          fake.orphans = fake.orphans.filter((n) => !names.includes(n));
          return { data: [], error: null };
        },
      }),
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => client() }));

const files = (n: number, prefix = "u/f") => Array.from({ length: n }, (_, i) => `${prefix}${i}.jpg`);

beforeEach(() => {
  Object.assign(fake, { orphans: [], failOn: new Set(), removed: [], rpcError: null });
});

describe("removeOrphanPhotos", () => {
  it("удаляет всех сирот пачками по 100 и за несколько проходов", async () => {
    fake.orphans = files(2350);
    const result = await removeOrphanPhotos(client() as never);
    expect(result).toEqual({ removed: 2350, failed: 0, complete: true });
    expect(fake.orphans).toEqual([]);
  });

  it("сбой удаления одной пачки не останавливает уборку и не зацикливает её", async () => {
    fake.orphans = files(250);
    fake.failOn.add("u/f120.jpg");
    const result = await removeOrphanPhotos(client() as never);
    expect(result).toEqual({ removed: 150, failed: 100, complete: true });
    expect(fake.removed).not.toContain("u/f120.jpg");
  });

  it("останавливается по времени и сообщает, что убрано не всё", async () => {
    fake.orphans = files(500);
    const result = await removeOrphanPhotos(client() as never, { deadline: Date.now() - 1 });
    expect(result).toEqual({ removed: 100, failed: 0, complete: false });
  });

  it("ошибка поиска пробрасывается, ничего не удаляется", async () => {
    fake.rpcError = "db down";
    await expect(removeOrphanPhotos(client() as never)).rejects.toThrow("storage_orphan_photos: db down");
    expect(fake.removed).toEqual([]);
  });
});

describe("GET /api/cron/storage-cleanup", () => {
  let GET: (r: Request) => Promise<Response>;
  beforeAll(async () => {
    process.env.CRON_SECRET = "unit-cron-secret-0123456789";
    ({ GET } = await import("@/app/api/cron/storage-cleanup/route"));
  });
  const call = (auth?: string) => GET(new Request("https://sore.example/api/cron/storage-cleanup", { headers: auth ? { authorization: auth } : {} }));

  it("без секрета Vercel Cron закрыт и ничего не удаляет", async () => {
    fake.orphans = files(3);
    expect((await call()).status).toBe(403);
    expect((await call("Bearer wrong")).status).toBe(403);
    expect(fake.removed).toEqual([]);
  });

  it("с секретом убирает сирот и отдаёт итог", async () => {
    fake.orphans = files(3);
    const res = await call("Bearer unit-cron-secret-0123456789");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: 3, failed: 0, complete: true });
  });
});
