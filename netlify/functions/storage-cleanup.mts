/**
 * Ежедневная уборка осиротевших фото на Netlify (аналог vercel.json → crons).
 * Запускается Netlify по расписанию только на опубликованном (production) деплое и вызывает
 * тот же маршрут, что раньше вызывал Vercel Cron, с тем же заголовком `Authorization: Bearer <CRON_SECRET>`.
 */
const storageCleanup = async () => {
  const site = (process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET?.trim();
  if (!site || !secret) {
    console.error("storage cleanup: не заданы URL сайта или CRON_SECRET");
    return;
  }
  const res = await fetch(`${site}/api/cron/storage-cleanup`, { headers: { authorization: `Bearer ${secret}` } });
  console.info("storage cleanup:", res.status, await res.text());
};

export default storageCleanup;

// 21:30 UTC, через полчаса после purge_old_data в базе.
export const config = { schedule: "30 21 * * *" };
