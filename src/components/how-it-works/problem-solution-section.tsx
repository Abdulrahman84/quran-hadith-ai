"use client";

import { useI18n } from "@/components/i18n-provider";

export function ProblemSolutionSection() {
  const { t } = useI18n();

  return (
    <section className="relative z-10 border-y border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-6xl px-5 sm:px-8 lg:grid-cols-2">
        <article className="animate-rise border-b border-[var(--color-border)] py-14 lg:border-b-0 lg:border-e lg:pe-16 lg:py-20">
          <SectionLabel icon="risk" label={t("how.problem.general.label")} />
          <h2 className="mt-6 text-3xl font-bold leading-tight text-[var(--color-ink)]">
            {t("how.problem.general.title")}
          </h2>
          <p className="mt-5 text-base font-medium leading-8 text-[var(--color-muted)]">
            {t("how.problem.general.text")}
          </p>
          <p className="mt-7 border-s-2 border-[var(--color-red)]/45 ps-5 text-lg font-semibold leading-9 text-[var(--color-ink)]">
            {t("how.problem.general.callout")}
          </p>
        </article>

        <article className="animate-rise py-14 [animation-delay:90ms] lg:ps-16 lg:py-20">
          <SectionLabel icon="solution" label={t("how.problem.solution.label")} />
          <h2 className="mt-6 text-3xl font-bold leading-tight text-[var(--color-ink)]">
            {t("how.problem.solution.title")}
          </h2>
          <p className="mt-5 text-base font-medium leading-8 text-[var(--color-muted)]">
            {t("how.problem.solution.text")}
          </p>
          <ul className="mt-7 border-y border-[var(--color-border)]">
            <SolutionPoint text={t("how.problem.solution.stepOne")} />
            <SolutionPoint text={t("how.problem.solution.stepTwo")} />
            <SolutionPoint text={t("how.problem.solution.stepThree")} />
          </ul>
        </article>
      </div>
    </section>
  );
}

function SectionLabel({ icon, label }: { icon: "risk" | "solution"; label: string }) {
  return (
    <p className="page-kicker" data-tone={icon === "risk" ? "risk" : undefined}>
      {label}
    </p>
  );
}

function SolutionPoint({ text }: { text: string }) {
  return (
    <li className="flex gap-4 border-t border-[var(--color-border)] py-4 first:border-t-0">
      <span aria-hidden="true" className="rule-diamond mt-3" />
      <p className="text-sm font-semibold leading-7 text-[var(--color-ink)]">{text}</p>
    </li>
  );
}
