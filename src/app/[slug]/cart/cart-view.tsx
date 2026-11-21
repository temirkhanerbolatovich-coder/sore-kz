"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { publicRpc } from "@/lib/public-rpc";
import { lineKey, useCart, useHydrated, useShopLines, type StoredLine } from "@/lib/cart";
import { tFor, shopHref, type Lang } from "@/lib/lang";
import { DemoActionStub, DemoNotice, PausedNotice } from "@/components/demo-notice";
import { buildOrderText, formatPhoneInput, formatPrice, normalizePhone, orderTotal, whatsappUrl, type CartLine } from "@/lib/order";
import { ProductPhoto } from "@/components/product-photo";

import type { Product } from "@/lib/types";
import { Field } from "@/components/field";
import { BackLink } from "@/components/back-link";
import { BackIcon, CheckIcon, WhatsAppIcon } from "@/components/icons";
import { Toast } from "@/components/ui/toast";
import { TelegramContact } from "@/components/telegram-contact";

const MIN_ORDER_FORM_AGE_MS = 2000;
// После перехода в WhatsApp покупатель часто жмёт «Назад»: тогда показываем номер заказа, а не пустую корзину.
const LAST_ORDER_KEY = "sore-last-order";
const LAST_ORDER_TTL_MS = 6 * 3_600_000;
type LastOrder = { slug: string; number: number | null; statusHref: string; url: string; text: string; at: number };

function readLastOrder(slug: string): LastOrder | null {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null") as LastOrder | null;
    if (saved && saved.slug === slug && typeof saved.url === "string" && Date.now() - saved.at < LAST_ORDER_TTL_MS) return saved;
  } catch { /* Optional browser storage. */ }
  return null;
}

function forgetLastOrder() {
  try { localStorage.removeItem(LAST_ORDER_KEY); } catch { /* Optional browser storage. */ }
}

type ShopInfo = { id: string; slug: string; name: string; whatsapp: string; telegram: string | null; leadDays: number; acceptingOrders?: boolean; paymentInfo?: string | null; deliveryInfo?: string | null; booking?: boolean; demo?: boolean };

export function CartView({ shop, lang, products }: { shop: ShopInfo; lang: Lang; products: Product[] }) {
  const booking = Boolean(shop.booking);
  const t = tFor(lang, booking);
  const [notice, setNotice] = useState(false);
  const hydrated = useHydrated();
  const lines = useShopLines(shop.slug);
  const setQty = useCart((s) => s.setQty);
  const clear = useCart((s) => s.clear);
  const add = useCart((s) => s.add);

  // Возврат удалённого: убранные позиции держим 8 секунд и даём кнопку «Вернуть».
  const [removed, setRemoved] = useState<StoredLine[]>([]);
  function restore() {
    for (const line of removed) {
      add(shop.slug, { id: line.id, title: line.title, price: line.price, photo: line.photo, variantId: line.variantId ?? null, variantTitle: line.variantTitle ?? null });
      if (line.qty > 1) setQty(lineKey(line), line.qty);
    }
    setRemoved([]);
  }
  const undoToast = removed.length > 0 && (
    <Toast
      message={t.removed}
      closeLabel={t.close}
      duration={8000}
      bottomClassName="bottom-24 md:bottom-5"
      onClose={() => setRemoved([])}
      action={<button type="button" onClick={restore} className="min-h-11 px-2 font-bold underline">{t.undo}</button>}
    />
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [neededDate, setNeededDate] = useState("");
  const [neededTime, setNeededTime] = useState("");
  // Самая ранняя дата заказа по времени Астаны: сегодня + срок предзаказа магазина.
  const [minDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty" }).format(Date.now() + shop.leadDays * 86_400_000),
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; address?: string; date?: string }>({});
  const [sentUrl, setSentUrl] = useState("");
  const [sentText, setSentText] = useState("");
  const [sentNumber, setSentNumber] = useState<number | null>(null);
  const [statusHref, setStatusHref] = useState("");
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    if (hydrated) openedAt.current = performance.now();
  }, [hydrated, shop.slug]);

  useEffect(() => {
    // Hydration synchronizes the persisted browser cart and contact details with server data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice(useCart.getState().reconcile(shop.slug, products));
    try {
      const saved = JSON.parse(localStorage.getItem("sore-customer") || "{}");
      if (typeof saved.name === "string") setName(saved.name.slice(0,80));
      if (typeof saved.phone === "string") setPhone(saved.phone.slice(0,30));
    } catch { /* Optional browser storage. */ }
  }, [shop.slug, products]);

  useEffect(() => {
    if (!hydrated || useCart.getState().lines.length > 0) return;
    const last = readLastOrder(shop.slug);
    if (!last) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSentNumber(last.number);
    setStatusHref(last.statusHref);
    setSentText(last.text);
    setSentUrl(last.url);
  }, [hydrated, shop.slug]);

  const backHref = shopHref(`/${shop.slug}`, lang);
  const total = orderTotal(lines);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    // Демо-магазин: заказ не создаётся и никуда не уходит.
    if (shop.demo) return;

    const digits = normalizePhone(phone);
    // Свои сообщения у каждого поля: системные подсказки браузера перекрываются панелью «Итого» и не видны на телефоне.
    const phoneBad = !/^[0-9]{10,15}$/.test(digits);
    const errs = {
      name: name.trim() ? undefined : t.nameError,
      address: !booking && delivery === "delivery" && !address.trim() ? t.addressError : undefined,
      date: (booking || shop.leadDays > 0) && !neededDate ? t.dateRequired : neededDate && neededDate < minDate ? t.dateTooEarly : undefined,
    };
    setPhoneError(phoneBad ? t.phoneError : "");
    setFieldErrors(errs);
    const firstBad = errs.name ? "name" : phoneBad ? "phone" : errs.address ? "address" : errs.date ? "needed-date" : null;
    if (firstBad) {
      document.getElementById(firstBad)?.focus();
      return;
    }

    if (new FormData(e.currentTarget).get("website")) return setError(t.orderError);
    if (openedAt.current === null || performance.now() - openedAt.current < MIN_ORDER_FORM_AGE_MS) {
      return setError(t.orderTooSoon);
    }

    setSending(true);
    try {
    const { data, error: rpcError } = await publicRpc("create_order", {
      p_shop: shop.id,
      p_items: lines.map((l) => ({ id: l.id, qty: booking ? 1 : l.qty, variant: l.variantId ?? null })),
      p_name: name.trim(),
      p_phone: digits,
      p_address: booking ? "Запись" : delivery === "delivery" ? address.trim() : "Самовывоз",
      p_comment: comment.trim(),
      p_needed_date: neededDate || undefined,
      p_needed_time: neededTime || undefined,
    });

    const row = Array.isArray(data) ? data[0] : null;
    if (rpcError || !row) {
      setSending(false);
      const message = rpcError?.message || "";
      setError(message.includes("orders paused") ? t.paused : message.includes("rate limit") ? t.rateLimit : message.includes("unavailable") ? t.unavailable : message.includes("invalid phone") ? t.phoneError : message.includes("invalid items") || message.includes("quantity") ? t.invalidItems : message.includes("date too early") ? t.dateTooEarly : message.includes("date required") ? t.dateRequired : message.includes("total too large") ? t.tooLarge : t.orderError);
      return;
    }

    // Текст строим из данных сервера: там актуальные цены и названия.
    const serverLines: CartLine[] = (row.order_items as { id: string; title: string; price: number; qty: number }[]).map(
      (i) => ({ id: i.id, title: i.title, price: i.price, qty: i.qty }),
    );
    const statusPath = `/o/${row.order_code}${lang === "kz" ? "?lang=kz" : ""}`;
    const text = buildOrderText({
      number: row.order_number,
      statusUrl: `${window.location.origin}${statusPath}`,
      lines: serverLines,
      name: name.trim(),
      delivery,
      booking,
      address: address.trim(),
      comment: comment.trim() || undefined,
      neededDate: neededDate || null,
      neededTime: neededTime || null,
    });
    const url = whatsappUrl(shop.whatsapp, text);

    try { localStorage.setItem("sore-customer", JSON.stringify({ name: name.trim(), phone: digits })); } catch { /* Optional storage. */ }
    clear();
    try {
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ slug: shop.slug, number: Number(row.order_number) || null, statusHref: statusPath, url, text, at: Date.now() } satisfies LastOrder));
    } catch { /* Optional browser storage. */ }
    setSentNumber(Number(row.order_number));
    setStatusHref(statusPath);
    setSentText(text);
    setSentUrl(url);
    window.location.href = url;
    } catch { setError(t.orderError); } finally { setSending(false); }
  }

  if (!hydrated) return <div className="flex-1" />;

  if (sentUrl) {
    return (
      <main id="main-content" tabIndex={-1} lang={lang === "kz" ? "kk" : "ru"} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span aria-hidden="true" className="pop-in flex size-16 items-center justify-center rounded-full bg-ok-bg text-ok-ink">
          <CheckIcon size={32} />
        </span>
        <h1 className="text-2xl font-extrabold">
          {t.accepted}
          {sentNumber ? ` · №${sentNumber}` : ""}
        </h1>
        <p className="text-lead font-semibold">{t.nextStep}</p>
        <p className="leading-relaxed text-muted">
          {t.waHelp}
        </p>
        <section aria-label={t.whatNext} className="flex w-full flex-col gap-1.5 rounded-xl border border-line bg-surface p-3 text-left text-sm">
          <h2 className="font-bold">{t.whatNext}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            <li>{t.afterReply}</li>
            {(shop.paymentInfo || shop.deliveryInfo) && (
              <li>
                {t.afterTerms}
                {shop.paymentInfo && <span className="block whitespace-pre-line text-ink">{t.payment}: {shop.paymentInfo}</span>}
                {shop.deliveryInfo && <span className="block whitespace-pre-line text-ink">{t.deliveryTerms}: {shop.deliveryInfo}</span>}
              </li>
            )}
            {statusHref && <li>{t.afterTrack}</li>}
          </ul>
        </section>
        <a href={sentUrl} className="btn-wa h-14 w-full text-lg">
          <WhatsAppIcon />
          {t.openWa}
        </a>
        {shop.telegram && <TelegramContact username={shop.telegram} text={sentText} label={t.writeTelegram} copiedLabel={t.tgCopied} />}
        {statusHref && (
          <Link href={statusHref} className="btn-outline h-12 w-full">
            {t.trackOrder}
          </Link>
        )}
        <Link href={backHref} onClick={forgetLastOrder} className="btn-outline h-12 w-full">
          {t.newOrder}
        </Link>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main id="main-content" tabIndex={-1} lang={lang === "kz" ? "kk" : "ru"} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-extrabold">{t.emptyCart}</h1>
        {notice && <p role="status">{t.updated}</p>}
        {undoToast}
        <p className="text-muted">{t.choose} «{shop.name}».</p>
        <Link href={backHref} className="btn-dark">
          {t.back}
        </Link>
      </main>
    );
  }

  return (
    <main lang={lang === "kz" ? "kk" : "ru"} className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-4">
        <BackLink fallback={backHref} ariaLabel={t.back} className="flex size-11 items-center justify-center">
          <BackIcon size={24} />
        </BackLink>
        <h1 className="text-xl font-extrabold">{t.yourOrder}</h1>
      </div>

      <form id="main-content" tabIndex={-1} noValidate onSubmit={submit} className="flex flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-6">
        <div className="flex flex-1 flex-col gap-5 p-5">
          {notice && <p role="status">{t.updated}</p>}
          {undoToast}
          <ul className="flex flex-col gap-2.5">
            {lines.map((l, i) => (
              <li key={lineKey(l)} className="card flex items-center gap-3 p-2.5">
                <ProductPhoto url={l.photo} alt="" seed={i} className="size-14 flex-none rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold leading-tight">
                    {l.title}
                    {l.variantTitle ? ` · ${l.variantTitle}` : ""}
                  </div>
                  <div className="text-sm text-muted">{formatPrice(l.price * l.qty)}</div>
                </div>
                {booking ? (
                  <button type="button" aria-label={`${t.unselect}: ${l.title}`} onClick={() => { setRemoved([l]); setQty(lineKey(l), 0); }} className="min-h-11 px-2 text-sm font-semibold text-muted underline">
                    {t.unselect}
                  </button>
                ) : (
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={t.decrease} onClick={() => { if (l.qty <= 1) setRemoved([l]); setQty(lineKey(l), l.qty - 1); }} className="size-11 rounded-[10px] border-[1.5px] border-field text-lg font-bold">
                    −
                  </button>
                  <span aria-live="polite" className="w-6 text-center font-bold">{l.qty}</span>
                  <button type="button" aria-label={t.increase} onClick={() => setQty(lineKey(l), l.qty + 1)} className="size-11 rounded-[10px] border-[1.5px] border-field text-lg font-bold">
                    +
                  </button>
                </div>
                )}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => { if (window.confirm(t.clearConfirm)) { setRemoved(lines); clear(); forgetLastOrder(); } }}
            className="min-h-11 self-start text-sm font-semibold text-muted underline"
          >
            {t.clearCart}
          </button>

          <div className="flex flex-col gap-3">
            <h2 className="text-lead font-bold">{t.details}</h2>
            <Field label={t.name} htmlFor="name">
              <input id="name" required maxLength={80} autoComplete="name" value={name} aria-invalid={fieldErrors.name ? true : undefined} aria-describedby={fieldErrors.name ? "name-error" : undefined} onChange={(e) => { setName(e.target.value); setFieldErrors((f) => ({ ...f, name: undefined })); }} className="input scroll-mb-72" />
              {fieldErrors.name && <p id="name-error" className="text-sm font-semibold text-accent-dark">{fieldErrors.name}</p>}
            </Field>
            <Field label={t.phone} htmlFor="phone">
              <input
                id="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+7 701 123 45 67"
                value={phone}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={phoneError ? "phone-error" : undefined}
                onChange={(e) => { setPhone(formatPhoneInput(e.target.value)); setPhoneError(""); }}
                onBlur={() => setPhoneError(phone && !/^[0-9]{10,15}$/.test(normalizePhone(phone)) ? t.phoneError : "")}
                className="input scroll-mb-72"
              />
              {phoneError && <p id="phone-error" className="text-sm font-semibold text-accent-dark">{phoneError}</p>}
            </Field>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" hidden />

            <p className="text-sm text-muted">{t.savedHint}</p>
            <button type="button" className="min-h-11 text-sm underline" onClick={() => { try { localStorage.removeItem("sore-customer"); } catch {} setName(""); setPhone(""); }}>{t.clearDetails}</button>
            {(shop.paymentInfo || shop.deliveryInfo) && (
              <section aria-label={t.termsTitle} className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 text-sm">
                <h3 className="font-bold">{t.termsTitle}</h3>
                {shop.paymentInfo && <p className="whitespace-pre-line"><span className="font-semibold">{t.payment}:</span> {shop.paymentInfo}</p>}
                {shop.deliveryInfo && <p className="whitespace-pre-line"><span className="font-semibold">{t.deliveryTerms}:</span> {shop.deliveryInfo}</p>}
              </section>
            )}
            {!booking && <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.method}>
              {(["delivery", "pickup"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={delivery === v}
                  onClick={() => setDelivery(v)}
                  className={`h-12 rounded-xl text-body font-bold ${delivery === v ? "bg-ink text-cream" : "border-[1.5px] border-field"}`}
                >
                  {v === "delivery" ? t.delivery : t.pickup}
                </button>
              ))}
            </div>}

            {!booking && delivery === "delivery" && (
              <Field label={t.address} htmlFor="address">
                <input id="address" required autoComplete="street-address" maxLength={200} value={address} aria-invalid={fieldErrors.address ? true : undefined} aria-describedby={fieldErrors.address ? "address-error" : undefined} onChange={(e) => { setAddress(e.target.value); setFieldErrors((f) => ({ ...f, address: undefined })); }} className="input scroll-mb-72" />
                {fieldErrors.address && <p id="address-error" className="text-sm font-semibold text-accent-dark">{fieldErrors.address}</p>}
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.date} htmlFor="needed-date">
                <input id="needed-date" type="date" required={booking || shop.leadDays > 0} min={minDate} value={neededDate} aria-invalid={fieldErrors.date ? true : undefined} aria-describedby={fieldErrors.date ? "date-error" : undefined} onChange={(e) => { setNeededDate(e.target.value); setFieldErrors((f) => ({ ...f, date: undefined })); }} className="input scroll-mb-72" />
                {fieldErrors.date && <p id="date-error" className="text-sm font-semibold text-accent-dark">{fieldErrors.date}</p>}
              </Field>
              <Field label={t.time} htmlFor="needed-time">
                <input id="needed-time" type="time" value={neededTime} onChange={(e) => setNeededTime(e.target.value)} className="input" />
              </Field>
            </div>
            {shop.leadDays > 0 && (
              <p className="text-caption text-muted">
                {t.leadPre} {shop.leadDays} {t.leadPost}
              </p>
            )}
            <Field label={t.comment} htmlFor="comment">
              <input id="comment" maxLength={300} placeholder={t.commentHint} value={comment} onChange={(e) => setComment(e.target.value)} className="input" />
            </Field>
          </div>

          {error && (
            <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm font-semibold text-accent-dark">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2.5 border-t border-line bg-surface px-5 py-4 md:top-4 md:bottom-auto md:mt-5 md:mr-5 md:rounded-2xl md:border">
          <div className="flex items-center justify-between">
            <span className="text-muted">{t.total}</span>
            <span className="text-2xl font-extrabold">{formatPrice(total)}</span>
          </div>
          {shop.demo ? (
            <>
              <DemoActionStub lang={lang} className="h-14 text-lg" />
              <DemoNotice lang={lang} />
            </>
          ) : (
            <>
              {shop.acceptingOrders === false && <PausedNotice lang={lang} />}
              <button type="submit" disabled={sending || shop.acceptingOrders === false} className="btn-wa h-14 text-lg disabled:opacity-60">
                <WhatsAppIcon />
                {sending ? t.sending : t.order}
              </button>
              <p className="hidden text-center text-caption text-muted md:block">{t.orderHint}</p>
            </>
          )}
          <p className="text-center text-caption text-muted">
            {t.consent}{" "}
            <Link href="/privacy" className="underline">
              {t.consentLink}
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}
