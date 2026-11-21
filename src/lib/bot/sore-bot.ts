// Telegram-бот SÖRE для продавца (grammY). Бот тонкий: принимает апдейты и вызывает модули src/lib/bot.
// Магазин всегда ищется по chat_id (shop_telegram), это и есть проверка владельца (docs/BOT_CONTRACT.md).
// Команды разбираются по тексту, а не по entities: так их понимают и тестовые апдейты без разметки.
import { Bot, InputFile, type Api, type Context } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import QRCode from "qrcode";
import { BOT_LOGO_PATH } from "@/lib/brand";
import { catalogTemplateXlsx } from "@/lib/catalog-template";
import { importCatalogFromBot, precheckCatalog } from "@/lib/bot/catalog";
import { botLoginSecret, createLoginLink } from "@/lib/bot/login";
import { draftKeyboard, orderActionData, parseAction, type InlineKeyboard } from "@/lib/bot/drafts";
import { recentOrders, setOrderStatusFromChat } from "@/lib/bot/orders";
import { createShelfDraft, discardDraft, publishDraft, toggleDraftItem } from "@/lib/bot/shelf";
import { admin, chatRateKey, findLinkedShop, linkByCode, siteUrl, storefrontUrl, unlinkChat, type LinkedShop } from "@/lib/bot/shop-link";
import {
  BOT_NAME,
  formatDraft,
  formatImportSummary,
  formatOrdersList,
  formatShopCaption,
  HELP_TEXT,
  IMPORT_HELP_TEXT,
  NOT_LINKED_TEXT,
  pluralProducts,
  renderProgressText,
  WELCOME_TEXT,
} from "@/lib/bot/texts";
import { MAX_PHOTO_BYTES } from "@/lib/photos";
import { checkRateLimit } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/telegram";

export type SoreBotOptions = {
  /**
   * Как запустить долгую работу (ИИ, вырезки), не задерживая ответ Telegram.
   * Вебхук на Vercel: after() из next/server. Локальный polling: просто запустить промис.
   */
  runInBackground?: (task: () => Promise<void>) => void;
};

const runDetached = (task: () => Promise<void>) => {
  void task().catch((error: unknown) => console.error("[bot] Фоновая задача упала:", error instanceof Error ? error.message : error));
};

/** /start, /start@sore_bot КОД и т. п. Группа 1: аргумент команды. */
const command = (name: string) => new RegExp(`^/${name}(?:@\\w+)?(?:\\s+([\\s\\S]*))?$`, "i");
const LINK_CODE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Без getMe при каждом холодном старте: данные бота известны из настроек.
 * id берётся из токена («123456:ABC…»); у тестового токена его нет, тогда 0 — боту он не нужен.
 */
export function staticBotInfo(token: string, username = process.env.TELEGRAM_BOT_USERNAME): UserFromGetMe | undefined {
  if (!username) return undefined;
  const prefix = token.split(":")[0];
  const id = /^\d+$/.test(prefix) && Number.isSafeInteger(Number(prefix)) ? Number(prefix) : 0;
  return {
    id,
    is_bot: true,
    first_name: BOT_NAME,
    username,
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  } as UserFromGetMe;
}

/** Скачивание файла из Telegram по file_id. Токен в логи не попадает. */
async function downloadFile(api: Api, token: string, fileId: string, maxBytes: number): Promise<Buffer | null> {
  const file = await api.getFile(fileId);
  if (!file.file_path || (file.file_size ?? 0) > maxBytes) return null;
  const base = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
  const res = await fetch(`${base}/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const data = Buffer.from(await res.arrayBuffer());
  return data.length <= maxBytes ? data : null;
}

export function createSoreBot(token: string, options: SoreBotOptions = {}): Bot {
  const bot = new Bot(token, {
    botInfo: staticBotInfo(token),
    client: process.env.TELEGRAM_API_BASE ? { apiRoot: process.env.TELEGRAM_API_BASE } : undefined,
  });
  const runInBackground = options.runInBackground ?? runDetached;

  // Только личные чаты: группы и каналы молча игнорируем.
  const chat = bot.chatType("private");

  // Лимит на чат: бота нельзя заспамить (30 апдейтов в минуту).
  chat.use(async (ctx, next) => {
    if ((await checkRateLimit(chatRateKey(ctx.chat.id), 60, 30)) === 429) {
      if (ctx.callbackQuery) await ctx.answerCallbackQuery({ text: "Слишком часто. Подождите минуту." }).catch(() => undefined);
      return;
    }
    await next();
  });

  async function requireShop(ctx: Context): Promise<LinkedShop | null> {
    const shop = ctx.chat ? await findLinkedShop(admin(), ctx.chat.id) : null;
    if (!shop) await ctx.reply(NOT_LINKED_TEXT, { reply_markup: cabinetButton("/dashboard/settings", "Открыть кабинет") });
    return shop;
  }

  function cabinetButton(path: string, text: string) {
    return siteUrl().startsWith("https://") ? { inline_keyboard: [[{ text, url: `${siteUrl()}${path}` }]] } : undefined;
  }

  async function sendShop(ctx: Context, shop: LinkedShop) {
    const url = storefrontUrl(shop.slug);
    const qr = await QRCode.toBuffer(url, { width: 640, margin: 2, errorCorrectionLevel: "M" });
    const https = url.startsWith("https://");
    await ctx.replyWithPhoto(new InputFile(qr, `sore-qr-${shop.slug}.png`), {
      caption: formatShopCaption(shop.name, url),
      parse_mode: "HTML",
      reply_markup: https
        ? {
            inline_keyboard: [
              [{ text: "🛍 Открыть витрину", url }],
              [
                // С BOT_LOGIN_SECRET кнопка входит в кабинет без почты: ссылку выдаём только по нажатию.
                botLoginSecret() ? { text: "🔑 Войти в кабинет", callback_data: "login" } : { text: "⚙️ Кабинет", url: `${siteUrl()}/dashboard` },
                { text: "🖨 QR-плакат", url: `${siteUrl()}/dashboard/poster` },
              ],
            ],
          }
        : undefined,
    });
  }

  // ---------- Команды ----------

  chat.hears(command("start"), async (ctx) => {
    const arg = ctx.match[1]?.trim() ?? "";
    const db = admin();
    if (LINK_CODE.test(arg)) {
      const name = await linkByCode(db, ctx.chat.id, arg);
      if (name === null) {
        await ctx.reply(`Код не подошёл или устарел. Откройте в кабинете ${BOT_NAME} «Магазин» и нажмите «Подключить Telegram» ещё раз.`);
        return;
      }
      await ctx.reply(
        `🎉 Готово! Магазин «${escapeHtml(name)}» подключён к ${BOT_NAME}: новые заказы будут приходить сюда.\n` +
          "📸 Пришлите фото полки, чтобы добавить товары. Все команды: /help. Отключить: /stop.",
        { parse_mode: "HTML" },
      );
      return;
    }
    // Приветствие с логотипом SÖRE (только надпись). Telegram сам скачивает картинку с сайта; без https просто текст.
    if (siteUrl().startsWith("https://")) {
      await ctx.replyWithPhoto(`${siteUrl()}${BOT_LOGO_PATH}`, { caption: WELCOME_TEXT, parse_mode: "HTML" });
    } else {
      await ctx.reply(WELCOME_TEXT, { parse_mode: "HTML" });
    }
    const shop = await findLinkedShop(db, ctx.chat.id);
    if (shop) await sendShop(ctx, shop);
    else await ctx.reply(NOT_LINKED_TEXT, { reply_markup: cabinetButton("/dashboard/settings", "Открыть кабинет") });
  });

  chat.hears(command("stop"), async (ctx) => {
    await unlinkChat(admin(), ctx.chat.id);
    await ctx.reply(`Бот и уведомления отключены. Подключить снова можно в кабинете ${BOT_NAME}.`);
  });

  chat.hears(command("help"), (ctx) => ctx.reply(HELP_TEXT, { parse_mode: "HTML" }));

  chat.hears(command("shop"), async (ctx) => {
    const shop = await requireShop(ctx);
    if (shop) await sendShop(ctx, shop);
  });

  chat.hears(command("orders"), async (ctx) => {
    const shop = await requireShop(ctx);
    if (!shop) return;
    const orders = await recentOrders(admin(), shop.id, 5);
    const keyboard: InlineKeyboard = orders
      .filter((o) => o.status === "new")
      .map((o) => [
        { text: `✅ №${o.number} выполнен`, callback_data: orderActionData(o.id, "done") },
        { text: `✖️ №${o.number} отменить`, callback_data: orderActionData(o.id, "cancelled") },
      ]);
    await ctx.reply(formatOrdersList(orders), { parse_mode: "HTML", reply_markup: keyboard.length ? { inline_keyboard: keyboard } : undefined });
  });

  // ---------- Вход в кабинет одной кнопкой (задача #19) ----------

  const LOGIN_FAIL: Record<string, string> = {
    disabled: "Вход из бота пока не включён. Откройте кабинет на сайте и войдите по почте.",
    "not-linked": NOT_LINKED_TEXT,
    "no-email": "У владельца магазина нет почты для входа. Войдите на сайте обычным способом.",
    "rate-limited": "Слишком много ссылок за час. Попробуйте позже или войдите на сайте по почте.",
    unavailable: "Сервис входа временно недоступен. Попробуйте через минуту.",
  };

  async function sendLogin(ctx: Context) {
    if (!ctx.chat) return;
    const link = await createLoginLink(admin(), ctx.chat.id);
    if (!link.ok) {
      await ctx.reply(LOGIN_FAIL[link.reason]);
      return;
    }
    // Ссылку не логируем: 5 минут это ключ к магазину.
    const text = "🔑 Ссылка для входа в кабинет. Работает 5 минут и только один раз. Никому её не пересылайте.";
    if (link.url.startsWith("https://")) {
      await ctx.reply(text, { reply_markup: { inline_keyboard: [[{ text: "Открыть кабинет", url: link.url }]] } });
    } else {
      await ctx.reply(`${text}\n${link.url}`, { link_preview_options: { is_disabled: true } });
    }
  }

  chat.hears(command("login"), (ctx) => sendLogin(ctx));

  chat.callbackQuery("login", async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendLogin(ctx);
  });

  chat.hears(command("import"), async (ctx) => {
    await ctx.reply(IMPORT_HELP_TEXT, { parse_mode: "HTML" });
    await ctx.replyWithDocument(new InputFile(await catalogTemplateXlsx(), "sore-price-template.xlsx"));
  });

  // ---------- Фото полки ----------

  async function startShelf(ctx: Context, fileId: string, size: number | undefined) {
    const shop = await requireShop(ctx);
    if (!shop || !ctx.chat) return;
    if ((size ?? 0) > MAX_PHOTO_BYTES) {
      await ctx.reply("Фото больше 5 МБ. Отправьте его как обычное фото (со сжатием), а не файлом.");
      return;
    }
    const chatId = ctx.chat.id;
    const api = ctx.api;
    const progress = await ctx.reply(renderProgressText(0), { parse_mode: "HTML" });
    const edit = async (text: string, reply_markup?: { inline_keyboard: InlineKeyboard }) => {
      if (progress.message_id) {
        await api.editMessageText(chatId, progress.message_id, text, { parse_mode: "HTML", reply_markup }).catch(() => undefined);
      } else {
        await api.sendMessage(chatId, text, { parse_mode: "HTML", reply_markup });
      }
    };

    runInBackground(async () => {
      try {
        const photo = await downloadFile(api, token, fileId, MAX_PHOTO_BYTES);
        if (!photo) {
          await edit("Не удалось скачать фото из Telegram. Пришлите его ещё раз.");
          return;
        }
        const db = admin();
        const result = await createShelfDraft(db, shop, chatId, photo, (step) => edit(renderProgressText(step)));
        if (!result.ok) {
          await edit(escapeHtml(result.message));
          return;
        }
        await edit(formatDraft(result.items, result.remaining), { inline_keyboard: draftKeyboard(result.draftId, result.items) });
      } catch (error) {
        console.error("[bot] shelf failed:", error instanceof Error ? error.message : error);
        await edit("😔 Что-то пошло не так. Попробуйте ещё раз через минуту.");
      }
    });
  }

  chat.on("message:photo", async (ctx) => {
    // Telegram присылает несколько размеров, последний самый большой.
    const largest = ctx.message.photo.at(-1);
    if (largest) await startShelf(ctx, largest.file_id, largest.file_size);
  });

  // Документ: прайс (.xlsx/.csv) или картинка, отправленная «файлом».
  chat.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    const name = doc.file_name ?? "";
    if (doc.mime_type?.startsWith("image/") && !/\.(xlsx|xls|csv)$/i.test(name)) {
      await startShelf(ctx, doc.file_id, doc.file_size);
      return;
    }
    const problem = precheckCatalog(name, doc.file_size);
    if (problem) {
      await ctx.reply(`${problem}\nФото полки присылайте как фото, прайс как документ .xlsx или .csv. Шаблон: /import`);
      return;
    }
    const shop = await requireShop(ctx);
    if (!shop) return;
    const wait = await ctx.reply(`📥 Загружаю «${escapeHtml(name)}»…`, { parse_mode: "HTML" });
    const data = await downloadFile(ctx.api, token, doc.file_id, 4 * 1024 * 1024);
    if (!data) {
      await ctx.reply("Не удалось скачать файл из Telegram. Пришлите его ещё раз.");
      return;
    }
    const result = await importCatalogFromBot(admin(), shop, name, data);
    const text = result.ok ? formatImportSummary(name, result) : `❌ ${escapeHtml(result.message)}`;
    if (wait.message_id) await ctx.api.editMessageText(ctx.chat.id, wait.message_id, text, { parse_mode: "HTML" }).catch(() => ctx.reply(text, { parse_mode: "HTML" }));
    else await ctx.reply(text, { parse_mode: "HTML" });
    if (result.ok && result.reportCsv) {
      await ctx.replyWithDocument(new InputFile(Buffer.from(`﻿${result.reportCsv}`), "sore-import-report.csv"));
    }
  });

  // ---------- Кнопки ----------

  chat.on("callback_query:data", async (ctx) => {
    const action = parseAction(ctx.callbackQuery.data);
    if (!action) {
      await ctx.answerCallbackQuery({ text: "Кнопка устарела" });
      return;
    }
    const db = admin();
    const chatId = ctx.chat.id;

    if (action.kind === "order") {
      const number = await setOrderStatusFromChat(db, chatId, action.orderId, action.status);
      if (number === null) {
        await ctx.answerCallbackQuery({ text: "Заказ не найден в вашем магазине", show_alert: true });
        return;
      }
      const label = action.status === "done" ? "выполнен ✅" : "отменён ✖️";
      await ctx.answerCallbackQuery({ text: `Заказ №${number} ${label}` });
      await ctx.reply(`Заказ №${number} ${label}`);
      return;
    }

    if (action.kind === "toggle") {
      const items = await toggleDraftItem(db, action.draftId, chatId, action.index);
      if (!items) {
        await ctx.answerCallbackQuery({ text: "Черновик устарел. Пришлите фото ещё раз." });
        return;
      }
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(formatDraft(items, null), { parse_mode: "HTML", reply_markup: { inline_keyboard: draftKeyboard(action.draftId, items) } });
      return;
    }

    if (action.kind === "discard") {
      await discardDraft(db, action.draftId, chatId);
      await ctx.answerCallbackQuery({ text: "Отменено" });
      await ctx.editMessageText("Хорошо, ничего не публикую. Пришлите другое фото полки, когда будете готовы.");
      return;
    }

    await ctx.answerCallbackQuery({ text: "Публикую…" });
    const result = await publishDraft(db, action.draftId, chatId);
    if (!result.ok) {
      await ctx.reply(escapeHtml(result.message), { parse_mode: "HTML" });
      return;
    }
    const url = storefrontUrl(result.shop.slug);
    await ctx.editMessageText(
      `✅ <b>На витрине ${result.count} ${pluralProducts(result.count)}</b>\n${escapeHtml(url)}\n\nЦены «по запросу» и цены с ценников проверьте в кабинете.`,
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: url.startsWith("https://")
          ? { inline_keyboard: [[{ text: "🛍 Витрина", url }, { text: "✏️ Кабинет", url: `${siteUrl()}/dashboard` }]] }
          : undefined,
      },
    );
  });

  // ---------- Остальной текст ----------

  chat.on("message:text", async (ctx) => {
    if (ctx.message.text.trim().startsWith("/")) {
      await ctx.reply("Не знаю такой команды. Список команд: /help");
      return;
    }
    const shop = await findLinkedShop(admin(), ctx.chat.id);
    await ctx.reply(shop ? "📸 Пришлите фото полки или прайс .xlsx/.csv. Все команды: /help" : NOT_LINKED_TEXT);
  });

  bot.catch(async (error) => {
    console.error(`[bot] Ошибка апдейта ${error.ctx.update.update_id}:`, error.error instanceof Error ? error.error.message : error.error);
    await error.ctx.reply("😔 Что-то пошло не так. Попробуйте ещё раз через несколько секунд.").catch(() => undefined);
  });

  return bot;
}
