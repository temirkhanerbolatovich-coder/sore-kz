import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import { DocumentLanguage } from "@/components/document-language";
import { ThemeToggle } from "@/components/theme-toggle";
import { AiIcon, CameraIcon, WhatsAppIcon } from "@/components/icons";
import { LANDING } from "@/lib/landing-text";
import { shopHref } from "@/lib/lang";
import { RememberLang } from "@/components/ui-lang";
import { getUiLang } from "@/lib/ui-lang";
import { publicAlternates } from "@/lib/shop-seo";

const STEP_ICONS = [CameraIcon, AiIcon, WhatsAppIcon];

type Props = { searchParams: Promise<{ lang?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await getUiLang((await searchParams).lang);
  const t = LANDING[lang];
  return {
    title: t.title,
    description: t.description,
    alternates: publicAlternates("/", lang),
    openGraph: { title: t.title, description: t.description, type: "website", locale: lang === "kz" ? "kk_KZ" : "ru_RU" },
  };
}

export default async function Home({ searchParams }: Props) {
  const { lang: langParam } = await searchParams;
  const lang = await getUiLang(langParam);
  const t = LANDING[lang];
  const demoHref = shopHref("/demo", lang);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 pb-14 pt-6 sm:px-8">
      <DocumentLanguage lang={lang} />
      {(langParam === "kz" || langParam === "ru") && <RememberLang lang={lang} />}
      <header className="flex items-center justify-between gap-4">
        <div className="text-2xl font-extrabold tracking-tight">
          S<span className="text-accent">Ö</span>RE
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          <ThemeToggle className="border-field" />
          <div className="flex rounded-full border-[1.5px] border-field text-caption font-bold" role="group" aria-label={t.langLabel}>
            <Link
              href="/"
              aria-current={lang === "ru" ? "true" : undefined}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-l-full px-3 ${lang === "ru" ? "bg-ink text-cream" : "text-muted"}`}
            >
              RU
            </Link>
            <Link
              href="/?lang=kz"
              aria-current={lang === "kz" ? "true" : undefined}
              className={`flex min-h-11 min-w-11 items-center justify-center rounded-r-full px-3 ${lang === "kz" ? "bg-ink text-cream" : "text-muted"}`}
            >
              KZ
            </Link>
          </div>
          <Link href="/login" className="flex min-h-11 items-center font-semibold">
            {t.login}
          </Link>
          <Link href="/login" className="btn-dark hidden sm:inline-flex">
            {t.create}
          </Link>
        </div>
      </header>

      <section id="main-content" tabIndex={-1} className="flex flex-wrap items-center gap-14">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
          <span className="self-start rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-accent-dark">{t.badge}</span>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{t.h1}</h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted sm:text-xl">{t.lead}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-accent min-h-14 text-lg">
              {t.create}
            </Link>
            <Link href={demoHref} className="btn-outline min-h-14 text-lg">
              {t.demo}
            </Link>
          </div>
          <p className="text-body text-muted">{t.free}</p>
        </div>

        <div className="mx-auto grid w-full max-w-md grid-cols-2 items-start gap-3" aria-label={t.exampleLabel}>
          <figure className="card overflow-hidden p-2">
            <div className="rounded-xl bg-thumb p-2">
              <div className="grid grid-cols-2 gap-2 border-b-4 border-field pb-2">
                {["kese", "slippers", "dombyra", "takiya"].map((image, index) => (
                  <div key={image} className="relative overflow-hidden rounded-lg border-2 border-accent">
                    <Image src={`/landing/${image}.jpg`} alt="" width={600} height={600} sizes="(min-width: 640px) 110px, 22vw" className="aspect-square w-full object-cover" />
                    <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
            <figcaption className="px-1 pt-2 text-sm font-semibold">{t.shelfCaption}</figcaption>
          </figure>
          <Link href={demoHref} className="card flex flex-col gap-3 p-3 transition-colors hover:border-ink">
            <div className="text-sm font-bold">{t.storefront}</div>
            {t.items.map(([image, title, price]) => (
              <div key={image} className="flex flex-col gap-1">
                <Image src={`/landing/${image}.jpg`} alt="" width={600} height={600} sizes="(min-width: 640px) 220px, 45vw" className="aspect-[4/3] w-full rounded-xl object-cover" />
                <div className="text-sm font-semibold">{title}</div>
                <div className="text-sm font-bold">{price}</div>
              </div>
            ))}
          </Link>
        </div>
      </section>

      <section className="card p-6 sm:p-8" aria-labelledby="problem">
        <h2 id="problem" className="text-3xl font-extrabold">{t.problemTitle}</h2>
        <p className="mt-4 max-w-3xl text-lg text-muted">{t.problemText}</p>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-3xl font-extrabold tracking-tight">{t.stepsTitle}</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {t.steps.map(([title, text], i) => {
            const Icon = STEP_ICONS[i];
            return (
              <div key={title} className="card icon-host flex flex-col gap-2.5 p-6" style={{ "--rise-index": i } as CSSProperties}>
                <div className="icon-badge">
                  <Icon size={24} />
                </div>
                <div className="text-xl font-bold">{title}</div>
                <p className="leading-relaxed text-muted">{text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="features" className="flex flex-col gap-6">
        <h2 id="features" className="text-3xl font-extrabold">{t.featuresTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.map(([title, text]) => (
            <div key={title} className="card p-5">
              <h3 className="font-bold">{title}</h3>
              <p className="mt-2 text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="plans">
        <h2 id="plans" className="text-3xl font-extrabold tracking-tight">{t.plansTitle}</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="card flex flex-col gap-4 p-6">
            <div>
              <div className="text-xl font-bold">Free</div>
              <div className="text-3xl font-extrabold">0 ₸</div>
            </div>
            <ul className="flex flex-col gap-2 text-muted">
              {t.plan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link href="/login" className="btn-accent mt-auto">
              {t.create}
            </Link>
          </div>
          <div className="card flex flex-col gap-4 border-accent p-6">
            <div>
              <div className="text-xl font-bold">Pro</div>
              <div className="text-3xl font-extrabold">{t.proPrice}</div>
            </div>
            <ul className="flex flex-col gap-2 text-muted">
              {t.proPlan.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-auto text-sm text-muted">{t.proNote}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className="mb-6 text-3xl font-extrabold">{t.faqTitle}</h2>
        {t.faq.map(([question, answer]) => (
          <details key={question} className="border-b border-line py-2">
            <summary className="cursor-pointer py-3 font-bold">{question}</summary>
            <p className="pb-4 text-muted">{answer}</p>
          </details>
        ))}
      </section>

      <section className="card flex flex-col items-start gap-4 p-6 sm:p-8">
        <h2 className="text-3xl font-extrabold">{t.ctaTitle}</h2>
        <p className="text-muted">{t.ctaText}</p>
        <Link href="/login" className="btn-accent">{t.create}</Link>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-sm text-muted">
        <div>{t.madeIn}</div>
        <nav aria-label={t.legalNav} className="flex flex-wrap gap-x-5">
          <Link href="/terms" className="flex min-h-11 items-center underline">
            {t.terms}
          </Link>
          <Link href="/privacy" className="flex min-h-11 items-center underline">
            {t.privacy}
          </Link>
        </nav>
      </footer>
    </main>
  );
}
