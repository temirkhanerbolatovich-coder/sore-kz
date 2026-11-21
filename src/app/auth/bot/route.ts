import { NextResponse, type NextRequest } from "next/server";
import { botLoginSecret, consumeNonce } from "@/lib/bot/login";
import { verifyLoginToken } from "@/lib/bot/login-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * Вход из бота: подпись и срок токена → гасим nonce (повтор отклоняется) → magic link Supabase без письма:
 * generateLink даёт hashed_token, verifyOtp на сервере ставит куки сессии. Токен не логируется.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const fail = () => NextResponse.redirect(`${origin}/login?error=bot-link`, { headers: HEADERS });

  const secret = botLoginSecret();
  const claims = secret ? verifyLoginToken(searchParams.get("t"), secret) : null;
  if (!claims) return fail();

  const admin = createAdminClient();
  if (!(await consumeNonce(admin, claims.nonce))) return fail();

  const { data: owner } = await admin.auth.admin.getUserById(claims.owner);
  const email = owner?.user?.email;
  if (!email) return fail();
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const hashed = link?.properties?.hashed_token;
  if (error || !hashed) return fail();

  const supabase = await createClient();
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: hashed, type: "magiclink" });
  if (otpError) return fail();
  return NextResponse.redirect(`${origin}/dashboard`, { headers: HEADERS });
}
