"use client";

import { useState } from "react";
import { useStatefulAction } from "@/lib/use-stateful-action";
import { createShop, type OnboardingState } from "./actions";
import { formatPhoneInput } from "@/lib/order";
import { slugError, slugify } from "@/lib/slug";
import { useTr, useUiLang } from "@/components/ui-lang";

const initial: OnboardingState = {};

export function OnboardingForm() {
  const tr = useTr();
  const lang = useUiLang();
  const [state, onSubmit, pending] = useStatefulAction(createShop, initial);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [phone, setPhone] = useState(state.values?.whatsapp ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugBlurred, setSlugBlurred] = useState(false);

  const shownSlug = slugTouched ? slug : slugify(name);
  const errIn = (f: string) => state.field === f;
  // Ошибку показываем рядом с полем, а не внизу формы, где её не видно на телефоне.
  const fieldError = (f: string) => (errIn(f) ? state.error : undefined);
  const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/^https?:\/\//, "").replace(/\/+$/, "") || "sore.kz";
  const liveSlugError = slugBlurred && shownSlug ? slugError(shownSlug, lang) : null;
  const slugMsg = fieldError("slug") ?? liveSlugError;
  const err = (id: string, msg?: string | null) =>
    msg ? (
      <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-accent-dark">
        {msg}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-semibold">
          {tr("Название магазина", "Дүкен атауы")}
        </label>
        <input
          id="name"
          autoComplete="organization"
          autoFocus
          name="name"
          required
          maxLength={60}
          placeholder={tr("Сладкий дом Алии", "Әлияның тәттілер үйі")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={errIn("name")}
          aria-describedby={fieldError("name") ? "name-error" : undefined}
          className="input"
        />
        {err("name", fieldError("name"))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-semibold">
          {tr("Адрес ссылки", "Сілтеме мекенжайы")}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-body text-muted">{siteHost}/</span>
          <input
            id="slug"
            name="slug"
            required
            placeholder="aliya-sweets"
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            onBlur={() => setSlugBlurred(true)}
            aria-invalid={Boolean(slugMsg)}
            aria-describedby={slugMsg ? "slug-error" : undefined}
            className="input"
          />
        </div>
        {err("slug", slugMsg)}
        <p className="text-caption text-muted">{tr("Латиница, цифры и дефис, от 3 символов. Эту ссылку вы поставите в био Instagram.", "Латын әріптері, цифрлар және дефис, кемінде 3 таңба. Бұл сілтемені Instagram профиліне саласыз.")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="whatsapp" className="text-sm font-semibold">
          {tr("Номер WhatsApp", "WhatsApp нөмірі")}
        </label>
        <input
          id="whatsapp"
          name="whatsapp"
          type="tel"
          required
          inputMode="tel"
          placeholder="+7 701 123 45 67"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
          aria-invalid={errIn("whatsapp")}
          aria-describedby={fieldError("whatsapp") ? "whatsapp-error" : undefined}
          className="input"
        />
        {err("whatsapp", fieldError("whatsapp"))}
        <p className="text-caption text-muted">{tr("Сюда будут приходить заказы.", "Тапсырыстар осы нөмірге келеді.")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="city" className="text-sm font-semibold">
          {tr("Город", "Қала")}
        </label>
        <input id="city" autoComplete="address-level2" name="city" placeholder={tr("Алматы", "Алматы")} defaultValue={state.values?.city} className="input" />
      </div>

      {state.error && !state.field && (
        <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm font-semibold text-accent-dark">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-accent h-14 text-lg disabled:opacity-60">
        {pending ? tr("Создаём…", "Ашылуда…") : tr("Создать магазин", "Дүкен ашу")}
      </button>
    </form>
  );
}
