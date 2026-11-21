import { cookies } from "next/headers";
import { parseLang, type Lang } from "@/lib/lang";

export const UI_LANG_COOKIE = "sore-lang";

/** Язык интерфейса продавца (вход, онбординг, кабинет): хранится в cookie, переключается кнопками RU/KZ. */
export async function getUiLang(explicit?: string): Promise<Lang> {
  if (explicit === "kz" || explicit === "ru") return explicit;
  try {
    return parseLang((await cookies()).get(UI_LANG_COOKIE)?.value);
  } catch {
    return "ru"; // вне запроса cookie недоступны
  }
}

/** Подпись на нужном языке для серверного кода: tr(lang, "по-русски", "қазақша"). */
export const tr = (lang: Lang, ru: string, kz: string) => (lang === "kz" ? kz : ru);
