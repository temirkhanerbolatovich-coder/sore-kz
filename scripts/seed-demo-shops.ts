/**
 * Демо-магазины SÖRE: шесть вымышленных магазинов малого бизнеса Казахстана с карточками и фото.
 * Данные: scripts/demo-shops/data.ts. Фото скрипт скачивает со стока Pexels по номеру (лицензия Pexels:
 * бесплатно, без указания автора) и обрезает в квадрат; если Pexels недоступен, рисует иллюстрацию
 * (scripts/demo-shops/art.ts). Файлы фото в репозитории не хранятся.
 *
 *   npm run seed:demo -- --preview папка      только подготовить картинки в папку, база не нужна
 *   npm run seed:demo                         заполнить локальную базу
 *   npm run seed:demo -- --allow-remote       заполнить облачную базу
 *   npm run seed:demo -- --remove [--allow-remote]   удалить демо-магазины, их владельцев и фото
 *   DEMO_OWNER_EMAIL=name@gmail.com npm run seed:demo -- --rebind --allow-remote   почта владельцев → name+demo-<slug>@gmail.com
 *
 * Окружение: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (как у приложения),
 *   DEMO_WHATSAPP  необязательно. Демо-витрины не отправляют заказы и не показывают номер (src/components/demo-notice.tsx),
 *                  а в базе нужен хоть какой-то: по умолчанию 70000000000, кода 000 не существует.
 * Скрипт можно запускать повторно: товары и фото демо-магазинов пересоздаются.
 * Адреса начинаются с «demo-»: такие магазины не попадают в sitemap и закрыты от индексации (src/lib/slug.ts).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";
import { artSvg } from "./demo-shops/art";
import { DEMO_SHOPS, type DemoProduct, type DemoShop } from "./demo-shops/data";

loadEnvConfig(process.cwd());

const BUCKET = "product-photos";
// Те же размеры, что у фото из кабинета (src/lib/photos.ts): основное до 1200 px и миниатюра _s.jpg 480 px.
const THUMB_WIDTH = 480;
const THUMB_QUALITY = 78;

/** Исходный служебный адрес владельца: письма на него не доходят. */
const ownerEmail = (slug: string) => `${slug}@demo.sore.invalid`;

/**
 * Адрес для входа в демо-кабинет: DEMO_OWNER_EMAIL=name@gmail.com даёт name+demo-<slug>@gmail.com,
 * письмо со ссылкой приходит в обычный ящик. Без переменной остаётся служебный адрес.
 */
function loginEmail(slug: string): string {
  const base = (process.env.DEMO_OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!base) return ownerEmail(slug);
  const match = /^([^@+\s]+)@([^@\s]+\.[^@\s]+)$/.exec(base);
  if (!match) throw new Error("DEMO_OWNER_EMAIL: нужен обычный адрес вида name@gmail.com, без плюса.");
  return `${match[1]}+${slug}@${match[2]}`;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Номер фото Pexels в конце адреса: «red-roses-bouquet-on-table-22604232» → 22604232. */
const pexelsId = (photo: string) => /-(\d+)$/.exec(photo)?.[1] ?? null;

async function downloadPhoto(photo: string): Promise<Buffer | null> {
  const id = pexelsId(photo);
  if (!id) return null;
  try {
    const res = await fetch(`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600`, {
      headers: { "User-Agent": "Mozilla/5.0 (sore-seed-demo)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Аватар магазина: квадрат 400 px из фото Pexels; без фото остаётся буква на фоне, как у обычного магазина. */
async function renderAvatar(shop: DemoShop): Promise<{ full: Buffer; thumb: Buffer } | null> {
  const photo = await downloadPhoto(shop.avatar);
  if (!photo) return null;
  const full = await sharp(photo).rotate().resize(400, 400, { fit: "cover", position: "attention" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const thumb = await sharp(full).resize(160).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toBuffer();
  return { full, thumb };
}

async function renderProduct(shop: DemoShop, product: DemoProduct): Promise<{ full: Buffer; thumb: Buffer; source: "pexels" | "art" }> {
  const photo = await downloadPhoto(product.photo);
  const input = photo ?? Buffer.from(artSvg(product.art, { bg: shop.bg, accent: product.accent }));
  // Квадрат 1200 px, обрезка по центру, как у вырезок «фото полки»; ориентация по EXIF.
  const full = await sharp(input).rotate().resize(1200, 1200, { fit: "cover", position: "attention" }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const thumb = await sharp(full).resize(THUMB_WIDTH).jpeg({ quality: THUMB_QUALITY, mozjpeg: true }).toBuffer();
  if (!photo) console.warn(`  ! ${product.title}: фото Pexels недоступно, взята иллюстрация`);
  return { full, thumb, source: photo ? "pexels" : "art" };
}

async function preview(dir: string) {
  for (const shop of DEMO_SHOPS) {
    const out = path.join(dir, shop.slug);
    await mkdir(out, { recursive: true });
    for (const [i, product] of shop.products.entries()) {
      const { full, source } = await renderProduct(shop, product);
      await writeFile(path.join(out, `${i + 1}-${source}-${product.art}.jpg`), full);
    }
    console.log(`✔ ${shop.name}: ${shop.products.length} картинок → ${out}`);
  }
}

async function findOwner(admin: SupabaseClient, email: string) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
}

/** Владелец демо-магазина: по адресу для входа, а если ещё не переименован, по служебному. */
async function findShopOwner(admin: SupabaseClient, slug: string) {
  return (await findOwner(admin, loginEmail(slug))) ?? (await findOwner(admin, ownerEmail(slug)));
}

/** Переносит почту владельцев на адрес для входа (без пересева товаров и фото). */
async function rebindOwners(admin: SupabaseClient) {
  for (const shop of DEMO_SHOPS) {
    const target = loginEmail(shop.slug);
    const owner = await findShopOwner(admin, shop.slug);
    if (!owner) {
      console.log(`– ${shop.slug}: владельца нет`);
      continue;
    }
    if (owner.email === target) {
      console.log(`= ${shop.slug}: уже ${target}`);
      continue;
    }
    const { error } = await admin.auth.admin.updateUserById(owner.id, { email: target, email_confirm: true });
    if (error) throw new Error(`${shop.slug}: ${error.message}`);
    console.log(`✔ ${shop.slug}: ${target}`);
  }
}

async function removeOwnerFiles(admin: SupabaseClient, ownerId: string) {
  const { data: files } = await admin.storage.from(BUCKET).list(ownerId, { limit: 1000 });
  if (files?.length) await admin.storage.from(BUCKET).remove(files.map((f) => `${ownerId}/${f.name}`));
}

async function seedShop(admin: SupabaseClient, shop: DemoShop, whatsapp: string) {
  const email = loginEmail(shop.slug);
  let owner = await findShopOwner(admin, shop.slug);
  if (!owner) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { demo: true } });
    if (error || !data.user) throw error ?? new Error(`не удалось создать владельца ${email}`);
    owner = data.user;
  }

  const fields = { name: shop.name, slug: shop.slug, whatsapp, city: shop.city, about: shop.about, address: shop.address, hours: shop.hours, lead_days: shop.lead_days, payment_info: shop.payment, delivery_info: shop.delivery };
  const { data: existing } = await admin.from("shops").select("id").eq("owner_id", owner.id).maybeSingle();
  let shopId = existing?.id as string | undefined;
  if (shopId) {
    const { error } = await admin.from("products").delete().eq("shop_id", shopId);
    if (error) throw error;
    await removeOwnerFiles(admin, owner.id);
    const { error: updateError } = await admin.from("shops").update(fields).eq("id", shopId);
    if (updateError) throw updateError;
  } else {
    const { data, error } = await admin.from("shops").insert({ owner_id: owner.id, ...fields }).select("id").single();
    if (error) throw new Error(`${shop.slug}: ${error.message}`);
    shopId = data.id as string;
  }

  const bucket = admin.storage.from(BUCKET);
  const options = { contentType: "image/jpeg", cacheControl: "31536000" };
  const avatar = await renderAvatar(shop);
  if (avatar) {
    const avatarPath = `${owner.id}/${randomUUID()}.jpg`;
    const up = await bucket.upload(avatarPath, avatar.full, options);
    if (up.error) throw up.error;
    const small = await bucket.upload(avatarPath.replace(/\.jpg$/, "_s.jpg"), avatar.thumb, options);
    if (small.error) throw small.error;
    const { error: avatarError } = await admin.from("shops").update({ avatar_url: bucket.getPublicUrl(avatarPath).data.publicUrl }).eq("id", shopId);
    if (avatarError) throw avatarError;
  } else {
    console.warn(`  ! ${shop.name}: фото для аватара недоступно, останется буква`);
  }
  const rows = [];
  for (const [sort, product] of shop.products.entries()) {
    const { full, thumb } = await renderProduct(shop, product);
    const filePath = `${owner.id}/${randomUUID()}.jpg`;
    const upload = await bucket.upload(filePath, full, options);
    if (upload.error) throw upload.error;
    const small = await bucket.upload(filePath.replace(/\.jpg$/, "_s.jpg"), thumb, options);
    if (small.error) throw small.error;
    rows.push({
      shop_id: shopId,
      title: product.title,
      category: product.category,
      price: product.price,
      price_mode: product.price_mode,
      description_ru: product.description_ru,
      description_kz: product.description_kz,
      photo_url: bucket.getPublicUrl(filePath).data.publicUrl,
      in_stock: true,
      sort,
    });
  }
  const { error } = await admin.from("products").insert(rows);
  if (error) throw new Error(`${shop.slug}: ${error.message}`);
  console.log(`✔ ${shop.name} (/${shop.slug}): ${rows.length} товаров`);
}

async function removeShop(admin: SupabaseClient, shop: DemoShop) {
  const owner = await findShopOwner(admin, shop.slug);
  if (!owner) return console.log(`– ${shop.slug}: нет`);
  await removeOwnerFiles(admin, owner.id);
  // Магазин, товары и заказы удаляются каскадом вместе с владельцем.
  const { error } = await admin.auth.admin.deleteUser(owner.id);
  if (error) throw error;
  console.log(`✖ ${shop.slug}: удалён`);
}

async function main() {
  const previewDir = arg("--preview");
  if (previewDir) return preview(previewDir);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.");
  const local = /^http:\/\/(localhost|127\.0\.0\.1):/.test(url);
  if (!local && !process.argv.includes("--allow-remote")) {
    throw new Error("База не локальная. Для облака добавьте --allow-remote осознанно.");
  }
  const admin = createClient(url, key, { auth: { persistSession: false } });

  if (process.argv.includes("--rebind")) return rebindOwners(admin);

  if (process.argv.includes("--remove")) {
    for (const shop of DEMO_SHOPS) await removeShop(admin, shop);
    return;
  }

  const whatsapp = (process.env.DEMO_WHATSAPP ?? "").replace(/\D/g, "") || "70000000000";
  if (!/^[0-9]{10,15}$/.test(whatsapp)) throw new Error("DEMO_WHATSAPP: 10–15 цифр.");
  for (const shop of DEMO_SHOPS) await seedShop(admin, shop, whatsapp);
  console.log(`\nГотово: ${DEMO_SHOPS.length} демо-магазинов. Витрины обновятся в течение 4 минут (кэш).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
