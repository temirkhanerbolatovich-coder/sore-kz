// Тексты бота SÖRE. Формат HTML (parse_mode: "HTML"): всё, что пришло от людей и ИИ, только через escapeHtml.
import { formatPrice } from "@/lib/order";
import { escapeHtml as esc } from "@/lib/telegram";
import type { DraftItem } from "@/lib/bot/drafts";

export const BOT_NAME = "SÖRE";

export const WELCOME_TEXT = [
  "👋 <b>Сәлеметсіз бе! Здравствуйте!</b>",
  "",
  `Я — бот <b>${BOT_NAME}</b>. Пришлите фото полки или стола с товарами: ИИ найдёт товары, вырежет фото каждого и напишет карточки на русском и казахском. Вы отметите нужные, и они появятся на витрине. Заказы тоже будут приходить сюда.`,
  "",
  `Мен — <b>${BOT_NAME}</b> боты. Сөренің немесе үстелдегі тауарлардың суретін жіберіңіз: ЖИ тауарларды тауып, әрқайсысының суретін қиып, орыс және қазақ тілдерінде карточка жазады. Қажеттілерін белгілесеңіз, олар витринада пайда болады. Тапсырыстар да осында келеді.`,
].join("\n");

export const NOT_LINKED_TEXT = [
  "Этот чат ещё не подключён к магазину.",
  "Откройте кабинет на сайте → «Магазин» → «Подключить Telegram» и нажмите Start по ссылке.",
  "",
  "Бұл чат әлі дүкенге қосылмаған. Сайттағы кабинетте «Магазин» → «Подключить Telegram» басыңыз.",
].join("\n");

export const HELP_TEXT = [
  "📸 <b>Пришлите фото полки</b>: ИИ найдёт до 12 товаров, вы отметите нужные и опубликуете.",
  "📥 <b>Пришлите прайс .xlsx или .csv</b> документом: товары загрузятся, по артикулу обновятся.",
  "",
  "/shop — ссылка на витрину, QR-код и кабинет",
  "/login — войти в кабинет одной кнопкой, без почты",
  "/orders — последние 5 заказов, отметить выполненные",
  "/import — шаблон прайса и правила",
  "/stop — отключить бота и уведомления",
  "/help — эта справка",
].join("\n");

export const IMPORT_HELP_TEXT = [
  "📥 <b>Прайс из Excel или CSV</b>",
  "Пришлите файл <b>.xlsx</b> или <b>.csv</b> документом, до 4 МБ и 2000 строк.",
  "Обязательно: <b>Название</b> и <b>Цена</b>. По желанию: Артикул, Категория, Описание, Описание (каз), Количество.",
  "",
  "С артикулом повторная загрузка обновляет товары, а не дублирует их. Цена 0 означает «по запросу».",
  "Строки с ошибками пропускаются, их список пришлю файлом. Шаблон ниже.",
].join("\n");

/** Меню команд (кнопка «Меню» в Telegram). Ставит npm run telegram:setup. */
export const BOT_COMMANDS = [
  { command: "start", description: "Начать" },
  { command: "shop", description: "Витрина, QR-код и кабинет" },
  { command: "login", description: "Войти в кабинет" },
  { command: "orders", description: "Последние заказы" },
  { command: "import", description: "Загрузить прайс из Excel/CSV" },
  { command: "help", description: "Помощь" },
  { command: "stop", description: "Отключить бота" },
];

const PROGRESS_STEPS = ["Получил фото", "ИИ ищет товары", "Вырезаю фото товаров", "Готовлю черновики"] as const;
export const PROGRESS_STEP_COUNT = PROGRESS_STEPS.length;

/** Сообщение прогресса: пройденные шаги ✅, текущий ⏳, остальные ▫️. */
export function renderProgressText(activeStep: number): string {
  const lines = PROGRESS_STEPS.map((step, index) => {
    if (index < activeStep) return `✅ ${step}`;
    return index === activeStep ? `⏳ <b>${step}…</b>` : `▫️ ${step}`;
  });
  return ["🔍 <b>Смотрю на полку…</b>", "", ...lines].join("\n");
}

export function pluralProducts(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "товаров";
  if (last === 1) return "товар";
  return last >= 2 && last <= 4 ? "товара" : "товаров";
}

const itemPrice = (item: DraftItem) =>
  item.price_hint ? `${formatPrice(item.price_hint)} <i>(с ценника, проверьте)</i>` : "цена по запросу";

/** Черновики с фото полки: список с отметками. Кнопки под ним собирает draftKeyboard. */
export function formatDraft(items: DraftItem[], remaining: number | null): string {
  const selected = items.filter((i) => i.selected).length;
  const lines = items.map((item, index) => `${item.selected ? "✅" : "⬜️"} ${index + 1}. ${esc(item.title)} — ${itemPrice(item)}`);
  return [
    `🧺 <b>На фото ${items.length} ${pluralProducts(items.length)}</b>`,
    "Нажмите на номер, чтобы убрать товар или вернуть его, затем «Опубликовать».",
    "",
    ...lines,
    "",
    `Выбрано: <b>${selected}</b>. Цены без ценника ставлю «по запросу», поменять их можно в кабинете.`,
    remaining !== null ? `Попыток ИИ на сегодня осталось: ${remaining}.` : "",
  ]
    .filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== ""))
    .join("\n");
}

export function formatShopCaption(shopName: string, storefrontUrl: string): string {
  return [
    `🏪 <b>${esc(shopName)}</b>`,
    "",
    "🛍 Витрина для покупателей:",
    esc(storefrontUrl),
    "",
    "Распечатайте QR-код или отправьте ссылку покупателям. 📸 Пришлите фото полки, чтобы добавить товары.",
  ].join("\n");
}

export type OrderForList = {
  number: number;
  created_at: string;
  customer_name: string;
  total: number;
  status: string;
  items: { title: string; qty: number }[];
};

const STATUS_LABEL: Record<string, string> = { new: "🆕 новый", done: "✅ выполнен", cancelled: "✖️ отменён" };

export function formatOrdersList(orders: OrderForList[]): string {
  if (orders.length === 0) return "📦 Заказов пока нет. Отправьте покупателям ссылку или QR-код: /shop";
  const blocks = orders.map((order) => {
    const time = new Date(order.created_at).toLocaleString("ru-RU", {
      timeZone: "Asia/Almaty",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const items = order.items.map((item) => `${esc(item.title)} × ${item.qty}`).join(", ");
    return [
      `<b>№${order.number}</b> · ${time} · ${esc(order.customer_name)} · ${STATUS_LABEL[order.status] ?? esc(order.status)}`,
      `   ${items} — <b>${formatPrice(order.total)}</b>`,
    ].join("\n");
  });
  return ["📦 <b>Последние заказы</b>", ...blocks].join("\n\n");
}

export function formatImportSummary(fileName: string, r: { created: number; updated: number; skipped: number; total: number }): string {
  return [
    `✅ <b>Прайс «${esc(fileName)}» загружен</b>`,
    "",
    `Новых: <b>${r.created}</b>, обновлено: <b>${r.updated}</b>, пропущено: <b>${r.skipped}</b> из ${r.total}`,
    r.skipped > 0 ? "Строки с ошибками в файле ниже." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
