import { NextResponse } from "next/server";

/**
 * Проверка живости для мониторинга (UptimeRobot и т. п.): сайт отвечает и база достижима.
 * Деталей наружу не отдаём: только ok / degraded и время ответа базы.
 */
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3000;

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const started = Date.now();
  let db = false;
  if (base) {
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}/auth/v1/health`, {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
        signal: AbortSignal.timeout(DB_TIMEOUT_MS),
        cache: "no-store",
      });
      db = response.ok;
    } catch {
      db = false;
    }
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", db, ms: Date.now() - started },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
