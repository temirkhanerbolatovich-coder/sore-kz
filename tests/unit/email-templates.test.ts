import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Шаблоны писем входа (docs/email-templates). Загружаются в Supabase вручную после подключения своего SMTP,
 * поэтому их ломает любая невнимательная правка: проверяем плейсхолдеры, бренд, оба языка и безопасность письма.
 */
const read = (name: string) => readFileSync(`docs/email-templates/${name}.html`, "utf8");

describe.each(["magic_link", "confirmation"])("шаблон %s", (name) => {
  const html = read(name);

  it("использует только два плейсхолдера Supabase: ссылку и код", () => {
    const placeholders = [...html.matchAll(/\{\{[^}]*\}\}/g)].map((m) => m[0]);
    expect(new Set(placeholders)).toEqual(new Set(["{{ .ConfirmationURL }}", "{{ .Token }}"]));
  });

  it("ссылка стоит в href кнопки на обоих языках, код показан на обоих", () => {
    expect(html.match(/href="\{\{ \.ConfirmationURL \}\}"/g)).toHaveLength(2);
    expect(html.match(/\{\{ \.Token \}\}/g)).toHaveLength(2);
  });

  it("бренд SÖRE, русский и казахский текст, без старого названия", () => {
    expect(html).toContain('S<span style="color:#c73e1d;">Ö</span>RE');
    expect(html).toMatch(/Пароль не нужен/);
    expect(html).toMatch(/Құпиясөз қажет емес/);
    expect(html).not.toMatch(/duken/i);
  });

  it("письмо автономно: без внешних картинок, скриптов и трекеров", () => {
    expect(html).not.toMatch(/<script|<img|<link|<iframe|@import|url\(/i);
    expect(html).not.toMatch(/(?:src|href)="https?:/i);
  });

  it("корректная разметка и размер меньше предела обрезки Gmail", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('lang="ru"');
    const open = (html.match(/<table\b/g) ?? []).length;
    const close = (html.match(/<\/table>/g) ?? []).length;
    expect(open).toBe(close);
    expect(Buffer.byteLength(html)).toBeLessThan(40_000);
  });

  it("e2e-вход читает ссылку из письма: href с адресом подтверждения идёт первым", () => {
    const rendered = html.replaceAll("{{ .ConfirmationURL }}", "http://127.0.0.1:54321/auth/v1/verify?token=abc&amp;type=magiclink").replaceAll("{{ .Token }}", "123456");
    const link = rendered.match(/href="([^"]+\/auth\/v1\/verify[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(link).toBe("http://127.0.0.1:54321/auth/v1/verify?token=abc&type=magiclink");
  });
});

it("шаблоны отличаются заголовком и кнопкой", () => {
  expect(read("magic_link")).toContain("Вход в кабинет магазина");
  expect(read("confirmation")).toContain("Добро пожаловать в SÖRE");
  expect(read("confirmation")).toContain("Подтвердить и войти");
});
