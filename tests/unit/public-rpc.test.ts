import { afterEach, expect, it, vi } from "vitest";
import { hasSellerSession, publicRpc } from "@/lib/public-rpc";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("использует анонимную роль и сохраняет код и текст ошибки PostgREST", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321/");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  const fetchMock = vi.fn(async () => Response.json({ message: "rate limit exceeded", code: "P0001" }, { status: 400 }));
  vi.stubGlobal("fetch", fetchMock);
  const args = { p_shop: "shop", p_items: [{ id: "item", qty: 1 }], p_name: "Покупатель", p_phone: "77011111111", p_address: "", p_comment: "" };

  expect(await publicRpc("create_order", args)).toEqual({ data: null, error: { message: "rate limit exceeded", code: "P0001" } });
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:54321/rest/v1/rpc/create_order", {
    method: "POST",
    credentials: "omit",
    headers: { apikey: "test-anon-key", Authorization: "Bearer test-anon-key", "Content-Type": "application/json" },
    body: JSON.stringify(args),
    keepalive: false,
  });
});

it("распознаёт сессию текущего проекта и номерные части cookie", () => {
  const base = "http://127.0.0.1:54321";
  expect(hasSellerSession("other=1; sb-127-auth-token=opaque", base)).toBe(true);
  expect(hasSellerSession("sb-127-auth-token.1=opaque; other=1", base)).toBe(true);
  expect(hasSellerSession("sb-other-auth-token=opaque; sb-127-auth-token-code-verifier=opaque", base)).toBe(false);
});
