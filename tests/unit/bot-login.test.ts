import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { newNonce, signLoginToken, verifyLoginToken } from "@/lib/bot/login-token";

/**
 * Вход в кабинет из бота (задача #19): подпись токена, одноразовость, срок, маршруты.
 * База и Supabase Auth подменены: проверяем логику маршрутов, а не сеть.
 */

const SECRET = "unit-bot-login-secret-0123456789abcdef";
const OWNER = "a0000000-0000-4000-8000-000000000001";
const now = () => Math.floor(Date.now() / 1000);

const state = {
  linkedChat: 555 as number | null,
  email: "owner@example.test" as string | null,
  used: new Set<string>(),
  rate: true,
  verifyOtp: vi.fn(async () => ({ error: null as null | { message: string } })),
};

function from(table: string) {
  const ops: [string, ...unknown[]][] = [];
  const result = () => {
    if (table === "bot_login_nonces") {
      const nonce = (ops.find((o) => o[0] === "insert")?.[1] as { nonce: string }).nonce;
      if (state.used.has(nonce)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      state.used.add(nonce);
      return { data: null, error: null };
    }
    if (table === "shop_telegram") {
      const chat = ops.find((o) => o[0] === "eq" && o[1] === "chat_id")?.[2];
      return { data: chat === state.linkedChat ? { shop_id: "s1" } : null, error: null };
    }
    if (table === "shops") return { data: { id: "s1", slug: "sweet", name: "Sweet", owner_id: OWNER }, error: null };
    return { data: null, error: null };
  };
  const b: object = new Proxy({}, {
    get(_, prop: string) {
      if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(result()).then(ok);
      if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve(result());
      return (...args: unknown[]) => (ops.push([prop, ...args]), b);
    },
  });
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from,
    rpc: async () => ({ data: state.rate, error: null }),
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: id === OWNER ? { id, email: state.email } : null }, error: null }),
        generateLink: async () => ({ data: { properties: { hashed_token: "hashed-token" } }, error: null }),
      },
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp: state.verifyOtp } }) }));

let GET: (r: never) => Promise<Response>;
let POST: (r: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.BOT_LOGIN_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SITE_URL = "https://sore.example";
  ({ GET } = (await import("@/app/auth/bot/route")) as unknown as { GET: typeof GET });
  ({ POST } = await import("@/app/api/bot/login-link/route"));
});
beforeEach(() => {
  state.linkedChat = 555;
  state.email = "owner@example.test";
  state.rate = true;
  state.verifyOtp.mockClear();
});

const open = (token: string) => GET(new Request(`https://sore.example/auth/bot?t=${encodeURIComponent(token)}`) as never);
const where = (res: Response) => new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search;
const ask = (body: unknown, secret = SECRET) =>
  POST(new Request("https://sore.example/api/bot/login-link", { method: "POST", headers: { "x-bot-secret": secret, "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("токен входа", () => {
  it("подписанный токен проверяется, чужая подпись, правка и срок отклоняются", () => {
    const claims = { owner: OWNER, exp: now() + 300, nonce: newNonce() };
    const token = signLoginToken(claims, SECRET);
    expect(verifyLoginToken(token, SECRET)).toEqual(claims);
    expect(verifyLoginToken(token, "another-secret-another-secret-123")).toBeNull();
    const [body, mac] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, owner: "b0000000-0000-4000-8000-000000000001" })).toString("base64url");
    expect(verifyLoginToken(`${forged}.${mac}`, SECRET)).toBeNull();
    expect(verifyLoginToken(`${body}.${mac}.x`, SECRET)).toBeNull();
    expect(verifyLoginToken(signLoginToken({ ...claims, exp: now() - 1 }, SECRET), SECRET)).toBeNull();
    expect(verifyLoginToken(signLoginToken({ ...claims, nonce: "short" }, SECRET), SECRET)).toBeNull();
    for (const bad of [undefined, "", "abc", "a.b", "x".repeat(600)]) expect(verifyLoginToken(bad, SECRET)).toBeNull();
  });
});

describe("GET /auth/bot", () => {
  it("ссылка открывает кабинет один раз, повтор отклоняется", async () => {
    const token = signLoginToken({ owner: OWNER, exp: now() + 300, nonce: newNonce() }, SECRET);
    const first = await open(token);
    expect(where(first)).toBe("/dashboard");
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(state.verifyOtp).toHaveBeenCalledWith({ token_hash: "hashed-token", type: "magiclink" });
    expect(where(await open(token))).toBe("/login?error=bot-link");
    expect(state.verifyOtp).toHaveBeenCalledTimes(1);
  });

  it("просроченный и поддельный токены не ставят сессию", async () => {
    expect(where(await open(signLoginToken({ owner: OWNER, exp: now() - 5, nonce: newNonce() }, SECRET)))).toBe("/login?error=bot-link");
    expect(where(await open(signLoginToken({ owner: OWNER, exp: now() + 300, nonce: newNonce() }, "wrong-secret-wrong-secret-0123456")))).toBe("/login?error=bot-link");
    expect(where(await open(""))).toBe("/login?error=bot-link");
    expect(state.verifyOtp).not.toHaveBeenCalled();
  });

  it("владелец без почты не входит", async () => {
    state.email = null;
    expect(where(await open(signLoginToken({ owner: OWNER, exp: now() + 300, nonce: newNonce() }, SECRET)))).toBe("/login?error=bot-link");
  });
});

describe("POST /api/bot/login-link", () => {
  it("без секрета 403, без chat_id 400", async () => {
    expect((await ask({ chat_id: 555 }, "wrong")).status).toBe(403);
    expect((await ask({ chat_id: "555" })).status).toBe(400);
  });

  it("отдаёт рабочую ссылку на 5 минут для привязанного чата", async () => {
    const res = await ask({ chat_id: 555 });
    expect(res.status).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url.startsWith("https://sore.example/auth/bot?t=")).toBe(true);
    const claims = verifyLoginToken(new URL(url).searchParams.get("t"), SECRET)!;
    expect(claims.owner).toBe(OWNER);
    expect(claims.exp - now()).toBeGreaterThan(290);
    expect(claims.exp - now()).toBeLessThanOrEqual(300);
  });

  it("чужой чат 404, без почты 409, лимит 429", async () => {
    expect((await ask({ chat_id: 777 })).status).toBe(404);
    state.email = null;
    expect((await ask({ chat_id: 555 })).status).toBe(409);
    state.rate = false;
    expect((await ask({ chat_id: 555 })).status).toBe(429);
  });
});
