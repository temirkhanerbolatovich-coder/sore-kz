import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { requireShop } from "@/lib/shop";
import { formatNeeded, formatPrice, whatsappUrl } from "@/lib/order";
import { DashboardNav } from "@/components/dashboard-nav";
import { Field } from "@/components/field";
import { applyOrderFilters, filterQuery, parseOrderFilters } from "@/lib/orders-query";
import { StatusButton } from "./status-button";
import { BackIcon, CartIcon } from "@/components/icons";
import { BackLink } from "@/components/back-link";
import { UiLangSwitch } from "@/components/ui-lang";
import { getUiLang, tr } from "@/lib/ui-lang";

export async function generateMetadata() {
  return { title: tr(await getUiLang(), "Заказы — SÖRE", "Тапсырыстар — SÖRE") };
}

type OrderRow = {
  id: string;
  number: number;
  items: { title: string; qty: number; price: number }[];
  total: number;
  customer_name: string;
  customer_phone: string;
  address: string | null;
  comment: string | null;
  needed_date: string | null;
  needed_time: string | null;
  status: "new" | "done" | "cancelled";
  created_at: string;
};

const STATUS = {
  new: { label: ["Новый", "Жаңа"], cls: "bg-accent-soft text-accent-dark" },
  done: { label: ["Выполнен", "Орындалды"], cls: "bg-ok-bg text-ok-ink" },
  cancelled: { label: ["Отменён", "Бас тартылды"], cls: "bg-line text-muted" },
} as const;

const dateFormat = (lang: "ru" | "kz") => new Intl.DateTimeFormat(lang === "kz" ? "kk-KZ" : "ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Almaty",
});

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string; date?: string }> }) {
  const { supabase, shop } = await requireShop();
  const lang = await getUiLang();
  const fmt = dateFormat(lang);
  const sp = await searchParams;
  const page = Math.min(1000, Math.max(1, Number(sp.page) || 1));
  const filters = parseOrderFilters(sp);
  const { onlyNew } = filters;
  const filtered = Boolean(filters.q || filters.date);
  let query = supabase
    .from("orders")
    .select("*")
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  query = applyOrderFilters(query, filters);
  const { data, error } = await query.range(0, page * 20);
  if (error) throw new Error("Не удалось загрузить заказы");
  const hasMore = (data?.length || 0) > page * 20;
  const orders = (data ?? []).slice(0, page * 20) as OrderRow[];
  const newCount = orders.filter((o) => o.status === "new").length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-24 lg:max-w-6xl lg:pb-10">
      <DashboardNav active="orders" desktop />
      <div id="main-content" tabIndex={-1} className="flex flex-col gap-1 px-5 pb-3 pt-6">
        <div className="flex items-center gap-1">
          <BackLink fallback="/dashboard" ariaLabel={tr(lang, "Назад к товарам", "Тауарларға оралу")} className="-ml-2 flex size-11 flex-none items-center justify-center lg:hidden">
            <BackIcon size={24} />
          </BackLink>
          <h1 className="min-w-0 flex-1 text-2xl font-extrabold tracking-tight">{tr(lang, "Заказы", "Тапсырыстар")}</h1>
          <UiLangSwitch />
        </div>
        <p className="text-body text-muted">
          {tr(lang, "Заказы сохраняются, даже если клиент не нажал «Отправить» в WhatsApp.", "Клиент WhatsApp-та «Жіберу» батырмасын баспаса да, тапсырыстар сақталады.")}
        </p>
      </div>

      <nav className="flex gap-3 px-5 py-3" aria-label={tr(lang, "Фильтр заказов", "Тапсырыс сүзгісі")}><Link className={onlyNew ? "btn-dark" : "btn-outline"} href={filterQuery({ ...filters, onlyNew: true })} aria-current={onlyNew ? "page" : undefined}>{tr(lang, "Новые", "Жаңалар")}</Link><Link className={!onlyNew ? "btn-dark" : "btn-outline"} href={filterQuery({ ...filters, onlyNew: false })} aria-current={!onlyNew ? "page" : undefined}>{tr(lang, "Все", "Барлығы")}</Link></nav>
      <form method="get" role="search" className="flex flex-col gap-3 px-5 pb-3">
        <input type="hidden" name="status" value={onlyNew ? "new" : "all"} />
        <label htmlFor="orders-q" className="sr-only">{tr(lang, "Поиск по номеру, имени или телефону", "Нөмір, аты немесе телефон бойынша іздеу")}</label>
        <input id="orders-q" name="q" type="search" defaultValue={filters.q} placeholder={tr(lang, "Номер, имя или телефон", "Нөмір, аты немесе телефон")} maxLength={40} enterKeyHint="search" autoComplete="off" className="input" />
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Field label={shop.booking_mode ? tr(lang, "Желаемая дата", "Қалаулы күн") : tr(lang, "Когда нужно", "Қашан керек")} htmlFor="orders-date"><input id="orders-date" name="date" type="date" defaultValue={filters.date} className="input" /></Field>
          </div>
          <button type="submit" className="btn-dark h-12 min-h-12 shrink-0 px-5">{tr(lang, "Найти", "Іздеу")}</button>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm">
          {filtered ? <Link href={filterQuery({ ...filters, q: "", date: "" })} className="flex min-h-11 items-center font-semibold underline">{tr(lang, "Сбросить поиск", "Іздеуді тазалау")}</Link> : <span />}
          <a href={`/dashboard/orders/export${filterQuery(filters)}`} className="flex min-h-11 items-center font-semibold underline">{tr(lang, "Скачать CSV", "CSV жүктеу")}</a>
        </div>
      </form>
      <ul className="flex flex-col gap-3 px-5">
        {orders.length === 0 && (
          <li>
            <EmptyState
              icon={<CartIcon size={24} />}
              title={filtered ? tr(lang, "Ничего не найдено", "Ештеңе табылмады") : tr(lang, "Пока нет заказов", "Әзірге тапсырыс жоқ")}
              description={filtered ? tr(lang, "Проверьте номер, имя или дату, либо сбросьте поиск.", "Нөмірді, атын немесе күнді тексеріңіз не іздеуді тазалаңыз.") : tr(lang, "Отправьте ссылку на магазин клиентам или поставьте её в био Instagram.", "Дүкен сілтемесін клиенттерге жіберіңіз немесе Instagram профиліне қойыңыз.")}
              action={filtered ? undefined : <Link href="/dashboard" className="btn-outline">{tr(lang, "К ссылке магазина", "Дүкен сілтемесіне")}</Link>}
            />
          </li>
        )}
        {orders.map((o) => {
          const st = STATUS[o.status];
          const text = shop.booking_mode
            ? `Здравствуйте, ${o.customer_name}! Ваша запись №${o.number} в «${shop.name}»`
            : `Здравствуйте, ${o.customer_name}! Ваш заказ №${o.number} на ${formatPrice(o.total)} из магазина «${shop.name}»`;
          return (
            <li key={o.id} className="card flex flex-col gap-2.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-lead font-bold">
                  №{o.number} · {o.customer_name}
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${st.cls}`}>{tr(lang, st.label[0], st.label[1])}</span>
              </div>
              <ul className="text-sm leading-snug text-muted">
                {o.items.map((i, idx) => (
                  <li key={idx}>
                    {shop.booking_mode ? i.title : `${i.title} × ${i.qty}`}
                  </li>
                ))}
              </ul>
              <div className="text-sm text-muted">
                {o.address === "Запись" ? null : o.address === "Самовывоз" ? tr(lang, "Самовывоз", "Өзі алып кету") : o.address ? `${tr(lang, "Доставка", "Жеткізу")}: ${o.address}` : null}
              </div>
              {o.needed_date && (
                <div className="text-sm font-semibold text-ink">{shop.booking_mode ? tr(lang, "Желаемое время", "Қалаулы уақыт") : tr(lang, "Когда нужно", "Қашан керек")}: {formatNeeded(o.needed_date, o.needed_time)}</div>
              )}
              {o.comment && <div className="text-sm text-muted">{tr(lang, "Комментарий", "Түсініктеме")}: {o.comment}</div>}
              <div className="text-sm text-muted">
                {o.customer_phone.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5")} · {fmt.format(new Date(o.created_at))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="text-xl font-extrabold">{formatPrice(o.total)}</div>
                <a href={whatsappUrl(o.customer_phone, text)} target="_blank" rel="noopener noreferrer" className="btn-wa h-11 min-h-11 rounded-[10px] px-3.5 text-sm">
                  {tr(lang, "Написать клиенту", "Клиентке жазу")}
                </a>
              </div>
              {o.status === "new" && (
                <div className="flex gap-2 border-t border-line pt-2.5">
                  <StatusButton id={o.id} status="done">
                    {tr(lang, "Выполнен", "Орындалды")}
                  </StatusButton>
                  <StatusButton id={o.id} status="cancelled" muted confirmText={tr(lang, `Отменить заказ №${o.number}? Его можно будет вернуть в «Новые».`, `№${o.number} тапсырыстан бас тарту керек пе? Оны «Жаңалар» бөліміне қайтаруға болады.`)}>
                    {tr(lang, "Отменить", "Бас тарту")}
                  </StatusButton>
                </div>
              )}
              {o.status !== "new" && (
                <div className="flex gap-2 border-t border-line pt-2.5">
                  <StatusButton id={o.id} status="new" muted>
                    {tr(lang, "Вернуть в «Новые»", "«Жаңаларға» қайтару")}
                  </StatusButton>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {hasMore && <Link className="btn-outline m-5" href={filterQuery(filters, { page: String(page + 1) })}>{tr(lang, "Показать ещё", "Тағы көрсету")}</Link>}
      <DashboardNav active="orders" newOrders={newCount} />
    </main>
  );
}

