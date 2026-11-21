import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInquiryNotification, buildOrderNotification, sendTelegram, type OrderForMessage } from "@/lib/telegram";

/** Вызывается базой (pg_net): после создания заказа (в теле id заказа) и после обращения «Узнать цену» (id магазина и товара). */
export async function POST(request: Request) {
  const expected = process.env.TELEGRAM_NOTIFY_SECRET;
  const given = request.headers.get("x-notify-secret") ?? "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { order_id?: string; inquiry?: { shop_id?: string; product_id?: string } } | null;
  const uuid = /^[0-9a-f-]{36}$/i;
  const admin = createAdminClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dukenai.vercel.app";

  if (body?.inquiry) {
    const { shop_id: shopId, product_id: productId } = body.inquiry;
    if (!shopId || !productId || !uuid.test(shopId) || !uuid.test(productId)) return NextResponse.json({ error: "bad request" }, { status: 400 });
    const [{ data: shop }, { data: product }, { data: link }] = await Promise.all([
      admin.from("shops").select("name").eq("id", shopId).maybeSingle(),
      admin.from("products").select("title,price,price_mode").eq("id", productId).eq("shop_id", shopId).maybeSingle(),
      admin.from("shop_telegram").select("chat_id").eq("shop_id", shopId).maybeSingle(),
    ]);
    if (!shop || !product || !link?.chat_id) return NextResponse.json({ ok: true, skipped: "nothing to notify" });
    const { text, buttons } = buildInquiryNotification(product, shop.name, site);
    return NextResponse.json({ ok: await sendTelegram(link.chat_id, text, buttons) });
  }

  const orderId = body?.order_id;
  if (!orderId || !uuid.test(orderId)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: true, skipped: "order not found" });

  const [{ data: shop }, { data: link }] = await Promise.all([
    admin.from("shops").select("name").eq("id", order.shop_id).maybeSingle(),
    admin.from("shop_telegram").select("chat_id").eq("shop_id", order.shop_id).maybeSingle(),
  ]);
  if (!shop || !link?.chat_id) return NextResponse.json({ ok: true, skipped: "no telegram link" });

  const { text, buttons, actions } = buildOrderNotification(order as unknown as OrderForMessage, shop.name, site);
  const sent = await sendTelegram(link.chat_id, text, buttons, actions);
  return NextResponse.json({ ok: sent });
}
