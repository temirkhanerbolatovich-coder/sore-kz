import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("health: база отвечает — 200 ok", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: "ok", db: true });
});

test("health: база недоступна — 503 degraded без деталей ошибки", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("secret-host refused"); }));
  const response = await GET();
  expect(response.status).toBe(503);
  const text = JSON.stringify(await response.json());
  expect(text).toContain("degraded");
  expect(text).not.toContain("secret-host");
});

test("health: без адреса базы — 503", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const response = await GET();
  expect(response.status).toBe(503);
});
