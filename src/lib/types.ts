import type { Database } from "@/lib/database.types";

export type Shop = Database["public"]["Tables"]["shops"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];

export const FREE_PRODUCT_LIMIT = 15;
/** Платный тариф Pro (2 500 ₸/мес, подключается вручную): больше товаров и ИИ-запросов, пока не истёк срок pro_until. */
export const PRO_PRODUCT_LIMIT = 500;
export const PRO_AI_DAILY_LIMIT = 100;
export const PRO_PRICE_TENGE = 2500;

export const isPro = (proUntil: string | null | undefined) => Boolean(proUntil && new Date(proUntil).getTime() > Date.now());
export const productLimit = (proUntil: string | null | undefined) => (isPro(proUntil) ? PRO_PRODUCT_LIMIT : FREE_PRODUCT_LIMIT);

/** Сколько дней осталось до конца Pro (0, если срок вышел или Pro не подключали). */
export const proDaysLeft = (proUntil: string | null | undefined) =>
  proUntil ? Math.max(0, Math.ceil((new Date(proUntil).getTime() - Date.now()) / 86_400_000)) : 0;
