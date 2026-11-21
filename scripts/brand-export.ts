/**
 * Логотип бота SÖRE (только надпись) из src/lib/brand.ts:
 *
 *   npm run brand:export
 *
 * Пишет public/brand/sore-bot-avatar.png (640×640): аватар для @BotFather → /setuserpic и картинка приветствия.
 * Надпись рисуется шрифтом системы, поэтому PNG собирается здесь, а не на сервере (на Vercel нет шрифтов).
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { avatarSvg, BOT_LOGO_PATH } from "@/lib/brand";

async function main() {
  await mkdir("public/brand", { recursive: true });
  await writeFile(`public${BOT_LOGO_PATH}`, await sharp(Buffer.from(avatarSvg(640))).png().toBuffer());
  console.log(`Готово: public${BOT_LOGO_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
