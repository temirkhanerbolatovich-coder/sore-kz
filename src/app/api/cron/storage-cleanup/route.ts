import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { removeOrphanPhotos } from "@/lib/storage-cleanup";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ежедневная уборка осиротевших фото (vercel.json → crons). Vercel Cron присылает
 * `Authorization: Bearer <CRON_SECRET>`; без секрета маршрут закрыт.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await removeOrphanPhotos(createAdminClient(), { deadline: Date.now() + 50_000 });
    console.info("storage cleanup", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("storage cleanup failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "cleanup failed" }, { status: 500 });
  }
}
