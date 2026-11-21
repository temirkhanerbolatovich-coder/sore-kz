import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Webhook бота целиком: секрет, повторная доставка, команды, кнопки.
 * Telegram подменён локальным HTTP-сервером, база подменена записью вызовов (без Supabase и сети).
 */

const ORDER = "6f1c2c1e-1b7a-4c55-9d1e-2a3b4c5d6e7f";
type Op = [string, ...unknown[]];
const db = { linkedChat: null as number | null, seen: new Set<number>(), writes: [] as { table: string; ops: Op[] }[] };

function resolve(table: string, ops: Op[]): unknown {
  const has = (name: string) => ops.some((o) => o[0] === name);
  const eq = (col: string) => ops.find((o) => o[0] === "eq" && o[1] === col)?.[2];
  if (has("update") || has("upsert") || has("insert") || has("delete")) db.writes.push({ table, ops });
  if (table === "bot_updates") {
    const id = (ops.find((o) => o[0] === "upsert")?.[1] as { update_id: number }).update_id;
    if (db.seen.has(id)) return { data: [], error: null };
    db.seen.add(id);
    return { data: [{ update_id: id }], error: null };
  }
  if (table === "shop_telegram") {
    if (has("update")) {
      const values = ops.find((o) => o[0] === "update")?.[1] as { chat_id: number | null };
      db.linkedChat = values.chat_id;
      return { data: null, error: null };
    }
    if (eq("link_code") !== undefined) return { data: eq("link_code") === "good-code-123" ? { shop_id: "s1" } : null, error: null };
    return { data: eq("chat_id") === db.linkedChat && db.linkedChat !== null ? { shop_id: "s1" } : null, error: null };
  }
  if (table === "shops") return { data: { id: "s1", slug: "sweet", name: "Сладкий <дом>", owner_id: "u1" }, error: null };
  if (table === "orders") {
    if (has("update")) return { data: eq("shop_id") === "s1" && eq("id") === ORDER ? { number: 7 } : null, error: null };
    return {
      data: [{ id: ORDER, number: 7, created_at: "2026-11-16T09:30:00Z", customer_name: "Ая", total: 9000, status: "new", items: [{ title: "Торт", qty: 1 }] }],
      error: null,
    };
  }
  return { data: null, error: null };
}

function builder(table: string) {
  const ops: Op[] = [];
  const b: object = new Proxy({}, {
    get(_, prop: string) {
      if (prop === "then") {
        const result = resolve(table, ops);
        return (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
      }
      if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve(resolve(table, ops));
      return (...args: unknown[]) => {
        ops.push([prop, ...args]);
        return b;
      };
    },
  });
  return b;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: builder,
    rpc: async () => ({ data: true, error: null }),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, email: "owner@example.test" } }, error: null }) } },
  }),
}));

const calls: { method: string; body: Record<string, unknown> }[] = [];
const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const method = req.url!.split("/").pop()!;
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(raw);
    } catch {
      body = { multipart: true };
    }
    calls.push({ method, body });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, result: method === "answerCallbackQuery" ? true : { message_id: calls.length, date: 0, chat: { id: 555, type: "private" } } }));
  });
});

const SECRET = "unit-webhook-secret";
let POST: (r: Request) => Promise<Response>;
const send = (update: object, secret = SECRET) =>
  POST(new Request("http://localhost/api/telegram/webhook", { method: "POST", headers: { "x-telegram-bot-api-secret-token": secret, "content-type": "application/json" }, body: JSON.stringify(update) }));
const msg = (text: string, type = "private") => ({ message: { text, chat: { id: 555, type } } });
const texts = () => calls.filter((c) => c.method === "sendMessage").map((c) => String(c.body.text));

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  Object.assign(process.env, {
    TELEGRAM_BOT_TOKEN: "123456:unit-token",
    TELEGRAM_BOT_USERNAME: "sore_unit_bot",
    TELEGRAM_WEBHOOK_SECRET: SECRET,
    TELEGRAM_API_BASE: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    NEXT_PUBLIC_SITE_URL: "https://sore.example",
    BOT_LOGIN_SECRET: "unit-bot-login-secret-0123456789abcdef",
  });
  ({ POST } = await import("@/app/api/telegram/webhook/route"));
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  calls.length = 0;
  db.writes.length = 0;
});

describe("webhook бота SÖRE", () => {
  it("без секрета 403, Telegram не вызывается", async () => {
    expect((await send(msg("/help"), "wrong-secret-value")).status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("/start КОД без update_id и entities привязывает чат", async () => {
    expect((await send(msg("/start good-code-123"))).status).toBe(200);
    expect(db.linkedChat).toBe(555);
    expect(texts().at(-1)).toContain("Сладкий &lt;дом&gt;» подключён к SÖRE");
  });

  it("неверный код не привязывает", async () => {
    db.linkedChat = null;
    await send(msg("/start bad-code-999"));
    expect(db.linkedChat).toBeNull();
    expect(texts().at(-1)).toContain("Код не подошёл");
  });

  it("повторная доставка того же update_id не обрабатывается", async () => {
    await send({ update_id: 42, ...msg("/help") });
    await send({ update_id: 42, ...msg("/help") });
    expect(texts()).toHaveLength(1);
  });

  it("без привязки команды магазина подсказывают подключиться", async () => {
    db.linkedChat = null;
    await send(msg("/orders"));
    expect(texts().at(-1)).toContain("не подключён к магазину");
  });

  it("/orders показывает заказ и кнопки статуса, кнопка меняет статус только в своём магазине", async () => {
    db.linkedChat = 555;
    await send(msg("/orders"));
    const list = calls.find((c) => c.method === "sendMessage")!;
    expect(String(list.body.text)).toContain("<b>№7</b>");
    const kb = (list.body.reply_markup as { inline_keyboard: { callback_data: string }[][] }).inline_keyboard;
    expect(kb[0].map((b) => b.callback_data)).toEqual([`o:${ORDER}:done`, `o:${ORDER}:cancelled`]);

    await send({
      callback_query: { id: "cb1", data: `o:${ORDER}:done`, chat_instance: "x", from: { id: 555, is_bot: false, first_name: "A" }, message: { message_id: 1, date: 0, chat: { id: 555, type: "private" } } },
    });
    const update = db.writes.find((w) => w.table === "orders");
    expect(update?.ops).toContainEqual(["update", { status: "done" }]);
    expect(update?.ops).toContainEqual(["eq", "shop_id", "s1"]);
    expect(calls.find((c) => c.method === "answerCallbackQuery")?.body.text).toBe("Заказ №7 выполнен ✅");
  });

  it("/start без кода присылает логотип с приветствием", async () => {
    await send(msg("/start"));
    expect(calls[0].method).toBe("sendPhoto");
  });

  it("/login присылает одноразовую ссылку входа, /shop даёт кнопку входа", async () => {
    db.linkedChat = 555;
    await send(msg("/login"));
    const login = calls.find((c) => c.method === "sendMessage")!;
    const button = (login.body.reply_markup as { inline_keyboard: { url: string }[][] }).inline_keyboard[0][0];
    expect(button.url).toMatch(/^https:\/\/sore\.example\/auth\/bot\?t=[\w-]+\.[\w-]+$/);
    calls.length = 0;
    await send(msg("/shop"));
    const shop = calls.find((c) => c.method === "sendPhoto");
    expect(shop).toBeDefined();
  });

  it("/login без привязки не даёт ссылку", async () => {
    db.linkedChat = null;
    await send(msg("/login"));
    expect(texts().at(-1)).toContain("не подключён к магазину");
  });

  it("/shop присылает QR-код фото", async () => {
    db.linkedChat = 555;
    await send(msg("/shop"));
    expect(calls.map((c) => c.method)).toContain("sendPhoto");
  });

  it("группы и каналы игнорируются, /stop отвязывает", async () => {
    await send(msg("/help", "group"));
    expect(calls).toHaveLength(0);
    db.linkedChat = 555;
    await send(msg("/stop"));
    expect(db.linkedChat).toBeNull();
    expect(texts().at(-1)).toContain("отключены");
  });
});
