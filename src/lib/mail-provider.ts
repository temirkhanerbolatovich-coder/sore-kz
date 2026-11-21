/** Почтовые сервисы, где продавцы чаще всего читают письмо входа: даём кнопку «Открыть почту» вместо поисков вкладки. */
const PROVIDERS: { name: string; url: string; domains: string[] }[] = [
  { name: "Gmail", url: "https://mail.google.com/", domains: ["gmail.com", "googlemail.com"] },
  { name: "Mail.ru", url: "https://e.mail.ru/inbox/", domains: ["mail.ru", "inbox.ru", "list.ru", "bk.ru"] },
  { name: "Яндекс Почта", url: "https://mail.yandex.ru/", domains: ["yandex.ru", "yandex.kz", "ya.ru", "yandex.com"] },
  { name: "iCloud Mail", url: "https://www.icloud.com/mail", domains: ["icloud.com", "me.com", "mac.com"] },
  { name: "Outlook", url: "https://outlook.live.com/mail/", domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"] },
];

/** Почтовый сервис по адресу или null, если домен незнакомый (своя почта, корпоративная). */
export function mailProvider(email: string): { name: string; url: string } | null {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return null;
  const found = PROVIDERS.find((p) => p.domains.includes(domain));
  return found ? { name: found.name, url: found.url } : null;
}
