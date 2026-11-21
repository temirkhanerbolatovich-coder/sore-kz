import { expect, it } from "vitest";
import { asPriceMode, contactText, inquiryText, isInquiry, priceLabel, whatsappUrl } from "@/lib/order";

it("подписи цены: точная, «от» и «по запросу» на двух языках", () => {
  expect(priceLabel(12000, "fixed")).toBe("12 000 ₸");
  expect(priceLabel(15000, "from")).toBe("от 15 000 ₸");
  expect(priceLabel(0, "request")).toBe("Цена по запросу");
  expect(priceLabel(15000, "from", "kz")).toBe("15 000 ₸-ден бастап");
  expect(priceLabel(0, "request", "kz")).toBe("Бағасы келісім бойынша");
});

it("неизвестный режим цены считается точной ценой, а «от»/«по запросу» уходят в обращение", () => {
  expect(asPriceMode("weird")).toBe("fixed");
  expect(asPriceMode(null)).toBe("fixed");
  expect(isInquiry("from")).toBe(true);
  expect(isInquiry("request")).toBe(true);
  expect(isInquiry("fixed")).toBe(false);
});

it("текст обращения на русском, с ценой «от», в ссылке wa.me", () => {
  const text = inquiryText("Повар на выезд", 15000, "from", "Повар на выезд · Астана");
  expect(text).toContain("Интересует: Повар на выезд (от 15 000 ₸)");
  expect(inquiryText("Торты на заказ", 0, "request", "Магазин")).not.toContain("₸");
  const url = whatsappUrl("+7 778 543 02 20", text);
  expect(url.startsWith("https://wa.me/77785430220?text=")).toBe(true);
});

it("сообщение «Написать продавцу» называет магазин и не упоминает товар или цену", () => {
  const text = contactText("Ою сувенир");
  expect(text).toContain("«Ою сувенир»");
  expect(text).not.toContain("₸");
});
