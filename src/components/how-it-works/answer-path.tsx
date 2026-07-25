"use client";

import { useI18n } from "@/components/i18n-provider";
import { IslamicGeometry } from "@/components/islamic-geometry";
import type { TranslationKey } from "@/lib/i18n";

const steps: Array<{ titleKey: TranslationKey; textKey: TranslationKey }> = [
  { titleKey: "how.step.route.title", textKey: "how.step.route.text" },
  { titleKey: "how.step.retrieve.title", textKey: "how.step.retrieve.text" },
  { titleKey: "how.step.pack.title", textKey: "how.step.pack.text" },
  { titleKey: "how.step.compose.title", textKey: "how.step.compose.text" },
];

export function AnswerPath() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 mx-auto max-w-6xl overflow-hidden px-5 py-20 sm:px-8 sm:py-28">
      <IslamicGeometry
        className="end-[-5rem] top-8 h-56 w-56 text-[var(--color-gold)] opacity-[0.06]"
        variant="steps"
      />

      <div className="relative z-10 mb-14 max-w-3xl">
        <p className="text-xs font-bold text-[var(--color-green)]">{t("how.flow.eyebrow")}</p>
        <h2 className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] sm:text-4xl">
          {t("how.flow.title")}
        </h2>
        <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("how.flow.text")}</p>
      </div>

      <div className="relative z-10">
        <span
          aria-hidden="true"
          className="absolute inset-block-5 start-[21px] w-px bg-[var(--color-gold)]/40 lg:hidden"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-[21px] hidden h-px bg-[var(--color-gold)]/45 lg:block"
        />

        <div className="grid gap-y-10 lg:grid-cols-4 lg:gap-y-0">
          {steps.map((step, index) => (
            <article
              className={`animate-rise relative lg:min-w-0 ${
                index < steps.length - 1 ? "lg:border-e lg:border-[var(--color-border)]" : ""
              }`}
              key={step.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-start gap-5 lg:block">
                <span className="relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--color-gold)] bg-[var(--color-surface)] font-mono text-xs font-bold text-[var(--color-gold)] lg:mb-10">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={stepPadding(index)}>
                  <h3 className="text-xl font-bold text-[var(--color-ink)]">{t(step.titleKey)}</h3>
                  <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">{t(step.textKey)}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function stepPadding(index: number) {
  if (index === 0) {
    return "lg:pe-8";
  }

  if (index === steps.length - 1) {
    return "lg:ps-8";
  }

  return "lg:px-8";
}
