# Shared UI components

The project uses custom React/Tailwind components rather than a third-party component library. The reusable UI components relevant to the public shell are reproduced in full below.

## `src/components/language-switcher.tsx` — LanguageSwitcher

Bilingual segmented control with native select fallback.

```tsx
"use client";

import { useI18n } from "@/components/i18n-provider";
import { languages } from "@/lib/i18n";

export function LanguageSwitcher({
  idPrefix = "language",
  onLanguageChange,
}: {
  idPrefix?: string;
  onLanguageChange?: () => void;
}) {
  const { language, setLanguage, t } = useI18n();
  const selectId = `${idPrefix}-select`;

  return (
    <>
      <label className="sr-only" htmlFor={selectId}>
        {t("language.label")}
      </label>
      <select
        className="language-select"
        id={selectId}
        onChange={(event) => {
          setLanguage(event.target.value as typeof language);
          onLanguageChange?.();
        }}
        value={language}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.label}
          </option>
        ))}
      </select>
      <div aria-label={t("language.label")} className="language-switcher" role="group">
        {languages.map((item) => (
          <button
            aria-pressed={language === item.code}
            className="language-option"
            data-active={language === item.code}
            key={item.code}
            onClick={() => {
              setLanguage(item.code);
              onLanguageChange?.();
            }}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
```

## `src/components/policy-section-nav.tsx` — PolicySectionNav

Scrollable in-page navigation for the source policy.

```tsx
"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const sections: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "#trust-flow", labelKey: "policy.nav.flow" },
  { href: "#approved-sources", labelKey: "policy.nav.sources" },
  { href: "#guardrails", labelKey: "policy.nav.guardrails" },
  { href: "#provenance", labelKey: "policy.nav.provenance" },
];

export function PolicySectionNav() {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("policy.nav.label")}
      className="mt-7 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max gap-2">
        {sections.map((section, index) => (
          <a
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-green)] shadow-[0_8px_20px_rgba(22,58,95,0.04)] transition hover:border-[var(--color-green-soft)] hover:bg-[var(--color-primary-soft)]"
            href={section.href}
            key={section.href}
          >
            <span className="text-xs text-[var(--color-green)]">{String(index + 1).padStart(2, "0")}</span>
            {t(section.labelKey)}
          </a>
        ))}
      </div>
    </nav>
  );
}
```

## `src/components/provenance-card.tsx` — ProvenanceCard

Expandable provenance record. Props: `index`, `titleKey`, `originKey`, `useKey`, `visibleKey`, `noteKey`.

```tsx
"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

type ProvenanceCardProps = {
  index: number;
  titleKey: TranslationKey;
  originKey: TranslationKey;
  useKey: TranslationKey;
  visibleKey: TranslationKey;
  noteKey: TranslationKey;
};

export function ProvenanceCard({ index, titleKey, originKey, useKey, visibleKey, noteKey }: ProvenanceCardProps) {
  const { t } = useI18n();

  return (
    <details
      className="animate-rise group rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] p-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--color-green)] [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-green)] text-sm font-bold text-[var(--color-gold-on-dark)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-7 text-[var(--color-green)]">{t(titleKey)}</span>
          <span className="block text-sm font-semibold leading-6 text-[var(--color-green-soft)]">{t(originKey)}</span>
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-[var(--color-green)] transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m7 9 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 lg:grid-cols-3">
        <ProvenanceField label={t("policy.provenance.useLabel")} text={t(useKey)} />
        <ProvenanceField label={t("policy.provenance.visibleLabel")} text={t(visibleKey)} />
        <ProvenanceField label={t("policy.provenance.noteLabel")} text={t(noteKey)} />
      </div>
    </details>
  );
}

function ProvenanceField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-green)]/70">{label}</p>
      <p className="mt-2 text-sm font-medium leading-7 text-[var(--color-muted)]">{text}</p>
    </div>
  );
}
```

## `src/components/dashboard/stat-card.tsx` — StatCard

Metric card. Props: `label`, `value`, `note`.

```tsx
type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(22,58,95,0.06)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">{label}</p>
      <p className="mt-3 text-4xl font-bold tabular-nums text-[var(--color-green)]">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-[var(--color-muted)]">{note}</p>
    </article>
  );
}
```
