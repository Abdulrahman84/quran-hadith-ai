"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const items: Array<{
  titleKey: TranslationKey;
  textKey: TranslationKey;
}> = [
  { titleKey: "policy.flow.sources.title", textKey: "policy.flow.sources.text" },
  { titleKey: "policy.flow.arrange.title", textKey: "policy.flow.arrange.text" },
  { titleKey: "policy.flow.answer.title", textKey: "policy.flow.answer.text" },
];

export function TrustFlow() {
  const { t } = useI18n();

  return (
    <section
      className="relative z-10 scroll-mt-24 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-16 sm:py-24"
      id="trust-flow"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-12 max-w-3xl">
          <p className="page-kicker">{t("policy.flow.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] sm:text-4xl">
            {t("policy.flow.title")}
          </h2>
          <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.flow.text")}</p>
        </div>

        <div className="relative grid gap-10 lg:grid-cols-3 lg:gap-0">
          {items.map((item, index) => (
            <article
              className={`animate-rise relative z-10 ${itemPadding(index)}`}
              key={item.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="mb-5 flex items-center gap-4">
                <span className="step-numeral">{String(index + 1).padStart(2, "0")}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-[var(--color-border)] lg:hidden" />
              </div>
              <h3 className="text-xl font-bold text-[var(--color-ink)]">{t(item.titleKey)}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">{t(item.textKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function itemPadding(index: number) {
  if (index === 0) {
    return "lg:pe-12";
  }

  if (index === items.length - 1) {
    return "lg:ps-12";
  }

  return "lg:px-12";
}
