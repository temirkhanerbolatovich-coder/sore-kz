import { expect, test, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

async function setDarkTheme(page: Page, violations: string[]) {
  await page.exposeFunction("captureDarkCspViolation", (value: string) => { violations.push(value); });
  await page.addInitScript(() => {
    localStorage.setItem("sore-theme", "dark");
    const browser = window as Window & { captureDarkCspViolation?(value: string): Promise<void> };
    document.addEventListener("securitypolicyviolation", (event) => {
      void browser.captureDarkCspViolation?.(`${location.pathname} ${event.effectiveDirective} ${event.blockedURI}`);
    });
  });
}

/** Контраст заголовка вычисляется с учётом прозрачности фонов его родителей. */
async function checkDarkPage(page: Page, path: string) {
  await page.goto(path);
  const heading = page.locator("main h1, main h2").first();
  await expect(heading, path).toBeVisible();
  await expect(page.locator("html"), path).toHaveAttribute("data-theme", "dark");
  const result = await heading.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const rgba = (color: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data];
    };
    const blend = (front: number[], back: number[]) => {
      const alpha = front[3] / 255;
      return front.slice(0, 3).map((v, i) => v * alpha + back[i] * (1 - alpha));
    };
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const layers: number[][] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      layers.push(rgba(getComputedStyle(current).backgroundColor));
    }
    const background = layers.reverse().reduce((back, front) => blend(front, back), [255, 255, 255]);
    const foreground = blend(rgba(getComputedStyle(element).color), background);
    const a = luminance(foreground);
    const b = luminance(background);
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      backgroundLuminance: luminance(rgba(getComputedStyle(document.body).backgroundColor)),
      contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    };
  });
  expect(result.overflow, path).toBe(false);
  expect(result.backgroundLuminance, path).toBeLessThan(0.1);
  expect(result.contrast, path).toBeGreaterThanOrEqual(4.5);
}

for (const width of [360, 390]) {
  test(`тёмная тема: основные экраны при ${width} px`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 844 });
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const email = `dark-${stamp}@example.test`;
    const newEmail = `dark-new-${stamp}@example.test`;
    const slug = `dark-${stamp}`;
    const admin = adminClient();
    const violations: string[] = [];
    await setDarkTheme(page, violations);
    try {
      const { shopId, products } = await seedShop(admin, { email, slug, products: [{ title: "Товар", price: 1000 }] });
      const { data: order, error } = await admin.from("orders").insert({
        shop_id: shopId, number: 1, items: [{ id: products[0].id, title: "Товар", qty: 1, price: 1000 }], total: 1000,
        customer_name: "Покупатель", customer_phone: "77015550101", address: "Самовывоз",
      }).select("public_code").single();
      expect(error).toBeNull();
      expect(order).not.toBeNull();

      for (const path of ["/", "/login", "/privacy", "/terms", "/no-such-shop-dark-theme", `/${slug}`, `/${slug}/p/${products[0].id}`, `/${slug}/cart`, `/o/${order!.public_code}`]) {
        await checkDarkPage(page, path);
      }
      await loginAs(page, request, newEmail);
      await checkDarkPage(page, "/dashboard/onboarding");
      await page.getByRole("button", { name: "Выйти" }).click();
      await loginAs(page, request, email);
      for (const path of ["/dashboard", "/dashboard/orders", "/dashboard/settings", "/dashboard/products/new", "/dashboard/products/batch", "/dashboard/products/shelf", "/dashboard/products/import", "/dashboard/poster"]) {
        await checkDarkPage(page, path);
      }
      await page.waitForLoadState("networkidle");
      expect(violations).toEqual([]);
    } finally {
      await cleanupUser(admin, email);
      await cleanupUser(admin, newEmail);
    }
  });
}

test("предпочтение уменьшенного движения отключает анимации иконок", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const icons = page.locator(".icon:visible");
  expect(await icons.count()).toBeGreaterThan(0);
  for (const icon of await icons.all()) await expect(icon).toHaveCSS("animation-name", "none");
  await page.locator(".theme-toggle").hover();
  for (const icon of await icons.all()) await expect(icon).toHaveCSS("animation-name", "none");
});
