import { UiLangProvider } from "@/components/ui-lang";
import { getUiLang } from "@/lib/ui-lang";

/** Язык кабинета берётся из cookie и доступен всем клиентским компонентам через useTr(). */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <UiLangProvider lang={await getUiLang()}>{children}</UiLangProvider>;
}
