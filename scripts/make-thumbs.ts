import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../src/lib/database.types";
import { ownedPhotoPath, THUMB_QUALITY, THUMB_WIDTH, thumbPath } from "../src/lib/photos";

const PAGE_SIZE = 100;

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !URL.canParse(url) || !key) {
    console.error("Задайте NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
    process.exitCode = 1;
    return;
  }

  const base = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (!local && (!process.argv.includes("--allow-remote") || base.protocol !== "https:")) {
    console.error("Для облака необходимы HTTPS и явный флаг --allow-remote.");
    process.exitCode = 1;
    return;
  }

  const admin = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = admin.storage.from("product-photos");
  const seen = new Set<string>();
  const stats = { created: 0, existing: 0, skipped: 0, unavailable: 0, failed: 0 };

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin.from("products")
      .select("photo_url, shops!inner(owner_id)")
      .not("photo_url", "is", null)
      .order("id")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("Не удалось получить товары из Supabase.");

    for (const product of data) {
      const source = ownedPhotoPath(product.photo_url, product.shops.owner_id, url);
      if (!source || seen.has(source) || thumbPath(source) === source) {
        stats.skipped++;
        continue;
      }
      seen.add(source);
      const target = thumbPath(source);
      try {
        if ((await bucket.exists(target)).data) {
          stats.existing++;
          continue;
        }
        const { data: image, error: readError } = await bucket.download(source);
        if (readError || !image) {
          stats.unavailable++;
          continue;
        }
        const thumbnail = await sharp(Buffer.from(await image.arrayBuffer())).autoOrient()
          .resize(THUMB_WIDTH, THUMB_WIDTH, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: THUMB_QUALITY })
          .toBuffer();
        const { error: uploadError } = await bucket.upload(target, thumbnail, {
          contentType: "image/jpeg", cacheControl: "31536000",
        });
        if (!uploadError) stats.created++;
        else if ((await bucket.exists(target)).data) stats.existing++;
        else stats.failed++;
      } catch {
        stats.failed++;
      }
    }
    if (data.length < PAGE_SIZE) break;
  }

  console.log(`Миниатюры: создано ${stats.created}, уже есть ${stats.existing}, пропущено ${stats.skipped}, недоступных оригиналов ${stats.unavailable}, других ошибок ${stats.failed}.`);
  if (stats.unavailable || stats.failed) process.exitCode = 1;
}

main().catch(() => {
  console.error("Миниатюры не созданы. Проверьте параметры запуска и доступ Supabase.");
  process.exitCode = 1;
});
