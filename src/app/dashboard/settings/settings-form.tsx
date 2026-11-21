"use client";
import { useEffect, useRef, useState } from "react";
import { useStatefulAction } from "@/lib/use-stateful-action";
import QRCode from "qrcode";
import type { Shop } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { Field } from "@/components/field";
import Link from "next/link";
import { CopyLink } from "../copy-link";
import { saveSettings } from "./actions";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { useTr } from "@/components/ui-lang";

export function SettingsForm({ shop, url }: { shop: Shop; url: string }) {
  const tr = useTr();
  const [state, onSubmit, pending] = useStatefulAction(saveSettings, {});
  const [avatar, setAvatar] = useState(shop.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // Несохранённые правки: сбрасываются сами, когда приходит новый результат сохранения (новый объект state).
  const [dirtyFor, setDirtyFor] = useState<unknown>(null);
  const dirty = dirtyFor === state;
  useUnsavedGuard(dirty && !pending);
  const canvas = useRef<HTMLCanvasElement>(null);
  // Подпись ошибки берётся из текущего языка; перерисовывать QR при смене языка не нужно.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (canvas.current) QRCode.toCanvas(canvas.current, url, { width: 240, margin: 2 }).catch(() => setError(tr("Не удалось создать QR-код.", "QR-код жасау мүмкін болмады."))); }, [url]);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true); setError("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("unauthorized");
      const blob = await compressImage(file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("product-photos").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      setAvatar(supabase.storage.from("product-photos").getPublicUrl(path).data.publicUrl); setDirtyFor(state);
    } catch { setError(tr("Не удалось загрузить фото. Выберите другое или повторите попытку.", "Фотоны жүктеу мүмкін болмады. Басқасын таңдаңыз немесе қайталап көріңіз.")); }
    finally { setUploading(false); }
  }
  return <div className="flex flex-col gap-5">
    <form onSubmit={onSubmit} onChange={() => setDirtyFor(state)} className="flex flex-col gap-4">
      <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-line p-4">
        <input id="accepting_orders" name="accepting_orders" type="checkbox" className="mt-1 size-5 flex-none accent-[var(--accent)]" defaultChecked={shop.accepting_orders} />
        <span>
          <span className="block font-bold">{tr("Принимаю заказы", "Тапсырыс қабылдаймын")}</span>
          <span className="block text-sm text-muted">{tr("Снимите галочку на время отпуска или если нет сырья: витрина останется открытой, но заказ оформить будет нельзя. Вопросы и «Узнать цену» продолжат работать.", "Демалыс кезінде немесе шикізат болмаса белгіні алып тастаңыз: витрина ашық қалады, бірақ тапсырыс беру мүмкін болмайды. Сұрақтар мен «Бағасын сұрау» жұмыс істей береді.")}</span>
        </span>
      </label>
      <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-line p-4">
        <input id="booking_mode" name="booking_mode" type="checkbox" className="mt-1 size-5 flex-none accent-[var(--accent)]" defaultChecked={shop.booking_mode} />
        <span>
          <span className="block font-bold">{tr("Режим записи (салон, барбершоп, мастер)", "Жазылу режимі (салон, барбершоп, шебер)")}</span>
          <span className="block text-sm text-muted">{tr("Вместо корзины клиент выбирает услуги и оставляет заявку на дату и время. Заявка приходит вам в WhatsApp, вы подтверждаете её сами. Адрес и доставка не спрашиваются.", "Себеттің орнына клиент қызметтерді таңдап, күні мен уақытына өтінім қалдырады. Өтінім сізге WhatsApp-қа келеді, оны өзіңіз растайсыз. Мекенжай мен жеткізу сұралмайды.")}</span>
        </span>
      </label>
      <Field label={tr("Название магазина", "Дүкен атауы")} htmlFor="name"><input id="name" name="name" className="input" required minLength={2} maxLength={60} defaultValue={shop.name} /></Field>
      <Field label={tr("Город", "Қала")} htmlFor="city"><input id="city" name="city" className="input" maxLength={60} defaultValue={shop.city || ""} /></Field>
      <Field label="WhatsApp" htmlFor="whatsapp"><input id="whatsapp" name="whatsapp" type="tel" className="input" required defaultValue={shop.whatsapp} /></Field>
      <Field label={tr("Telegram для покупателей (ник или ссылка, по желанию)", "Сатып алушыларға арналған Telegram (ник немесе сілтеме, қалауыңызша)")} htmlFor="telegram"><input id="telegram" name="telegram" className="input" maxLength={120} autoCapitalize="none" autoCorrect="off" placeholder="@aliya_sweets" defaultValue={shop.telegram_username ? `@${shop.telegram_username}` : ""} /></Field>
      <Field label={tr("Предзаказ: за сколько дней принимать заказы (0 = в любой день)", "Алдын ала тапсырыс: неше күн бұрын қабылдау (0 = кез келген күні)")} htmlFor="lead_days"><input id="lead_days" name="lead_days" type="number" inputMode="numeric" min={0} max={60} className="input" defaultValue={shop.lead_days} /></Field>
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">{tr("О магазине (видно покупателям)", "Дүкен туралы (сатып алушыларға көрінеді)")}</legend>
        <Field label={tr("Коротко о вас (до 300 символов)", "Өзіңіз туралы қысқаша (300 таңбаға дейін)")} htmlFor="about"><textarea id="about" name="about" className="input min-h-24 py-3" maxLength={300} rows={3} defaultValue={shop.about || ""} /></Field>
        <Field label={tr("Адрес или район", "Мекенжай немесе аудан")} htmlFor="shop-address"><input id="shop-address" name="address" className="input" maxLength={120} placeholder={tr("Астана, левый берег", "Астана, сол жағалау")} defaultValue={shop.address || ""} /></Field>
        <Field label={tr("График работы", "Жұмыс кестесі")} htmlFor="hours"><input id="hours" name="hours" className="input" maxLength={120} placeholder={tr("Ежедневно 9:00–20:00", "Күн сайын 9:00–20:00")} defaultValue={shop.hours || ""} /></Field>
        <Field label={tr("Instagram (ник или ссылка)", "Instagram (ник немесе сілтеме)")} htmlFor="instagram"><input id="instagram" name="instagram" className="input" maxLength={120} autoCapitalize="none" autoCorrect="off" placeholder="@aliya.sweets" defaultValue={shop.instagram ? `@${shop.instagram}` : ""} /></Field>
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-2xl border border-line p-4">
        <legend className="px-1 text-sm font-bold">{tr("Оплата и доставка (видно покупателям)", "Төлем және жеткізу (сатып алушыларға көрінеді)")}</legend>
        <Field label={tr("Как оплатить (до 300 символов)", "Қалай төлеу керек (300 таңбаға дейін)")} htmlFor="payment_info"><textarea id="payment_info" name="payment_info" className="input min-h-20 py-3" maxLength={300} rows={2} placeholder={tr("Перевод на Kaspi, наличными при получении", "Kaspi-ге аударым, алған кезде қолма-қол")} defaultValue={shop.payment_info || ""} /></Field>
        <Field label={tr("Доставка и самовывоз (до 300 символов)", "Жеткізу және өзі алып кету (300 таңбаға дейін)")} htmlFor="delivery_info"><textarea id="delivery_info" name="delivery_info" className="input min-h-20 py-3" maxLength={300} rows={2} placeholder={tr("По городу 1500 ₸, бесплатно от 20 000 ₸. Самовывоз: левый берег", "Қала бойынша 1500 ₸, 20 000 ₸-ден бастап тегін. Өзі алып кету: сол жағалау")} defaultValue={shop.delivery_info || ""} /></Field>
        <p className="text-caption text-muted">{tr("Оплата в приложении не принимается: покупатель сам договаривается с вами в WhatsApp.", "Қосымшада төлем қабылданбайды: сатып алушы сізбен WhatsApp-та өзі келіседі.")}</p>
      </fieldset>
      <Field label={tr("Адрес ссылки (не меняется)", "Сілтеме мекенжайы (өзгермейді)")} htmlFor="slug"><input id="slug" className="input" readOnly value={shop.slug} /></Field>
      <input type="hidden" name="avatar_url" value={avatar} />
      {avatar && <button type="button" className="min-h-11 self-start text-sm font-semibold text-accent-dark underline" onClick={() => { setAvatar(""); setDirtyFor(state); }}>{tr("Убрать фото магазина", "Дүкен фотосын жою")}</button>}
      {avatar && <img src={avatar} alt={tr("Фото магазина", "Дүкен фотосы")} width={96} height={96} className="size-24 rounded-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */}
      <div className="flex flex-col gap-1.5">
        <input id="avatar" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading || pending} onChange={(e) => void upload(e.target.files?.[0])} />
        <label htmlFor="avatar" className="btn-outline h-12 cursor-pointer has-[:disabled]:opacity-60">{uploading ? tr("Загружаем…", "Жүктелуде…") : avatar ? tr("Заменить фото магазина", "Дүкен фотосын ауыстыру") : tr("Выбрать фото магазина", "Дүкен фотосын таңдау")}</label>
        <p className="text-caption text-muted">{tr("JPG, PNG или WebP. Фото покажется на витрине в круге.", "JPG, PNG немесе WebP. Фото витринада шеңбер ішінде көрінеді.")}</p>
      </div>
      {(error || state.error) && <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="rounded-xl border border-line bg-accent-soft px-3.5 py-3 text-sm font-semibold text-accent-dark">{error || state.error}</p>}
      <button className="btn-accent" disabled={pending || uploading}>{uploading ? tr("Загружаем…", "Жүктелуде…") : pending ? tr("Сохраняем…", "Сақталуда…") : tr("Сохранить настройки", "Баптауларды сақтау")}</button>
      {state.success && <p role="status" className="rounded-xl border border-ok-line bg-ok-bg px-3.5 py-3 text-sm font-semibold text-ok-ink">{state.success}</p>}
    </form>
    <a href={url} className="break-all underline">{url}</a><CopyLink url={url} />
    <canvas ref={canvas} aria-label={tr("QR-код магазина", "Дүкен QR-коды")} className="mx-auto" />
    <Link href="/dashboard/poster" className="btn-outline">{tr("Плакат для печати", "Басып шығаруға арналған плакат")}</Link>
    <button className="btn-outline" onClick={() => { const a = document.createElement("a"); a.href = canvas.current!.toDataURL("image/png"); a.download = `${shop.slug}-qr.png`; a.click(); }}>{tr("Скачать QR-код PNG", "QR-кодты PNG жүктеу")}</button>
    <form action="/auth/signout" method="post" className="pt-2 text-center"><button type="submit" className="min-h-11 px-3 text-sm font-semibold text-muted underline">{tr("Выйти из аккаунта", "Аккаунттан шығу")}</button></form>
  </div>;
}
