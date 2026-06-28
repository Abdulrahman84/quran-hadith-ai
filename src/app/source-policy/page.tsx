"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const ruleKeys: TranslationKey[] = [
  "policy.rule.one",
  "policy.rule.two",
  "policy.rule.three",
  "policy.rule.four",
  "policy.rule.five",
];

export default function SourcePolicy() {
  const { t } = useI18n();

  return (
    <main className="min-h-screen bg-[var(--color-sand)] text-[var(--color-ink)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link className="text-sm font-black uppercase tracking-[0.2em] text-[var(--color-green)]" href="/">
          Sanad AI
        </Link>
        <nav className="flex items-center gap-2 text-sm font-black">
          <Link className="nav-link" href="/how-it-works">
            {t("nav.howItWorks")}
          </Link>
          <LanguageSwitcher />
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--color-red)]">{t("policy.eyebrow")}</p>
          <h1 className="mt-5 max-w-4xl text-balance text-5xl font-black leading-tight text-[var(--color-green)]">
            {t("policy.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg font-bold leading-8 text-[var(--color-muted)]">{t("policy.intro")}</p>
        </div>

        <aside className="rounded-[2rem] border border-[var(--color-green)] bg-[var(--color-green)] p-6 text-[var(--color-sand)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--color-gold)]">
            {t("policy.statusLabel")}
          </p>
          <h2 className="mt-4 text-3xl font-black">{t("policy.statusTitle")}</h2>
          <p className="mt-4 text-sm font-bold leading-7 text-white/72">{t("policy.statusText")}</p>
        </aside>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="grid gap-3">
          {ruleKeys.map((ruleKey, index) => (
            <article
              className="animate-rise rounded-[1.75rem] border border-[var(--color-green)]/16 bg-white/72 p-5"
              key={ruleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <span className="text-sm font-black text-[var(--color-red)]">{String(index + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-lg font-black leading-8 text-[var(--color-green)]">{t(ruleKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
