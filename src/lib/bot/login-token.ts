// Токен одноразовой ссылки входа из бота: base64url(JSON) + "." + base64url(HMAC-SHA256).
// Чистый модуль без сети и базы: подпись и проверку используют маршруты, бот и тесты.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const LOGIN_TTL_SECONDS = 5 * 60;

export type LoginClaims = { owner: string; exp: number; nonce: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;

/** Ключ подписи выводится из секрета: сам BOT_LOGIN_SECRET (заголовок x-bot-secret) токены не подписывает. */
const signingKey = (secret: string) => createHmac("sha256", secret).update("sore:bot-login-token:v1").digest();
const sign = (body: string, secret: string) => createHmac("sha256", signingKey(secret)).update(body).digest("base64url");

export function newNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function signLoginToken(claims: LoginClaims, secret: string): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** Подпись, форма и срок. null на любую ошибку: причину наружу не сообщаем. */
export function verifyLoginToken(token: unknown, secret: string, now = Date.now()): LoginClaims | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const c = claims as Partial<LoginClaims>;
  if (typeof c.owner !== "string" || !UUID.test(c.owner) || typeof c.nonce !== "string" || !NONCE.test(c.nonce)) return null;
  if (typeof c.exp !== "number" || !Number.isFinite(c.exp) || c.exp * 1000 <= now) return null;
  return { owner: c.owner, exp: c.exp, nonce: c.nonce };
}
