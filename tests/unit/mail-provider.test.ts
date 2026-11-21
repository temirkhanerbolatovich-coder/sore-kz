import { describe, expect, it } from "vitest";
import { mailProvider } from "@/lib/mail-provider";

describe("mailProvider", () => {
  it("узнаёт популярные почтовые сервисы независимо от регистра и пробелов", () => {
    expect(mailProvider("aliya@gmail.com")?.name).toBe("Gmail");
    expect(mailProvider("  Aliya@Gmail.COM ")?.name).toBe("Gmail");
    expect(mailProvider("a@mail.ru")?.url).toBe("https://e.mail.ru/inbox/");
    expect(mailProvider("a@icloud.com")?.name).toBe("iCloud Mail");
    expect(mailProvider("a@yandex.kz")?.name).toBe("Яндекс Почта");
  });

  it("плюс-адрес Gmail тоже Gmail", () => {
    expect(mailProvider("aliya+demo@gmail.com")?.name).toBe("Gmail");
  });

  it("для своего домена и мусора возвращает null", () => {
    expect(mailProvider("a@shop.kz")).toBeNull();
    expect(mailProvider("без-собаки")).toBeNull();
    expect(mailProvider("")).toBeNull();
  });
});
