import Link from "next/link";
import { BackArrow, BackLink } from "@/components/back-link";
import { getUiLang, tr } from "@/lib/ui-lang";

export default async function NotFound() {
  const lang = await getUiLang();
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-6xl font-extrabold text-accent">404</div>
      <h1 className="text-2xl font-extrabold">{tr(lang, "Такой страницы нет", "Мұндай бет жоқ")}</h1>
      <p className="leading-relaxed text-muted">
        {tr(lang, "Возможно, магазин переехал или в ссылке опечатка. Хотите создать свой магазин за 2 минуты?", "Дүкен көшіп кеткен немесе сілтемеде қате болуы мүмкін. Өз дүкеніңізді 2 минутта ашқыңыз келе ме?")}
      </p>
      <Link href="/login" className="btn-accent w-full">
        {tr(lang, "Создать магазин", "Дүкен ашу")}
      </Link>
      <BackLink fallback="/" className="flex min-h-11 items-center gap-1 font-semibold text-muted">
        <BackArrow /> {tr(lang, "Назад", "Артқа")}
      </BackLink>
      <Link href="/" className="min-h-11 font-semibold text-muted underline">
        {tr(lang, "На главную", "Басты бетке")}
      </Link>
    </main>
  );
}
