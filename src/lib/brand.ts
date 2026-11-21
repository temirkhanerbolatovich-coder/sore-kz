// Логотип бота SÖRE: только надпись, в стиле направления 05 «Связь» (жирный гротеск, белая надпись на тёмном фоне).
// Используется только ботом: аватар (@BotFather) и картинка приветствия. Сайт его не использует.
// Файл public/brand/sore-bot-avatar.png собирает npm run brand:export.

const TEXT = "#F4F5F2";
const BACKGROUND = "#111417";

/** Квадрат с надписью SÖRE по центру. Надпись не шире ~64% стороны: Telegram обрезает аватар кругом. */
export function avatarSvg(size = 640): string {
  const fontSize = Math.round(size * 0.2);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `<rect width="${size}" height="${size}" fill="${BACKGROUND}"/>`,
    `<text x="50%" y="${Math.round(size / 2 + fontSize * 0.36)}" text-anchor="middle" fill="${TEXT}"`,
    ` font-family="'Segoe UI', Onest, Inter, Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="0">SÖRE</text>`,
    `</svg>`,
  ].join("");
}

/** Публичный адрес картинки: Telegram сам скачивает её по ссылке, функции не нужно рисовать PNG. */
export const BOT_LOGO_PATH = "/brand/sore-bot-avatar.png";
