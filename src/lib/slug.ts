const RU: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

export const RESERVED_SLUGS = new Set([
  "login", "dashboard", "auth", "api", "demo", "admin", "app", "www", "static", "about", "terms", "privacy",
]);

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

/** Адреса демо-магазинов SÖRE (scripts/seed-demo-shops.ts): не индексируются, продавцу недоступны. */
export const DEMO_SLUG_PREFIX = "demo-";
export const isDemoSlug = (slug: string) => slug.startsWith(DEMO_SLUG_PREFIX);

/** «Сладкий дом Алии» → «sladkiy-dom-alii» */
export function slugify(input: string): string {
  const latin = input
    .toLowerCase()
    .split("")
    .map((ch) => (ch in RU ? RU[ch] : ch))
    .join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

export function slugError(slug: string, lang: "ru" | "kz" = "ru"): string | null {
  const kz = lang === "kz";
  if (!SLUG_RE.test(slug)) return kz ? "Мекенжай: 3–30 таңба, латын әріптері, цифрлар және дефис" : "Адрес: 3–30 символов, латиница, цифры и дефис";
  if (RESERVED_SLUGS.has(slug) || isDemoSlug(slug)) return kz ? "Бұл мекенжай сақталған, басқасын таңдаңыз" : "Этот адрес зарезервирован, выберите другой";
  return null;
}
