"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTr } from "@/components/ui-lang";
import { startTelegramLink, unlinkTelegram } from "./telegram-actions";

/** Подключение Telegram: заказы приходят сообщением в чат с ботом. */
export function TelegramCard({ linked }: { linked: boolean }) {
  const router = useRouter();
  const tr = useTr();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Пока ждём нажатия Start в боте, раз в 3 секунды проверяем статус.
  useEffect(() => {
    if (!url || linked) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [url, linked, router]);

  async function connect() {
    setBusy(true);
    setError("");
    const r = await startTelegramLink();
    setBusy(false);
    if (r.error || !r.url) return setError(r.error ?? tr("Не удалось создать ссылку.", "Сілтеме жасау мүмкін болмады."));
    setUrl(r.url);
  }

  async function disconnect() {
    if (!window.confirm(tr("Отключить уведомления в Telegram? Заказы по-прежнему будут в разделе «Заказы».", "Telegram хабарландыруларын өшіру керек пе? Тапсырыстар «Тапсырыстар» бөлімінде қалады."))) return;
    setBusy(true);
    const r = await unlinkTelegram();
    setBusy(false);
    if (r.error) return setError(r.error);
    setUrl("");
    router.refresh();
  }

  return (
    <section className="card flex flex-col gap-3 p-4" aria-labelledby="tg-title">
      <h2 id="tg-title" className="text-lg font-bold">
        {tr("Заказы в Telegram", "Telegram-дағы тапсырыстар")}
      </h2>
      {linked ? (
        <>
          <p role="status" className="text-body leading-relaxed text-wa">
            {tr("Telegram подключён: новые заказы приходят вам сообщением.", "Telegram қосылған: жаңа тапсырыстар сізге хабарлама болып келеді.")}
          </p>
          <button type="button" disabled={busy} onClick={disconnect} className="min-h-11 self-start text-sm font-semibold text-muted underline">
            {tr("Отключить", "Өшіру")}
          </button>
        </>
      ) : url ? (
        <>
          <p className="text-body leading-relaxed text-muted">{tr("Откройте бота и нажмите Start. Эта страница сама обновится, когда всё подключится.", "Ботты ашып, Start басыңыз. Бәрі қосылғанда бұл бет өзі жаңарады.")}</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-dark h-12">
            {tr("Открыть Telegram", "Telegram ашу")}
          </a>
        </>
      ) : (
        <>
          <p className="text-body leading-relaxed text-muted">{tr("Получайте новый заказ сообщением в Telegram, не заходя в кабинет.", "Жаңа тапсырысты кабинетке кірмей, Telegram-да хабарлама ретінде алыңыз.")}</p>
          <button type="button" disabled={busy} onClick={connect} className="btn-dark h-12 disabled:opacity-60">
            {busy ? tr("Готовим ссылку…", "Сілтеме дайындалуда…") : tr("Подключить Telegram", "Telegram қосу")}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-accent-dark">
          {error}
        </p>
      )}
    </section>
  );
}
