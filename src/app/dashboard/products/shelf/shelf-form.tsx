"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useStatefulAction } from "@/lib/use-stateful-action";
import { createClient } from "@/lib/supabase/client";
import { uploadProductPhoto } from "@/lib/image";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import type { BBox } from "@/lib/bbox";
import { shelfReviewReason } from "@/lib/shelf-review";
import { ShelfFrames } from "@/components/shelf-frames";
import { AiIcon, CameraIcon, CheckIcon } from "@/components/icons";
import { discardShelf, saveShelf, type ShelfState } from "./actions";
import { useTr } from "@/components/ui-lang";

type Draft = {
  key: number;
  photoUrl: string | null;
  title: string;
  descRu: string;
  descKz: string;
  category: string;
  mode: "fixed" | "request";
  price: string;
  review: boolean;
  bbox: BBox;
  selected: boolean;
};

type ApiItem = {
  title: string;
  description_ru: string;
  description_kz: string;
  category: string;
  bbox: BBox;
  price_hint: number | null;
  photo_url: string | null;
};

type Phase = "pick" | "upload" | "ai" | "drafts";

const initial: ShelfState = {};

/** Одно фото полки → ИИ находит товары → продавец правит черновики → публикует выбранные. */
export function ShelfForm({ slots }: { slots: number }) {
  const tr = useTr();
  const [state, onSubmit, saving] = useStatefulAction(saveShelf, initial);
  const [phase, setPhase] = useState<Phase>("pick");
  const [source, setSource] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [message, setMessage] = useState("");
  const [highlighted, setHighlighted] = useState<number>();
  const cards = useRef<(HTMLLIElement | null)[]>([]);
  const prices = useRef<(HTMLInputElement | null)[]>([]);
  const framesRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  useUnsavedGuard(phase !== "pick" && !saving);

  const selectedCount = drafts.filter((d) => d.selected).length;
  const patch = (key: number, change: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...change } : d)));

  function focusCard(index: number) {
    setHighlighted(index);
    cards.current[index]?.scrollIntoView({ block: "center" });
    cards.current[index]?.focus({ preventScroll: true });
  }

  function focusFrame(index: number) {
    setHighlighted(index);
    framesRef.current?.scrollIntoView({ block: "center" });
    framesRef.current?.querySelectorAll("button")[index]?.focus({ preventScroll: true });
  }

  function selectAll(selected: boolean) {
    setMessage(selected && drafts.length > slots ? tr(`Выбраны первые ${slots}: больше не позволяет лимит.`, `Алғашқы ${slots} таңдалды: шек көбірек қосуға рұқсат бермейді.`) : "");
    setDrafts((list) => list.map((draft, index) => ({ ...draft, selected: selected && index < slots })));
  }

  function nextPrice(event: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!drafts[index + 1]) return;
    setHighlighted(index + 1);
    (prices.current[index + 1] ?? cards.current[index + 1]?.querySelector("input"))?.focus();
  }

  function reset() {
    setHighlighted(undefined);
    setPhase("pick");
    setSource("");
    setDrafts([]);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setMessage("");
    setPhase("upload");
    let uploaded = "";
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      uploaded = await uploadProductPhoto(supabase, user.id, file);
      setSource(uploaded);
    } catch {
      setPhase("pick");
      setMessage(tr("Фото не загрузилось. Проверьте интернет и попробуйте ещё раз.", "Фото жүктелмеді. Интернетті тексеріп, қайталап көріңіз."));
      return;
    }

    setPhase("ai");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ai/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_url: uploaded }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as { items?: ApiItem[]; error?: string };
      if (!res.ok || !json.items?.length) throw new Error(json.error || tr("Не удалось найти товары на фото.", "Фотодан тауарларды табу мүмкін болмады."));
      let left = slots;
      setDrafts(
        json.items.map((item, i) => {
          const selected = left > 0;
          if (selected) left--;
          return {
            key: i,
            photoUrl: item.photo_url,
            title: item.title,
            descRu: item.description_ru,
            descKz: item.description_kz,
            category: item.category,
            mode: item.price_hint ? "fixed" : "request",
            price: item.price_hint ? String(item.price_hint) : "",
            review: Boolean(item.price_hint),
            bbox: item.bbox,
            selected,
          };
        }),
      );
      setPhase("drafts");
    } catch (error) {
      if (controller.signal.aborted) return;
      await discardShelf([uploaded]).catch(() => undefined);
      reset();
      setMessage(error instanceof Error ? error.message : tr("Не удалось найти товары на фото.", "Фотодан тауарларды табу мүмкін болмады."));
    } finally {
      abortRef.current = null;
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    const files = [source, ...drafts.map((d) => d.photoUrl)].filter((u): u is string => Boolean(u));
    reset();
    setMessage("");
    if (files.length) await discardShelf(files).catch(() => undefined);
  }

  function toggle(draft: Draft) {
    if (!draft.selected && selectedCount >= slots) {
      setMessage(tr(`На бесплатном тарифе можно добавить ещё ${slots}. Снимите галочку с другого товара.`, `Тегін тарифте тағы ${slots} тауар қосуға болады. Басқа тауардан белгіні алып тастаңыз.`));
      return;
    }
    setMessage("");
    patch(draft.key, { selected: !draft.selected });
  }

  const chosen = drafts.filter((d) => d.selected);
  const invalid = chosen.length === 0 || chosen.some((d) => !d.title.trim() || (d.mode === "fixed" && !(Number(d.price) > 0)));
  const payload = JSON.stringify({
    source_photo_url: source,
    items: chosen.map((d) => ({
      photo_url: d.photoUrl,
      title: d.title,
      description_ru: d.descRu,
      description_kz: d.descKz,
      category: d.category,
      price_mode: d.mode,
      price: d.mode === "fixed" ? d.price : 0,
      bbox: d.bbox,
      price_needs_review: d.review,
    })),
    discard: drafts.filter((d) => !d.selected && d.photoUrl).map((d) => d.photoUrl),
  });

  const working = phase === "upload" || phase === "ai";

  return (
    <form id="main-content" tabIndex={-1} onSubmit={onSubmit} className="flex flex-1 flex-col">
      <input type="hidden" name="payload" value={payload} />
      <div className="flex flex-1 flex-col gap-4 p-5">
        {slots === 0 ? (
          <p className="card p-4 text-body leading-relaxed text-muted">
            {tr("Бесплатный лимит товаров исчерпан. Удалите ненужные позиции, чтобы добавить новые.", "Тегін тауар шегі таусылды. Жаңаларын қосу үшін қажетсіз позицияларды жойыңыз.")}
          </p>
        ) : phase === "pick" ? (
          <>
            <div className="card icon-host flex flex-col items-center gap-3 p-6 text-center">
              <div className="icon-badge">
                <CameraIcon size={24} />
              </div>
              <p className="text-lg font-bold">{tr("Одно фото — сразу несколько товаров", "Бір фото — бірден бірнеше тауар")}</p>
              <p className="text-body leading-relaxed text-muted">
                {tr(`Сфотографируйте полку или витрину целиком. ИИ найдёт до 12 товаров, вырежет фото каждого и напишет названия на русском и казахском. Вы проверите и выберете, что выложить. Можно добавить ещё ${slots}.`, `Сөрені немесе витринаны түгел суретке түсіріңіз. ЖИ 12 тауарға дейін тауып, әрқайсысының фотосын қиып, орыс және қазақ тілінде атауларын жазады. Сіз тексеріп, нені шығаратыныңызды таңдайсыз. Тағы ${slots} тауар қосуға болады.`)}
              </p>
            </div>
            <input ref={fileRef} id="shelf-file" type="file" accept="image/*" className="sr-only" onChange={onFile} />
            <label htmlFor="shelf-file" className="btn-accent h-14 w-full cursor-pointer text-lg">
              <CameraIcon />
              {message ? tr("Снять заново", "Қайта түсіру") : tr("Сфотографировать полку", "Сөрені суретке түсіру")}
            </label>
          </>
        ) : working ? (
          <div role="status" className="card flex flex-col items-center gap-3 p-6 text-center">
            <div className="icon-badge">
              <AiIcon size={24} />
            </div>
            <ol className="flex flex-wrap gap-3 text-sm" aria-label={tr("Этапы подготовки", "Дайындау кезеңдері")}>
              <li aria-current={phase === "upload" ? "step" : undefined}>{tr("1. Загрузка фото", "1. Фотоны жүктеу")}</li>
              <li aria-current={phase === "ai" ? "step" : undefined}>{tr("2. Поиск товаров", "2. Тауарларды іздеу")}</li>
              <li>{tr("3. Проверка и публикация", "3. Тексеру және жариялау")}</li>
            </ol>
            <p className="text-lg font-bold">{phase === "upload" ? tr("Загружаем фото…", "Фото жүктелуде…") : tr("Ищем товары на полке…", "Сөредегі тауарларды іздеудеміз…")}</p>
            <p className="text-body text-muted">{phase === "ai" ? tr("Обычно это 10–30 секунд. Не закрывайте страницу.", "Әдетте бұл 10–30 секунд алады. Бетті жаппаңыз.") : tr("Сжимаем фото прямо на телефоне.", "Фото телефонның өзінде сығылуда.")}</p>
            {source && <ShelfFrames src={source} alt={tr("Фото полки", "Сөре фотосы")} frames={[]} className="mt-2 w-full opacity-70" />}
          </div>
        ) : (
          <>
            <div ref={framesRef} className="scroll-mt-6">
            <ShelfFrames
              highlighted={highlighted}
              onSelect={focusCard}
              goLabel={tr("Перейти к товару", "Тауарға өту")}
              src={source}
              alt={tr("Фото полки с найденными товарами", "Табылған тауарлары бар сөре фотосы")}
              frames={drafts.map((d, i) => ({ bbox: d.bbox, label: String(i + 1), active: d.selected }))}
            />
            </div>
            <p role="status" className="text-body leading-relaxed text-muted">
              {tr(`Нашли товаров: ${drafts.length}. Выбрано ${selectedCount} из ${drafts.length}, места: ${slots}. Проверьте названия и цены.`, `Табылған тауар: ${drafts.length}. Таңдалды ${selectedCount}/${drafts.length}, орын: ${slots}. Атаулар мен бағаны тексеріңіз.`)}
            </p>
          </>
        )}

        {message && phase === "pick" && <Link href="/dashboard/products/new" className="btn-outline">{tr("Добавить вручную", "Қолмен қосу")}</Link>}
        {message && (
          <p role="status" className="text-sm font-semibold text-accent-dark">
            {message}
          </p>
        )}

        {phase === "drafts" && (
          <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-outline" onClick={() => selectAll(true)}>{tr("Выбрать все", "Барлығын таңдау")}</button>
            <button type="button" className="btn-outline" onClick={() => selectAll(false)}>{tr("Снять все", "Барлығын алып тастау")}</button>
          </div>
          <ul className="flex flex-col gap-3">
            {drafts.map((d, index) => (
              <li
                key={d.key}
                tabIndex={-1}
                ref={(node) => { cards.current[index] = node; }}
                className={`card rise-in flex flex-col gap-3 p-3 ${highlighted === index ? "ring-2 ring-[var(--focus)]" : ""} ${d.selected ? "" : "border-dashed"}`}
                style={{ "--rise-index": Math.min(index, 11) } as CSSProperties}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={d.selected}
                    aria-label={`${tr("Выложить товар", "Тауарды шығару")} ${index + 1}`}
                    onClick={() => toggle(d)}
                    className={`flex size-11 flex-none items-center justify-center rounded-xl border-2 ${d.selected ? "border-accent bg-accent text-on-accent" : "border-field text-transparent"}`}
                  >
                    <CheckIcon size={22} />
                  </button>
                  <div className="relative size-20 flex-none overflow-hidden rounded-xl bg-thumb">
                    {d.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photoUrl} alt={`${tr("Товар", "Тауар")} ${index + 1}`} className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-xs text-muted">{tr("без вырезки", "қиюсыз")}</span>
                    )}
                    <button type="button" aria-label={`${tr("Показать рамку", "Жақтауды көрсету")} ${index + 1}`} aria-pressed={highlighted === index} onClick={() => focusFrame(index)} className="absolute left-0 top-0 min-h-11 min-w-11 rounded-full bg-accent px-1.5 text-center text-sm font-extrabold text-on-accent">
                      {index + 1}
                    </button>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      aria-label={`${tr("Название", "Атауы")} ${index + 1}`}
                      placeholder={tr("Название", "Атауы")}
                      maxLength={120}
                      value={d.title}
                      onChange={(e) => patch(d.key, { title: e.target.value })}
                      className="input h-11"
                    />
                    <input
                      aria-label={`${tr("Категория", "Санат")} ${index + 1}`}
                      placeholder={tr("Категория", "Санат")}
                      maxLength={60}
                      value={d.category}
                      onChange={(e) => patch(d.key, { category: e.target.value })}
                      className="input h-11 text-sm"
                    />
                    {(() => {
                      const reason = shelfReviewReason(d);
                      return reason ? (
                        <span role="note" className="w-fit rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-dark">
                          {tr("Проверьте", "Тексеріңіз")}: {{ "название": tr("название", "атауы"), "категория": tr("категория", "санат"), "снимок товара": tr("снимок товара", "тауар суреті") }[reason] ?? reason}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-2" role="group" aria-label={`${tr("Цена", "Баға")} ${index + 1}`}>
                    {(
                      [
                        ["request", tr("По запросу", "Сұраныс бойынша")],
                        ["fixed", tr("Точная", "Нақты")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={d.mode === value}
                        onClick={() => patch(d.key, { mode: value })}
                        className={`min-h-11 rounded-xl text-sm font-bold ${d.mode === value ? "bg-ink text-cream" : "border-[1.5px] border-field"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {d.mode === "fixed" && (
                    <input
                      ref={(node) => { prices.current[index] = node; }}
                      onKeyDown={(event) => nextPrice(event, index)}
                      aria-label={`${tr("Цена", "Баға")} ${index + 1}, ₸`}
                      placeholder="₸"
                      inputMode="numeric"
                      value={d.price}
                      onChange={(e) => patch(d.key, { price: e.target.value.replace(/\D/g, ""), review: false })}
                      className="input h-11 w-28 flex-none"
                    />
                  )}
                </div>
                {d.review && d.mode === "fixed" && (
                  <p className="text-caption font-semibold text-accent-dark">{tr("Цену прочитали с ценника — проверьте её.", "Бағаны бағалық белгіден оқыдық — тексеріңіз.")}</p>
                )}
              </li>
            ))}
          </ul>
          </div>
        )}

        {state.error && (
          <p role="alert" tabIndex={-1} ref={(node) => node?.focus()} className="text-sm font-semibold text-accent-dark">
            {state.error}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-surface p-5">
        {phase === "drafts" && (
          <>
            <button type="submit" disabled={saving || invalid} className="btn-accent h-14 w-full text-lg disabled:opacity-60">
              {saving ? tr("Публикуем…", "Жарияланып жатыр…") : `${tr("Опубликовать выбранные", "Таңдалғандарды жариялау")} (${selectedCount})`}
            </button>
            {invalid && selectedCount > 0 && (
              <p className="text-center text-caption text-muted">{tr("Укажите название у каждого выбранного товара и цену там, где выбрана «Точная».", "Әрбір таңдалған тауарға атау, ал «Нақты» таңдалған жерге баға көрсетіңіз.")}</p>
            )}
          </>
        )}
        {phase === "pick" ? (
          <Link href="/dashboard" className="btn-outline h-12 w-full">
            {tr("Назад", "Артқа")}
          </Link>
        ) : (
          <button type="button" onClick={() => void cancel()} disabled={saving} className="btn-outline h-12 w-full">
            {tr("Отмена", "Бас тарту")}
          </button>
        )}
      </div>
    </form>
  );
}
