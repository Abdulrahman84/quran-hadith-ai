"use client";

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

function PageIcon({ type }: { type: "risk" | "solve" }) {
  if (type === "risk") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d="M12 4 3.5 19h17L12 4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path d="M12 9v4M12 16.5h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
      </svg>
    );
  }

  if (type === "solve") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path
          d="m5 13 4 4L19 7"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Z"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  return null;
}

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-10 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
        <p className="text-xs font-bold text-[var(--color-green)]">{t("how.eyebrow")}</p>
        <h1 className="mt-5 max-w-4xl text-balance text-4xl font-bold leading-[1.18] text-[var(--color-ink)] sm:text-6xl">
          {t("how.title")}
        </h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-[var(--color-muted)] sm:text-lg sm:leading-9">
          {t("how.intro")}
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-8 overflow-hidden rounded-[1.75rem] border border-[var(--color-ink)] border-t-4 border-t-[var(--color-gold)] bg-[var(--color-ink)] px-5 py-8 text-[var(--color-sand)] shadow-[0_24px_70px_rgba(23,26,25,0.18)] sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] lg:items-center">
          <div className="animate-rise">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--color-gold)]/65 bg-[var(--color-gold)]/10 text-[var(--color-gold-on-dark)]">
                <PageIcon type="risk" />
              </span>
              <p className="text-xs font-bold text-[var(--color-gold-on-dark)]">
                {t("how.problem.general.label")}
              </p>
            </div>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">{t("how.problem.general.title")}</h2>
            <p className="mt-4 text-base font-medium leading-8 text-white/76">{t("how.problem.general.text")}</p>
            <p className="mt-5 border-s-4 border-[var(--color-gold)]/70 ps-4 text-xl font-semibold leading-9 text-white">
              {t("how.problem.general.callout")}
            </p>
          </div>

          <div className="relative grid place-items-center text-[var(--color-gold-on-dark)] lg:h-full">
            <div className="hidden h-full w-px bg-[var(--color-gold)]/35 lg:block" aria-hidden="true" />
            <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--color-gold)] bg-[var(--color-ink)] text-xl font-bold shadow-[0_0_0_10px_var(--color-ink)] lg:absolute">
              ←
            </div>
          </div>

          <div className="animate-rise [animation-delay:90ms]">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-gold)] text-[var(--color-ink)]">
                <PageIcon type="solve" />
              </span>
              <p className="text-xs font-bold text-[var(--color-gold-on-dark)]">
                {t("how.problem.solution.label")}
              </p>
            </div>
            <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">{t("how.problem.solution.title")}</h2>
            <p className="mt-4 text-base font-medium leading-8 text-white/76">{t("how.problem.solution.text")}</p>
            <div className="mt-5 grid gap-2">
              <p className="rounded-lg border border-[var(--color-gold)]/28 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm font-semibold text-white/86">
                {t("how.problem.solution.stepOne")}
              </p>
              <p className="rounded-lg border border-[var(--color-gold)]/28 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm font-semibold text-white/86">
                {t("how.problem.solution.stepTwo")}
              </p>
              <p className="rounded-lg border border-[var(--color-gold)]/28 bg-[var(--color-gold)]/8 px-4 py-2.5 text-sm font-semibold text-white/86">
                {t("how.problem.solution.stepThree")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mb-4">
          <p className="text-xs font-bold text-[var(--color-green)]">
            {t("how.flow.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-ink)] sm:text-3xl">
            {t("how.flow.title")}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--color-muted)]">{t("how.flow.text")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {steps.map((step, index) => (
            <article
              className="product-card animate-rise border-t-[3px] border-t-[var(--color-gold)]"
              key={step.titleKey}
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--color-ink)] text-xs font-bold text-[var(--color-gold-on-dark)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-bold text-[var(--color-ink)]">{t(step.titleKey)}</h2>
              <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-muted)]">{t(step.textKey)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
