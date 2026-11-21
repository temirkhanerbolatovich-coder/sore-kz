"use client";

import Link from "next/link";
import { useTr } from "@/components/ui-lang";

type Step = { done: boolean; title: string; text: string; href?: string; cta?: string };

/** Подсказка «Первые шаги» для нового продавца: показывается, пока что-то из списка не сделано. */
export function FirstSteps({ hasProducts, shared, telegram, profileDone }: { hasProducts: boolean; shared: boolean; telegram: "off" | "pending" | "done"; profileDone: boolean }) {
  const tr = useTr();
  const steps: Step[] = [
    { done: hasProducts, title: tr("Добавьте первый товар", "Алғашқы тауарды қосыңыз"), text: tr("Выберите способ в блоке выше: ИИ составит описание по фото.", "Жоғарыдағы блоктан тәсілді таңдаңыз: ЖИ фото бойынша сипаттама жасайды.") },
    { done: profileDone, title: tr("Добавьте логотип и описание", "Логотип пен сипаттама қосыңыз"), text: tr("Витрина с фото и парой слов о вас вызывает больше доверия, чем пустой круг с буквой.", "Фотосы мен өзіңіз туралы бірер сөзі бар витрина әріпті бос шеңберден гөрі көбірек сенім тудырады."), href: "/dashboard/settings", cta: tr("Открыть настройки", "Баптауларды ашу") },
    { done: shared, title: tr("Поделитесь ссылкой", "Сілтемемен бөлісіңіз"), text: tr("Поставьте ссылку в био Instagram или отправьте клиентам. Скопируйте её в карточке магазина.", "Сілтемені Instagram профиліне қойыңыз немесе клиенттерге жіберіңіз. Оны дүкен карточкасынан көшіріңіз.") },
    ...(telegram === "off" ? [] : [{ done: telegram === "done", title: tr("Подключите Telegram", "Telegram қосыңыз"), text: tr("Заказы будут приходить вам сообщением.", "Тапсырыстар сізге хабарлама болып келеді."), href: "/dashboard/settings", cta: tr("Подключить", "Қосу") }]),
  ];
  if (steps.every((s) => s.done)) return null;

  const completed = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  return (
    <section className="card mx-5 mt-3 flex flex-col gap-3 p-4" aria-labelledby="first-steps">
      <h2 id="first-steps" className="text-lg font-bold">
        {tr("Первые шаги", "Алғашқы қадамдар")}
      </h2>
      <label htmlFor="first-steps-progress" className="text-sm text-muted">{tr("Выполнено", "Орындалды")} {completed} {tr("из", "/")} {steps.length}</label>
      <progress id="first-steps-progress" value={completed} max={steps.length} className="h-2 w-full accent-[var(--accent)]" />
      <p className="text-sm font-semibold">{tr("Далее", "Әрі қарай")}: {next?.title}</p>
      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-6 flex-none items-center justify-center rounded-full text-sm font-extrabold ${s.done ? "bg-wa text-on-accent" : "border-2 border-field text-transparent"}`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-semibold ${s.done ? "text-muted line-through" : ""}`}>
                {s.title}
                {s.done && <span className="sr-only"> — {tr("сделано", "орындалды")}</span>}
              </div>
              {!s.done && <p className="text-[14px] leading-snug text-muted">{s.text}</p>}
              {!s.done && s.href && (
                <Link href={s.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-accent underline">
                  {s.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
