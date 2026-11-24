"use client";

import { useI18n } from "@/components/i18n-provider";
import { AnswerPath } from "@/components/how-it-works/answer-path";
import { ProblemSolutionSection } from "@/components/how-it-works/problem-solution-section";

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] pt-20 text-[var(--color-ink)] sm:pt-24">

      <section className="relative z-10 mx-auto max-w-6xl overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="animate-rise relative z-10 max-w-4xl">
          <p className="page-kicker">{t("how.eyebrow")}</p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.25] text-[var(--color-ink)] sm:text-5xl">
            {t("how.title")}
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-[var(--color-muted)] sm:text-lg sm:leading-9">
            {t("how.intro")}
          </p>
        </div>
      </section>

      <ProblemSolutionSection />
      <AnswerPath />
    </main>
  );
}
