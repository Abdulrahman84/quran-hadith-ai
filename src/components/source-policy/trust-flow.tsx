"use client";

import { useI18n } from "@/components/i18n-provider";
import { PolicyFlowIcon, type PolicyFlowIconType } from "@/components/source-policy/flow-icon";
import type { TranslationKey } from "@/lib/i18n";

const items: Array<{
  icon: PolicyFlowIconType;
  titleKey: TranslationKey;
  textKey: TranslationKey;
}> = [
  { icon: "source", titleKey: "policy.flow.sources.title", textKey: "policy.flow.sources.text" },
  { icon: "arrange", titleKey: "policy.flow.arrange.title", textKey: "policy.flow.arrange.text" },
  { icon: "answer", titleKey: "policy.flow.answer.title", textKey: "policy.flow.answer.text" },
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
          <p className="text-xs font-bold text-[var(--color-green)]">{t("policy.flow.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] sm:text-4xl">
            {t("policy.flow.title")}
          </h2>
          <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.flow.text")}</p>
        </div>

        <div className="relative grid gap-10 lg:grid-cols-3 lg:gap-0">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-6 hidden h-px bg-[var(--color-border)] lg:block"
          />
          {items.map((item, index) => (
            <article
              className={`animate-rise relative z-10 ${itemPadding(index)}`}
              key={item.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="mb-5 flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--color-green)] text-[var(--color-gold-on-dark)]">
                  <PolicyFlowIcon type={item.icon} />
                </span>
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
