import { expect, test, type Page } from "@playwright/test";
import { adminClient, cleanupUser, loginAs, seedShop } from "./helpers";

test("переход к содержимому доступен с клавиатуры", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "К содержимому" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#main-content").getByRole("link", { name: "Создать магазин", exact: true })).toBeFocused();
});

test("тема сообщает состояние и сохраняет фокус", async ({ page }) => {
  await page.goto("/");
  const theme = page.getByRole("button", { name: "Светлая или тёмная тема" });
  await theme.focus();
  const before = await theme.getAttribute("aria-pressed");
  await page.keyboard.press("Space");
  await expect(theme).toBeFocused();
  await expect(theme).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
  const outline = await theme.evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe("none");
});

/** Проходим до выхода из документа и проверяем каждую видимую отметку фокуса. */
async function checkTabOrder(page: Page) {
  await page.waitForLoadState("networkidle");
  const visited = new Set<string>();
  let last = "";
  let repeated = 0;
  let leftDocument = false;

  for (let step = 0; step < 200; step++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body || element === document.documentElement) return null;

      // Скрытые radio и файловые поля показывают фокус на видимой подписи.
      let indicator: HTMLElement | null = element;
      if (element.classList.contains("sr-only")) {
        indicator = element.closest("label") ??
          (element.id ? document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(element.id)}"]`) : null) ??
          (element.nextElementSibling as HTMLElement | null);
      }
      const style = indicator && getComputedStyle(indicator);
      const rect = indicator?.getBoundingClientRect();
      const hasOutline = Boolean(style && style.outlineStyle !== "none" && style.outlineStyle !== "hidden" && parseFloat(style.outlineWidth) > 0);
      const hasShadow = Boolean(style && style.boxShadow !== "none");
      const visible = Boolean(style && rect && rect.width > 1 && rect.height > 1 && style.visibility === "visible" && style.display !== "none");
      const ring = style && hasOutline ? Math.max(0, parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth)) : 0;
      let clipped = false;
      if (indicator && rect) {
        for (let parent = indicator.parentElement; parent; parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent);
          const bounds = parent.getBoundingClientRect();
          const clipsX = /^(auto|scroll|hidden|clip)$/.test(parentStyle.overflowX);
          const clipsY = /^(auto|scroll|hidden|clip)$/.test(parentStyle.overflowY);
          if ((clipsX && (rect.left - ring < bounds.left || rect.right + ring > bounds.right)) ||
              (clipsY && (rect.top - ring < bounds.top || rect.bottom + ring > bounds.bottom))) {
            clipped = true;
          }
        }
      }
      if (!element.dataset.keyboardTestId) element.dataset.keyboardTestId = crypto.randomUUID();
      return {
        id: element.dataset.keyboardTestId,
        description: `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") || element.textContent?.trim().slice(0, 50) || element.id}`,
        indicated: visible && (hasOutline || hasShadow),
        clipped,
      };
    });
    if (!focused) {
      leftDocument = true;
      break;
    }
    expect(focused.indicated, `Нет видимого фокуса: ${focused.description}`).toBe(true);
    expect(focused.clipped, `Контур фокуса обрезан: ${focused.description}`).toBe(false);
    repeated = focused.id === last ? repeated + 1 : 0;
    // Нативное поле даты может последовательно фокусировать несколько своих сегментов.
    expect(repeated, `Фокус застрял: ${focused.description}`).toBeLessThan(5);
    if (visited.has(focused.id) && focused.id !== last) {
      // Некоторые браузеры сразу возвращают Tab на первую ссылку после выхода.
      leftDocument = true;
      break;
    }
    visited.add(focused.id);
    last = focused.id;
  }
  expect(visited.size).toBeGreaterThan(2);
  expect(leftDocument, "Tab не вышел из страницы за 200 нажатий").toBe(true);
}

async function checkSkipLink(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "К содержимому" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
}

for (const theme of ["light", "dark"] as const) {
  test(`Tab: витрина, корзина и кабинет (${theme})`, async ({ page, request }) => {
    const admin = adminClient();
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const email = `keyboard-${suffix}@example.test`;
    const slug = `keyboard-${suffix}`;
    await seedShop(admin, { email, slug, products: [{ title: "Товар для клавиатуры", price: 1000 }] });

    try {
      await page.addInitScript((value) => localStorage.setItem("sore-theme", value), theme);
      await page.goto(`/${slug}`);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await checkSkipLink(page);
      await page.goto(`/${slug}`);
      await checkTabOrder(page);

      await page.getByRole("button", { name: "В корзину", exact: true }).click();
      await page.getByRole("link", { name: /Корзина/ }).click();
      await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
      // При клиентской навигации корневой layout сохраняется и позиция Tab не обязана быть в начале документа.
      await page.reload();
      await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
      await checkSkipLink(page);
      await page.reload();
      await expect(page.getByLabel("Имя", { exact: true })).toBeVisible();
      await checkTabOrder(page);
      const submit = page.getByRole("button", { name: /Заказать в WhatsApp/ });
      await submit.focus();
      await page.keyboard.press("Enter");
      const name = page.getByLabel("Имя", { exact: true });
      await expect(name).toBeFocused();
      expect(await name.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

      await loginAs(page, request, email);
      await page.goto("/dashboard");
      // Ждём настоящую страницу: пока виден скелет loading.tsx, у него тот же #main-content.
      await expect(page.getByRole("heading", { name: /Товары/ })).toBeVisible();
      await checkSkipLink(page);
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: /Товары/ })).toBeVisible();
      await checkTabOrder(page);

      // Форма также проверяет видимые подписи скрытых файловых и radio-полей.
      await page.goto("/dashboard/products/new");
      await checkSkipLink(page);
      await page.goto("/dashboard/products/new");
      await checkTabOrder(page);
    } finally {
      await cleanupUser(admin, email);
    }
  });
}
