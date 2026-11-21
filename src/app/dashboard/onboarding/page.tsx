import Link from "next/link";
import { redirect } from "next/navigation";
import { BackArrow } from "@/components/back-link";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { UiLangSwitch } from "@/components/ui-lang";
import { getUiLang, tr } from "@/lib/ui-lang";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Создание магазина — SÖRE", "Дүкен ашу — SÖRE") };
}

export default async function OnboardingPage() {
  const lang = await getUiLang();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle();
  if (shop) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-md md:max-w-2xl flex-1 flex-col gap-6 px-5 py-4">
      <div className="flex items-center justify-between">
        <Link href={lang === "kz" ? "/?lang=kz" : "/"} className="flex min-h-11 items-center gap-1 font-semibold text-muted">
          <BackArrow /> {tr(lang, "На главную", "Басты бетке")}
        </Link>
        <div className="flex items-center gap-3">
          <UiLangSwitch />
          <form action="/auth/signout" method="post">
            <button type="submit" className="min-h-11 px-1 text-sm font-semibold text-muted underline">
              {tr(lang, "Выйти", "Шығу")}
            </button>
          </form>
        </div>
      </div>
      <div id="main-content" tabIndex={-1} className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{tr(lang, "Создайте свой магазин", "Өз дүкеніңізді ашыңыз")}</h1>
        <p className="text-lead leading-relaxed text-muted">{tr(lang, "Шаг 1 из 2. Укажите название и WhatsApp. Затем выберите, как добавить товары.", "2 қадамның 1-і. Атауын және WhatsApp нөмірін көрсетіңіз. Содан кейін тауарды қалай қосатыныңызды таңдаңыз.")}</p>
      </div>
      <OnboardingForm />
    </main>
  );
}
