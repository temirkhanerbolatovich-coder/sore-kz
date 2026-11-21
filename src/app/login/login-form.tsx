"use client";

import { useEffect, useState } from "react";
import { mailProvider } from "@/lib/mail-provider";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTr } from "@/components/ui-lang";

/** Вход по коду работает, только если письмо содержит код ({{ .Token }}): нужен свой SMTP и шаблоны из docs/email-templates. */
const EMAIL_CODE = process.env.NEXT_PUBLIC_EMAIL_CODE === "1";
/** Кнопка Google: включайте (=1), когда провайдер настроен в Supabase (см. docs/DEPLOY.md). */
const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

export function LoginForm({ failed }: { failed: boolean }) {
  const tr = useTr();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    failed ? "error" : "idle",
  );
  const [message, setMessage] = useState(
    failed ? tr("Ссылка устарела или уже использована. Запросите новую.", "Сілтеменің мерзімі өтті немесе ол қолданылған. Жаңасын сұраңыз.") : "",
  );

  const router = useRouter();
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError("");
    setVerifying(true);
    try {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) {
        setCodeError(tr("Код не подошёл или устарел. Проверьте письмо или отправьте новый.", "Код сәйкес келмеді немесе ескірді. Хатты тексеріңіз немесе жаңасын сұраңыз."));
        setVerifying(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setCodeError(tr("Не удалось связаться с сервером. Повторите попытку.", "Серверге қосылу мүмкін болмады. Қайталап көріңіз."));
      setVerifying(false);
    }
  }
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus("error");
      setMessage(tr("Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.", "Хатты жіберу мүмкін болмады. Мекенжайды тексеріп, қайталап көріңіз."));
    } else {
      setStatus("sent");
      setCooldown(60);
    }
    } catch {
      setStatus("error");
      setMessage(tr("Не удалось связаться с сервером. Проверьте соединение и повторите попытку.", "Серверге қосылу мүмкін болмады. Байланысты тексеріп, қайталап көріңіз."));
    }
  }

  if (status === "sent") {
    const mail = mailProvider(email);
    return (
      <div className="card flex flex-col gap-2 p-5" role="status">
        <div className="text-lg font-bold">{tr("Проверьте почту", "Поштаңызды тексеріңіз")}</div>
        <p className="leading-relaxed text-muted">
          {tr("Мы отправили ссылку для входа на ", "Кіру сілтемесін мына мекенжайға жібердік: ")}<b className="text-ink">{email}</b>.{" "}
          {EMAIL_CODE ? tr("Нажмите ссылку в письме на этом устройстве или введите код.", "Хаттағы сілтемені осы құрылғыда басыңыз немесе кодты енгізіңіз.") : tr("Откройте письмо на этом же устройстве.", "Хатты осы құрылғыда ашыңыз.")}
        </p>
        {mail && (
          <a href={mail.url} target="_blank" rel="noopener noreferrer" className="btn-outline h-12 w-full">
            {tr("Открыть", "Ашу:")} {mail.name}
          </a>
        )}
        {EMAIL_CODE && (
        <form onSubmit={onCode} className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
          <label htmlFor="otp" className="text-sm font-semibold">
            {tr("Или введите код из письма", "Немесе хаттағы кодты енгізіңіз")}
          </label>
          <div className="flex gap-2">
            <input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,8}"
              maxLength={8}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="input tracking-[0.2em]"
            />
            <button type="submit" disabled={verifying || code.length < 6} className="btn-dark flex-none disabled:opacity-60">
              {verifying ? "…" : tr("Войти", "Кіру")}
            </button>
          </div>
          {codeError && (
            <p role="alert" className="text-sm font-semibold text-accent-dark">
              {codeError}
            </p>
          )}
        </form>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-5">
          <button type="button" className="min-h-11 font-semibold text-accent underline" onClick={() => setStatus("idle")}>
            {tr("Указать другую почту", "Басқа пошта көрсету")}
          </button>
          <button type="button" disabled={cooldown > 0} className="min-h-11 font-semibold text-accent underline disabled:no-underline disabled:opacity-60" onClick={() => void onSubmit()}>
            {cooldown > 0 ? tr(`Отправить ещё раз через ${cooldown} с`, `${cooldown} с кейін қайта жіберу`) : tr("Отправить ещё раз", "Қайта жіберу")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {GOOGLE_LOGIN && (
        <>
          <button
            type="button"
            onClick={() =>
              void createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } })
            }
            className="btn-outline h-14 text-lg"
          >
            {tr("Войти через Google", "Google арқылы кіру")}
          </button>
          <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            {tr("или по почте", "немесе пошта арқылы")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-body font-semibold">
          {tr("Электронная почта", "Электрондық пошта")}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          placeholder="aliya@mail.kz"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input h-14 text-lead"
        />
      </div>
      {message && (
        <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm font-semibold text-accent-dark">
          {message}
        </p>
      )}
      <button type="submit" disabled={status === "sending"} className="btn-accent h-14 text-lg disabled:opacity-60">
        {status === "sending" ? tr("Отправляем…", "Жіберілуде…") : tr("Получить ссылку для входа", "Кіру сілтемесін алу")}
      </button>
    </form>
    </div>
  );
}
