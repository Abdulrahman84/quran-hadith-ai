"use client";

import { useI18n } from "@/components/i18n-provider";
import { PolicyFlowIcon, type PolicyFlowIconType } from "@/components/source-policy/flow-icon";
import type { TranslationKey } from "@/lib/i18n";

const boundarySteps: Array<{ icon: PolicyFlowIconType; titleKey: TranslationKey }> = [
  { icon: "source", titleKey: "policy.boundary.sources" },
  { icon: "arrange", titleKey: "policy.boundary.model" },
  { icon: "answer", titleKey: "policy.boundary.answer" },
];

const ruleKeys: TranslationKey[] = [
  "policy.rule.one",
  "policy.rule.two",
  "policy.rule.three",
  "policy.rule.four",
  "policy.rule.five",
];

export function Guardrails() {
  const { t } = useI18n();

  return (
    <section
      className="relative z-10 scroll-mt-24 bg-[var(--color-ink)] py-20 text-white sm:py-28"
      id="guardrails"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="lg:border-e lg:border-white/12 lg:pe-12">
            <p className="text-xs font-bold text-[var(--color-gold-on-dark)]">{t("policy.boundary.title")}</p>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">
              {t("policy.guardrails.title")}
            </h2>
            <p className="mt-5 text-sm font-medium leading-8 text-white/70">{t("policy.guardrails.text")}</p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {boundarySteps.map((step, index) => (
              <div className="relative" key={step.titleKey}>
                <span className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-gold)]/50 text-[var(--color-gold-on-dark)]">
                  <PolicyFlowIcon type={step.icon} />
                </span>
                <p className="mt-4 text-sm font-semibold leading-7 text-white">{t(step.titleKey)}</p>
                {index < boundarySteps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute end-0 top-5 hidden h-px w-1/3 bg-[var(--color-gold)]/35 sm:block"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <ol className="mt-16 border-y border-white/15">
          {ruleKeys.map((ruleKey, index) => (
            <li
              className="animate-rise flex gap-5 border-t border-white/15 py-6 first:border-t-0 sm:items-center"
              key={ruleKey}
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="shrink-0 font-mono text-sm font-bold text-[var(--color-gold-on-dark)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-base font-medium leading-8 text-white/88">{t(ruleKey)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
