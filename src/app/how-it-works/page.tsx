"use client";

import { useI18n } from "@/components/i18n-provider";
import { AnswerPath } from "@/components/how-it-works/answer-path";
import { ProblemSolutionSection } from "@/components/how-it-works/problem-solution-section";
import { IslamicGeometry } from "@/components/islamic-geometry";

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />

      <section className="relative z-10 mx-auto max-w-6xl overflow-hidden px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <IslamicGeometry
          className="end-[-6rem] top-10 h-64 w-64 text-[var(--color-gold)] opacity-[0.055]"
          variant="lattice"
        />
        <div className="animate-rise relative z-10 max-w-4xl">
          <p className="text-xs font-bold text-[var(--color-green)]">{t("how.eyebrow")}</p>
          <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.18] text-[var(--color-ink)] sm:text-6xl">
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
