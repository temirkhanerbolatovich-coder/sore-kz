/**
 * Публичный ник продавца в Telegram, который покупатель увидит после заказа.
 * Принимает «@aliya_sweets», «aliya_sweets», «t.me/aliya_sweets», «https://t.me/aliya_sweets?start=x».
 * Возвращает чистый ник (5–32 символа: латиница, цифры, «_», начинается с буквы) или null, если ввод на него не похож.
 * Приглашения («t.me/+…», «t.me/joinchat/…»), каналы по номеру и пути с «/» не принимаются.
 */
export function normalizeTelegramUsername(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t|telegram)\.me\/([^/?#\s]+)\/?(?:[?#].*)?$/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@+/, "");
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value) ? value : null;
}

/** Ссылка на личный чат с продавцом. Подставить текст в личный чат ссылкой нельзя, поэтому текст копируется отдельно. */
export const telegramChatUrl = (username: string) => `https://t.me/${encodeURIComponent(username)}`;
