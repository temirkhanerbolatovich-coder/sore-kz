import { test, expect } from "@playwright/test";
import { newNonce, signLoginToken } from "../../src/lib/bot/login-token";
import { adminClient, cleanupUser, seedShop } from "./helpers";
import { BOT_LOGIN_SECRET } from "./telegram-mock";

const admin = adminClient();
const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

test("Бот: ссылка входа открывает кабинет один раз, повтор и просроченная отклоняются", async ({ page, request, browser }) => {
  const s = stamp();
  const email = `botlogin-${s}@example.test`;
  const chatId = 700_000 + Math.floor(Math.random() * 100_000);
  const { shopId, ownerId } = await seedShop(admin, { email, slug: `botlogin-${s}` });
  const base = test.info().project.use.baseURL!;
  const other = await browser.newContext();
  try {
    const { error } = await admin.from("shop_telegram").insert({ shop_id: shopId, chat_id: chatId, linked_at: new Date().toISOString() });
    expect(error).toBeNull();

    // Без секрета и для чужого чата ссылку не выдают.
    expect((await request.post(`${base}/api/bot/login-link`, { headers: { "x-bot-secret": "wrong" }, data: { chat_id: chatId } })).status()).toBe(403);
    expect((await request.post(`${base}/api/bot/login-link`, { headers: { "x-bot-secret": BOT_LOGIN_SECRET }, data: { chat_id: chatId + 1 } })).status()).toBe(404);

    const res = await request.post(`${base}/api/bot/login-link`, { headers: { "x-bot-secret": BOT_LOGIN_SECRET }, data: { chat_id: chatId } });
    expect(res.status()).toBe(200);
    const link = new URL(((await res.json()) as { url: string }).url);
    const path = `${link.pathname}${link.search}`;

    // Первое открытие: сессия без письма, кабинет.
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard(\?.*)?$/);

    // Пересланная ссылка во втором браузере уже погашена.
    const stranger = await other.newPage();
    await stranger.goto(`${base}${path}`);
    await expect(stranger).toHaveURL(/\/login\?error=bot-link$/);

    // Просроченная ссылка с верной подписью не пускает.
    const expired = signLoginToken({ owner: ownerId, exp: Math.floor(Date.now() / 1000) - 10, nonce: newNonce() }, BOT_LOGIN_SECRET);
    await stranger.goto(`${base}/auth/bot?t=${expired}`);
    await expect(stranger).toHaveURL(/\/login\?error=bot-link$/);
  } finally {
    await other.close();
    await cleanupUser(admin, email);
  }
});
