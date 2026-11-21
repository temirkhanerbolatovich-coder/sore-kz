import type { Database } from "@/lib/database.types";

type PublicRpc = Pick<Database["public"]["Functions"], "create_order" | "record_inquiry" | "record_view">;
type RpcError = { message: string; code?: string };

/** Call a buyer-facing PostgREST function with the anonymous role. */
export async function publicRpc<Name extends keyof PublicRpc>(
  name: Name,
  args: PublicRpc[Name]["Args"],
  keepalive = false,
): Promise<{ data: PublicRpc[Name]["Returns"] | null; error: RpcError | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { data: null, error: { message: "Supabase is not configured" } };

  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    credentials: "omit",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    keepalive,
  });
  const body = await response.json().catch(() => null);
  if (response.ok) return { data: body, error: null };
  return {
    data: null,
    error: {
      message: typeof body?.message === "string" ? body.message : `PostgREST HTTP ${response.status}`,
      code: typeof body?.code === "string" ? body.code : undefined,
    },
  };
}

/** Supabase SSR stores the session under a project-specific name, with numbered chunks when large. */
export function hasSellerSession(cookie: string, base = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (!base || !URL.canParse(base)) return false;
  const project = new URL(base).hostname.split(".")[0];
  const authCookie = `sb-${project}-auth-token`;
  return cookie.split(";").some((entry) => {
    const name = entry.split("=", 1)[0].trim();
    return name === authCookie || (name.startsWith(`${authCookie}.`) && /^\d+$/.test(name.slice(authCookie.length + 1)));
  });
}
