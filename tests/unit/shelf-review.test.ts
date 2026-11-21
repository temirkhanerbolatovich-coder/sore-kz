import { expect, test } from "vitest";
import { shelfReviewReason } from "@/lib/shelf-review";

const box = { x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.5 };

test("нормальный черновик не помечается", () => {
  expect(shelfReviewReason({ title: "Молоко 1 л", category: "Продукты", bbox: box })).toBeNull();
});

test("пустое или короткое название", () => {
  expect(shelfReviewReason({ title: "  ", category: "Продукты", bbox: box })).toBe("название");
  expect(shelfReviewReason({ title: "Ча", category: "Продукты", bbox: box })).toBe("название");
});

test("нет категории", () => {
  expect(shelfReviewReason({ title: "Молоко", category: "", bbox: box })).toBe("категория");
});

test("маленькая рамка", () => {
  expect(shelfReviewReason({ title: "Молоко", category: "Продукты", bbox: { x1: 0.1, y1: 0.1, x2: 0.2, y2: 0.2 } })).toBe("снимок товара");
});

test("после правки метка уходит", () => {
  const draft = { title: "", category: "Продукты", bbox: box };
  expect(shelfReviewReason(draft)).toBe("название");
  expect(shelfReviewReason({ ...draft, title: "Кефир" })).toBeNull();
});
