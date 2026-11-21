"use client";

import Link from "next/link";
import { useTr } from "@/components/ui-lang";

/** Второй шаг после создания магазина; запись магазина остаётся прежней. */
export function AddProducts() {
  const tr = useTr();
  return <section className="card mx-5 mt-4 p-4" aria-labelledby="add-products">
    <p className="text-sm text-muted">{tr("Шаг 2 из 2", "2 қадамның 2-сі")}</p>
    <h2 id="add-products" className="mt-1 text-xl font-bold">{tr("Как добавить товары?", "Тауарды қалай қосу керек?")}</h2>
    <p className="mt-2 text-sm text-muted">{tr("Выберите удобный способ. Время зависит от числа товаров и проверки цен.", "Ыңғайлы тәсілді таңдаңыз. Уақыт тауар санына және бағаны тексеруге байланысты.")}</p>
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {([
        ["shelf", ["Фото полки", "Сөре суреті"], ["Один снимок для нескольких товаров. После распознавания проверьте каждую карточку.", "Бір сурет бірнеше тауарға. Танығаннан кейін әр карточканы тексеріңіз."]],
        ["import", ["Прайс из Excel", "Excel прайсы"], ["Загрузите готовый файл и проверьте отчёт. Подготовка таблицы может занять больше времени.", "Дайын файлды жүктеп, есепті тексеріңіз. Кестені дайындау көбірек уақыт алуы мүмкін."]],
        ["new", ["По одному", "Бір-бірден"], ["Добавьте фото, название и цену. Удобно начать с одного товара.", "Фото, атауы және бағасын қосыңыз. Бір тауардан бастаған ыңғайлы."]],
      ] as [string, [string, string], [string, string]][]).map(([path, title, text]) => <Link key={path} href={`/dashboard/products/${path}`} className="rounded-xl border border-field p-4 hover:bg-accent-soft">
        <span className="block font-bold">{tr(title[0], title[1])}</span><span className="mt-2 block text-sm text-muted">{tr(text[0], text[1])}</span>
      </Link>)}
    </div>
  </section>;
}
