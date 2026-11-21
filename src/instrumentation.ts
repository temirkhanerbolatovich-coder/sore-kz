import { reportError } from "@/lib/monitoring";
import { invalidEnvironmentNames } from "@/lib/env";

export function register() {
  const names = invalidEnvironmentNames(process.env);
  if (names.length) console.warn(`[Sore] Не заданы или некорректны переменные окружения: ${names.join(", ")}`);
}

/** Все необработанные ошибки сервера (страницы, действия, маршруты) попадают сюда и уходят владельцу в Telegram. */
export async function onRequestError(error: unknown, request: { path: string; method: string }) {
  await reportError("server", error, `${request.method} ${request.path}`);
}
