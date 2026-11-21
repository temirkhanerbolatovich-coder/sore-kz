import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export function adminClient() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) throw new Error("E2E requires a disposable local Supabase");
  return createClient(base, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export type Admin = ReturnType<typeof adminClient>;

export type SeedProduct = { title: string; price: number; in_stock?: boolean };

/** Создаёт продавца, магазин и товары напрямую через сервисный ключ (только локальная БД). */
export async function seedShop(admin: Admin, opts: { email: string; slug: string; products?: SeedProduct[] }) {
  const { data: created, error } = await admin.auth.admin.createUser({ email: opts.email, email_confirm: true });
  if (error || !created.user) throw new Error(`createUser: ${error?.message}`);
  const ownerId = created.user.id;
  const { data: shop, error: shopError } = await admin
    .from("shops")
    .insert({ owner_id: ownerId, name: "Регрессия", slug: opts.slug, whatsapp: "77011234567", city: "Алматы" })
    .select("id")
    .single();
  if (shopError || !shop) throw new Error(`shop: ${shopError?.message}`);
  const products: { id: string; title: string }[] = [];
  for (const [i, p] of (opts.products ?? []).entries()) {
    const { data, error: pe } = await admin
      .from("products")
      .insert({ shop_id: shop.id, title: p.title, price: p.price, in_stock: p.in_stock ?? true, sort: i })
      .select("id,title")
      .single();
    if (pe || !data) throw new Error(`product: ${pe?.message}`);
    products.push(data);
  }
  return { ownerId, shopId: shop.id, products };
}

/** Удаляет пользователя вместе с его файлами в Storage (магазин и товары уходят каскадом). */
export async function cleanupUser(admin: Admin, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  // Раньше ошибка тут молча глотались, и тестовые пользователи копились в базе.
  if (error) throw new Error(`cleanup listUsers: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user) return;
  const { data: files } = await admin.storage.from("product-photos").list(user.id);
  if (files?.length) await admin.storage.from("product-photos").remove(files.map((f) => `${user.id}/${f.name}`));
  await admin.auth.admin.deleteUser(user.id);
}

export async function storedFiles(admin: Admin, ownerId: string): Promise<string[]> {
  const { data, error } = await admin.storage.from("product-photos").list(ownerId);
  if (error) throw new Error(`storage list: ${error.message}`);
  return data.map((file) => file.name);
}

/** Вход продавца через настоящую форму magic link и локальную почту Mailpit. */
export async function loginAs(page: Page, request: APIRequestContext, email: string) {
  await page.goto("/login");
  await page.getByLabel("Электронная почта").fill(email);
  await page.getByRole("button", { name: "Получить ссылку для входа" }).click();
  await expect(page.getByText("Проверьте почту")).toBeVisible();
  let messageId = "";
  await expect
    .poll(async () => {
      const inbox = await (await request.get("http://127.0.0.1:54324/api/v1/messages")).json();
      const message = inbox.messages?.find((m: { To: { Address: string }[] }) => m.To.some((to) => to.Address === email));
      messageId = message?.ID || "";
      return Boolean(messageId);
    })
    .toBe(true);
  const mail = await (await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)).json();
  const link = mail.HTML.match(/href="([^"]+\/auth\/v1\/verify[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  expect(link).toBeTruthy();
  await page.goto(link);
  await expect(page).toHaveURL(/\/dashboard/);
}
