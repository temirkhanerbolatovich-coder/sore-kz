import { WhatsAppIcon } from "@/components/icons";
import { tr } from "@/lib/ui-lang";
import type { Lang } from "@/lib/lang";
import { PRO_AI_DAILY_LIMIT, PRO_PRICE_TENGE, PRO_PRODUCT_LIMIT, isPro, proDaysLeft } from "@/lib/types";
import { proRequestUrl } from "@/lib/support";

/** Тариф магазина: пока Free, предлагает снять ограничения (оплата вручную через WhatsApp владельца); на Pro показывает срок. */
export function PlanCard({ slug, proUntil, lang }: { slug: string; proUntil: string | null; lang: Lang }) {
  const price = new Intl.NumberFormat("ru-RU").format(PRO_PRICE_TENGE).replace(/[\u00a0\u202f]/g, " ");
  const pro = isPro(proUntil);
  const until = proUntil ? new Date(proUntil) : null;
  const daysLeft = proDaysLeft(proUntil);
  const date = until ? new Intl.DateTimeFormat(lang === "kz" ? "kk-KZ" : "ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" }).format(until) : "";
  const url = proRequestUrl(slug, pro);

  if (pro) {
    const soon = daysLeft <= 7;
    return (
      <section className="card mx-5 mt-3 flex flex-col gap-2 p-4" aria-label="Pro">
        <h2 className="font-bold">{tr(lang, `Pro действует до ${date}`, `Pro ${date} дейін жарамды`)}</h2>
        <p className="text-sm text-muted">
          {tr(lang, `До ${PRO_PRODUCT_LIMIT} товаров и ${PRO_AI_DAILY_LIMIT} ИИ-запросов в сутки.`, `${PRO_PRODUCT_LIMIT} тауарға дейін және тәулігіне ${PRO_AI_DAILY_LIMIT} ЖИ сұранысы.`)}
          {soon && ` ${tr(lang, "Срок скоро закончится.", "Мерзімі жақында аяқталады.")}`}
        </p>
        {soon && url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-wa h-11 min-h-11 text-sm">
            <WhatsAppIcon />
            {tr(lang, "Продлить в WhatsApp", "WhatsApp-та ұзарту")}
          </a>
        )}
      </section>
    );
  }

  return (
    <section className="card mx-5 mt-3 flex flex-col gap-2 p-4" aria-label="Pro">
      <h2 className="font-bold">{tr(lang, `Pro · ${price} ₸ в месяц`, `Pro · айына ${price} ₸`)}</h2>
      <p className="text-sm text-muted">
        {tr(
          lang,
          `Вместо 15 товаров и 20 ИИ-запросов в сутки: до ${PRO_PRODUCT_LIMIT} товаров и ${PRO_AI_DAILY_LIMIT} запросов. Оплата переводом, подключаю вручную.`,
          `15 тауар мен тәулігіне 20 ЖИ сұранысының орнына: ${PRO_PRODUCT_LIMIT} тауарға және ${PRO_AI_DAILY_LIMIT} сұранысқа дейін. Төлем аударым арқылы, қосуды қолмен жасаймын.`,
        )}
      </p>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-wa h-11 min-h-11 text-sm">
          <WhatsAppIcon />
          {tr(lang, "Снять ограничения", "Шектеулерді алу")}
        </a>
      )}
    </section>
  );
}
