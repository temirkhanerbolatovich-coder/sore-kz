import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

/**
 * Ручное управление тарифом Pro (2 500 ₸/мес): после перевода от клиента владелец продлевает срок.
 *
 *   npm run plan -- <адрес-магазина> [дней=30] [--allow-remote]   продлить Pro (от конца текущего срока, если он ещё идёт)
 *   npm run plan -- <адрес-магазина> --off [--allow-remote]        вернуть Free сразу
 *   npm run plan -- --list [--allow-remote]                        все магазины с действующим Pro
 *
 * Для облака нужны HTTPS и флаг --allow-remote; ключ службы берётся из окружения и в репозиторий не попадает.
 */
const DAY_MS = 86_400_000;
const fmt = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Almaty" });

async function main() {
  loadEnvConfig(process.cwd());
  const args = process.argv.slice(2).filter((a) => a !== "--allow-remote");
  const flag = (name: string) => args.includes(name);
  const positional = args.filter((a) => !a.startsWith("--"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !URL.canParse(url) || !key) {
    console.error("Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
    process.exitCode = 1;
    return;
  }
  const base = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (!local && (!process.argv.includes("--allow-remote") || base.protocol !== "https:")) {
    console.error("Для облака необходимы HTTPS и явный флаг --allow-remote.");
    process.exitCode = 1;
    return;
  }
  const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  if (flag("--list")) {
    const { data, error } = await admin.from("shops").select("slug,name,pro_until").gt("pro_until", new Date().toISOString()).order("pro_until");
    if (error) throw error;
    if (!data?.length) console.log("Действующего Pro нет.");
    for (const s of data ?? []) console.log(`${s.slug}  «${s.name}»  до ${fmt.format(new Date(s.pro_until!))}`);
    return;
  }

  const slug = positional[0]?.toLowerCase();
  if (!slug) {
    console.error("Укажите адрес магазина: npm run plan -- <адрес> [дней] или --list.");
    process.exitCode = 1;
    return;
  }
  const { data: shop, error: findError } = await admin.from("shops").select("id,name,pro_until").eq("slug", slug).maybeSingle();
  if (findError) throw findError;
  if (!shop) {
    console.error(`Магазин «${slug}» не найден.`);
    process.exitCode = 1;
    return;
  }

  if (flag("--off")) {
    const { error } = await admin.from("shops").update({ pro_until: null }).eq("id", shop.id);
    if (error) throw error;
    console.log(`«${shop.name}» (${slug}): Pro выключен, действует Free.`);
    return;
  }

  const days = positional[1] ? Number(positional[1]) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    console.error("Число дней: целое от 1 до 366.");
    process.exitCode = 1;
    return;
  }
  const current = shop.pro_until ? new Date(shop.pro_until).getTime() : 0;
  const from = Math.max(Date.now(), current);
  const until = new Date(from + days * DAY_MS);
  const { error } = await admin.from("shops").update({ pro_until: until.toISOString() }).eq("id", shop.id);
  if (error) throw error;
  console.log(`«${shop.name}» (${slug}): Pro до ${fmt.format(until)} (+${days} дн.).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
