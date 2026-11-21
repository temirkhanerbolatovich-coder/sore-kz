import Link from "next/link";
import { BackArrow } from "@/components/back-link";

/** Общая обёртка юридических страниц: заголовок, дата, кнопка «На главную». */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-6">
      <Link href="/" className="flex min-h-11 items-center gap-1 self-start font-semibold text-muted">
        <BackArrow /> На главную
      </Link>
      <div id="main-content" tabIndex={-1} className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="text-sm text-muted">Обновлено: {updated}</p>
      </div>
      <div className="flex flex-col gap-4 text-[16px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </main>
  );
}

export function contactLine() {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <>
      Вопросы и запросы на удаление данных можно отправить на <a className="font-semibold underline" href={`mailto:${email}`}>{email}</a>.
    </>
  ) : (
    <>Продавец может сам удалить магазин и аккаунт в кабинете: «Магазин» → «Удалить магазин и аккаунт». Покупатель может попросить продавца удалить его заказы.</>
  );
}
