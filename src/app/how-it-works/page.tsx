"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const steps: Array<{ titleKey: TranslationKey; textKey: TranslationKey }> = [
  {
    titleKey: "how.step.route.title",
    textKey: "how.step.route.text",
  },
  {
    titleKey: "how.step.retrieve.title",
    textKey: "how.step.retrieve.text",
  },
  {
    titleKey: "how.step.pack.title",
    textKey: "how.step.pack.text",
  },
  {
    titleKey: "how.step.compose.title",
    textKey: "how.step.compose.text",
  },
];

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-[var(--color-sand)] text-[var(--color-ink)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-green)]/10 bg-[var(--color-sand)]/88 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
          <Link className="text-sm font-black uppercase tracking-[0.2em] text-[var(--color-green)]" href="/">
            Sanad AI
          </Link>
          <nav className="flex items-center gap-2 text-sm font-black">
            <Link className="nav-link" href="/source-policy">
              {t("nav.sourcePolicy")}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--color-red)]">{t("how.eyebrow")}</p>
        <h1 className="mt-5 max-w-4xl text-balance text-5xl font-black leading-tight text-[var(--color-green)]">
          {t("how.title")}
        </h1>
        <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-[var(--color-muted)]">{t("how.intro")}</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-5 pb-16 md:grid-cols-2">
        {steps.map((step, index) => (
          <article className="product-card animate-rise" key={step.titleKey} style={{ animationDelay: `${index * 90}ms` }}>
            <span className="text-sm font-black text-[var(--color-red)]">{String(index + 1).padStart(2, "0")}</span>
            <h2 className="mt-5 text-2xl font-black text-[var(--color-green)]">{t(step.titleKey)}</h2>
            <p className="mt-4 text-sm font-bold leading-7 text-[var(--color-muted)]">{t(step.textKey)}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
