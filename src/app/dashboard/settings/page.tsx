import { requireShop } from "@/lib/shop";
import { telegramConfigured } from "@/lib/telegram";
import { BackLink } from "@/components/back-link";
import { BackIcon } from "@/components/icons";
import { UiLangSwitch } from "@/components/ui-lang";
import { getUiLang, tr } from "@/lib/ui-lang";
import { DashboardNav } from "@/components/dashboard-nav";
import { SettingsForm } from "./settings-form";
import { TelegramCard } from "./telegram-card";
import { DangerZone } from "./danger-zone";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Настройки магазина — SÖRE", "Дүкен баптаулары — SÖRE") };
}

export default async function SettingsPage() {
  const { supabase, shop } = await requireShop();
  const lang = await getUiLang();
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/${shop.slug}`;
  const { data: tg } = telegramConfigured()
    ? await supabase.from("shop_telegram").select("linked_at").eq("shop_id", shop.id).maybeSingle()
    : { data: null };

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-5 p-5 pb-24 md:max-w-2xl lg:max-w-6xl lg:pb-10">
      <DashboardNav active="settings" desktop />
      <div id="main-content" tabIndex={-1} className="flex flex-col gap-5 lg:mx-auto lg:w-full lg:max-w-2xl">
        <div className="flex items-center gap-1">
          <BackLink fallback="/dashboard" ariaLabel={tr(lang, "Назад к товарам", "Тауарларға оралу")} className="-ml-2 flex size-11 flex-none items-center justify-center lg:hidden">
            <BackIcon size={24} />
          </BackLink>
          <h1 className="min-w-0 flex-1 text-2xl font-extrabold">{tr(lang, "Магазин", "Дүкен")}</h1>
          <UiLangSwitch />
        </div>
        {telegramConfigured() && <TelegramCard linked={Boolean(tg?.linked_at)} />}
        <SettingsForm shop={shop} url={url} />
        <DangerZone slug={shop.slug} />
      </div>
      <DashboardNav active="settings" />
    </main>
  );
}
