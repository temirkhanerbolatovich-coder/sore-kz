import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackArrow } from "@/components/back-link";
import { LoginForm } from "./login-form";
import { RememberLang, UiLangProvider, UiLangSwitch } from "@/components/ui-lang";
import { getUiLang, tr } from "@/lib/ui-lang";
import { parseLang } from "@/lib/lang";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const lang = await getUiLang((await searchParams).lang);
  return { title: tr(lang, "Вход — SÖRE", "Кіру — SÖRE") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; lang?: string }>;
}) {
  const { error, lang: langParam } = await searchParams;
  const lang = await getUiLang(langParam);
  // Уже вошёл? Не показываем форму входа ещё раз.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return (
    <UiLangProvider lang={lang}>
    {langParam && <RememberLang lang={parseLang(langParam)} />}
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-2xl font-extrabold tracking-tight">
          S<span className="text-accent">Ö</span>RE
        </Link>
        <div className="flex items-center gap-3">
          <UiLangSwitch />
          <Link href={lang === "kz" ? "/?lang=kz" : "/"} className="flex min-h-11 items-center gap-1 font-semibold text-muted">
            <BackArrow /> {tr(lang, "На главную", "Басты бетке")}
          </Link>
        </div>
      </div>
      <div id="main-content" tabIndex={-1} className="mt-8 flex flex-col gap-3">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight">
          {tr(lang, "Войдите, чтобы создать магазин", "Дүкен ашу үшін кіріңіз")}
        </h1>
        <p className="text-lead leading-relaxed text-muted">
          {tr(
            lang,
            `Войдите по ссылке из письма${process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1" ? " или через Google" : ""}, чтобы создать витрину и принимать заказы. Пароль не нужен.`,
            `Витрина жасап, тапсырыс қабылдау үшін хатта келген сілтеме${process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1" ? " немесе Google" : ""} арқылы кіріңіз. Құпиясөз керек емес.`,
          )}
        </p>
      </div>
      <LoginForm failed={Boolean(error)} />
      <p className="mt-auto text-center text-sm leading-relaxed text-muted">
        {tr(lang, "Продолжая, вы соглашаетесь с ", "Жалғастыру арқылы сіз келесімен келісесіз: ")}<Link href="/terms" className="underline">{tr(lang, "условиями", "шарттар")}</Link>{tr(lang, " и ", " және ")}
        <Link href="/privacy" className="underline">{tr(lang, "политикой конфиденциальности", "құпиялылық саясаты")}</Link>{tr(lang, ".", ".")}
      </p>
    </main>
    </UiLangProvider>
  );
}
