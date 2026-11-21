import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createAdminClient } from "@/lib/supabase/admin";

export function hashedRateKey(prefix: string, value: string): string {
  return `${prefix}:${createHash("sha256").update(value).digest("hex")}`;
}

/** Database-backed quota shared by all application instances. */
export async function checkRateLimit(key: string, seconds: number, limit: number): Promise<200 | 429 | 503> {
  try {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", { p_key: key, p_seconds: seconds, p_limit: limit });
    if (!error && typeof data === "boolean") return data ? 200 : 429;
  } catch {
    // Missing configuration and transport failures also block forwarding.
  }
  console.error("Database rate limiter unavailable.");
  return 503;
}

export function checkReportQuota(request: Request): Promise<200 | 429 | 503> {
  const first = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim() ?? "";
  // A missing or malformed address shares one bucket instead of creating arbitrary buckets.
  return checkRateLimit(hashedRateKey("error-reports", isIP(first) ? first : "unknown"), 60, 5);
}
