/**
 * Воронка продавцов: сколько магазинов дошло до каждого шага. Без отдельных событий: всё считается по базе.
 *
 *   npm run funnel                      локальная база
 *   npm run funnel -- --allow-remote    облачная база (ключ service_role берётся из окружения)
 *   npm run funnel -- --allow-remote --list   ещё и построчно по магазинам (адреса, без имён и телефонов)
 *
 * Шаги: магазин создан → есть товар → есть 5 и больше товаров → есть просмотры → есть обращения («Заказать» или
 * «Узнать цену») → есть заказ. Демо-магазины (адреса demo и demo-*) не считаются.
 * Окружение: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const PAGE = 1000;

async function allRows<T>(admin: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

const isDemo = (slug: string) => slug === "demo" || slug.startsWith("demo-");
const pct = (n: number, base: number) => (base ? `${Math.round((n / base) * 100)}%` : "—");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  const local = /^http:\/\/(localhost|127\.0\.0\.1):/.test(url);
  if (!local && !process.argv.includes("--allow-remote")) throw new Error("База не локальная. Для облака добавьте --allow-remote осознанно.");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const shops = (await allRows<{ id: string; slug: string; created_at: string }>(admin, "shops", "id,slug,created_at")).filter((s) => !isDemo(s.slug));
  const products = await allRows<{ shop_id: string; created_at: string }>(admin, "products", "shop_id,created_at");
  const events = await allRows<{ shop_id: string; type: string }>(admin, "events", "shop_id,type");
  const orders = await allRows<{ shop_id: string }>(admin, "orders", "shop_id");

  const productsBy = new Map<string, { count: number; first: number }>();
  for (const p of products) {
    const cur = productsBy.get(p.shop_id) ?? { count: 0, first: Infinity };
    cur.count += 1;
    cur.first = Math.min(cur.first, Date.parse(p.created_at));
    productsBy.set(p.shop_id, cur);
  }
  const countBy = (rows: { shop_id: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.shop_id, (m.get(r.shop_id) ?? 0) + 1);
    return m;
  };
  const views = countBy(events.filter((e) => e.type === "view"));
  const clicks = countBy(events.filter((e) => e.type === "order_click"));
  const ordersBy = countBy(orders);

  const steps = [
    { name: "Магазин создан", ok: () => true },
    { name: "Есть хотя бы 1 товар", ok: (id: string) => (productsBy.get(id)?.count ?? 0) >= 1 },
    { name: "Есть 5 и больше товаров", ok: (id: string) => (productsBy.get(id)?.count ?? 0) >= 5 },
    { name: "Есть просмотры витрины", ok: (id: string) => (views.get(id) ?? 0) >= 1 },
    { name: "Есть обращения («Заказать», «Узнать цену»)", ok: (id: string) => (clicks.get(id) ?? 0) >= 1 || (ordersBy.get(id) ?? 0) >= 1 },
    { name: "Есть настоящий заказ", ok: (id: string) => (ordersBy.get(id) ?? 0) >= 1 },
  ];

  console.log(`Воронка продавцов (без демо-магазинов), магазинов: ${shops.length}\n`);
  // Воронка вложенная: на каждом шаге остаются только магазины, прошедшие все прежние шаги.
  let left = shops;
  let prev = shops.length;
  for (const step of steps) {
    left = left.filter((s) => step.ok(s.id));
    const n = left.length;
    console.log(`${step.name.padEnd(46)} ${String(n).padStart(4)}   от всех: ${pct(n, shops.length).padStart(4)}   от прошлого шага: ${pct(n, prev).padStart(4)}`);
    prev = n;
  }

  // Время от создания магазина до первого товара: показывает, насколько быстро продавец получает ценность.
  const minutes = shops
    .map((s) => ((productsBy.get(s.id)?.first ?? Infinity) - Date.parse(s.created_at)) / 60_000)
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);
  if (minutes.length) console.log(`\nОт создания магазина до первого товара: медиана ${Math.round(minutes[Math.floor(minutes.length / 2)])} мин, быстрее всех ${Math.round(minutes[0])} мин.`);

  if (process.argv.includes("--list")) {
    console.log("\nПо магазинам (адрес: товаров / просмотров / обращений / заказов):");
    for (const s of shops) console.log(`  ${s.slug}: ${productsBy.get(s.id)?.count ?? 0} / ${views.get(s.id) ?? 0} / ${clicks.get(s.id) ?? 0} / ${ordersBy.get(s.id) ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
