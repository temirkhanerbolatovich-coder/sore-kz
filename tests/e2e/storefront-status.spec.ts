import { expect, test } from "@playwright/test";
import { adminClient, cleanupUser, seedShop } from "./helpers";

test("витрина и карточка товара возвращают реальные HTTP-статусы", async ({ request }) => {
  // This valid public slug begins with the same word as the protected dashboard path.
  const slug = `dashboard-${Date.now().toString(36)}`;
  const email = `${slug}@example.test`;
  const admin = adminClient();
  const { products: [product] } = await seedShop(admin, { email, slug, products: [{ title: "Товар", price: 4000 }] });
  try {
    expect((await request.get(`/${slug}-missing`)).status()).toBe(404);
    expect((await request.get(`/${slug}/p/00000000-0000-4000-8000-000000000001`)).status()).toBe(404);
    expect((await request.get(`/${slug}`)).status()).toBe(200);
    expect((await request.get(`/${slug}/p/${product.id}`)).status()).toBe(200);
  } finally {
    await cleanupUser(admin, email);
  }
});
