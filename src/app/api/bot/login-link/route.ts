import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { botLoginSecret, createLoginLink } from "@/lib/bot/login";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ссылка входа в кабинет для внешнего бота (docs/BOT_CONTRACT.md, раздел 3). Встроенный бот SÖRE вызывает
 * createLoginLink напрямую. Тело: { chat_id }. Ссылку не логируем: это ключ к магазину на 5 минут.
 */
const STATUS = { disabled: 503, "not-linked": 404, "no-email": 409, "rate-limited": 429, unavailable: 503 } as const;

export async function POST(request: Request) {
  const expected = botLoginSecret();
  const given = request.headers.get("x-bot-secret") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { chat_id?: unknown } | null;
  const chatId = body?.chat_id;
  if (typeof chatId !== "number" || !Number.isSafeInteger(chatId)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const link = await createLoginLink(createAdminClient(), chatId);
  if (!link.ok) return NextResponse.json({ error: link.reason }, { status: STATUS[link.reason] });
  return NextResponse.json({ url: link.url }, { headers: { "Cache-Control": "no-store" } });
}
