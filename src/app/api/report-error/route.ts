import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitoring";
import { checkReportQuota } from "@/lib/rate-limit";
import { readReportBody } from "@/lib/report-body";

/** Сюда страницы ошибок присылают сбои, случившиеся в браузере пользователя. */
export async function POST(request: Request) {
  const parsed = await readReportBody(request);
  if (parsed.status !== 200) return NextResponse.json({ ok: false }, { status: parsed.status });
  const body = parsed.data as { message?: unknown; digest?: unknown; path?: unknown } | null;
  if (!body || typeof body.message !== "string") return NextResponse.json({ ok: false }, { status: 400 });
  const quota = await checkReportQuota(request);
  if (quota !== 200) return NextResponse.json({ ok: false }, { status: quota });
  const context = [typeof body.path === "string" ? body.path.slice(0, 120) : "", typeof body.digest === "string" ? `digest ${body.digest.slice(0, 40)}` : ""]
    .filter(Boolean)
    .join(" · ");
  await reportError("client", body.message.slice(0, 300), context);
  return NextResponse.json({ ok: true });
}
