import { describe, expect, it } from "vitest";
import { normalizeTelegramUsername, telegramChatUrl } from "@/lib/telegram-username";

describe("normalizeTelegramUsername", () => {
  it.each([
    ["@aliya_sweets", "aliya_sweets"],
    ["aliya_sweets", "aliya_sweets"],
    ["  @@Aliya_Sweets  ", "Aliya_Sweets"],
    ["t.me/aliya_sweets", "aliya_sweets"],
    ["https://t.me/aliya_sweets", "aliya_sweets"],
    ["http://www.t.me/aliya_sweets/", "aliya_sweets"],
    ["https://telegram.me/aliya_sweets?start=abc", "aliya_sweets"],
    ["https://t.me/aliya_sweets#top", "aliya_sweets"],
    ["abcde", "abcde"],
    ["a".repeat(32), "a".repeat(32)],
  ])("%j → %j", (input, expected) => expect(normalizeTelegramUsername(input)).toBe(expected));

  it.each([
    "",
    "   ",
    "abcd", // короче 5
    "a".repeat(33), // длиннее 32
    "1aliya_sweets", // начинается с цифры
    "_aliya_sweets",
    "aliya sweets",
    "aliya-sweets",
    "алия_шоп",
    "https://t.me/+AbCdEfGhIj", // приглашение, а не ник
    "https://t.me/joinchat/AAAA", // путь с «/»
    "https://t.me/c/123/45",
    "https://example.com/aliya_sweets",
    "javascript:alert(1)",
    "aliya_sweets/extra",
  ])("не ник: %j", (input) => expect(normalizeTelegramUsername(input)).toBeNull());

  it("ссылка на чат экранирует ник", () => {
    expect(telegramChatUrl("aliya_sweets")).toBe("https://t.me/aliya_sweets");
  });
});
