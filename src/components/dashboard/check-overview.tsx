import type { Language, TranslationKey } from "@/lib/i18n";

import type { DashboardStats } from "./types";

type CheckOverviewProps = {
  language: Language;
  stats: DashboardStats;
  t: (key: TranslationKey) => string;
};

export function CheckOverview({ language, stats, t }: CheckOverviewProps) {
  const number = new Intl.NumberFormat(language === "ar" ? "ar" : "en");
  const outcomes = [
    { label: t("dashboard.check.exact"), value: stats.checkTotals.exact },
    { label: t("dashboard.check.similar"), value: stats.checkTotals.similar },
    { label: t("dashboard.check.notFound"), value: stats.checkTotals.notFound },
  ];

  return (
    <article className="rounded-2xl border border-[var(--color-border)] border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(23,26,25,0.05)]">
      <p className="text-xs font-bold text-[var(--color-green)]">{t("dashboard.check.eyebrow")}</p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">{t("dashboard.check.title")}</h2>
        <span className="text-2xl font-black tabular-nums text-[var(--color-green)]">
          {number.format(stats.workflowTotals.check)}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
        <span className="source-type-badge">{t("dashboard.check.ayah")} · {number.format(stats.checkTotals.ayah)}</span>
        <span className="source-type-badge">{t("dashboard.check.hadith")} · {number.format(stats.checkTotals.hadith)}</span>
      </div>

      <dl className="mt-5 grid gap-2">
        {outcomes.map((outcome) => (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-[var(--color-gold-soft)]/45 px-3 py-2" key={outcome.label}>
            <dt className="text-xs font-bold text-[var(--color-muted)]">{outcome.label}</dt>
            <dd className="font-black tabular-nums text-[var(--color-ink)]">{number.format(outcome.value)}</dd>
          </div>
        ))}
      </dl>

      {stats.checkTotals.unclassified > 0 ? (
        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--color-muted)]">
          {number.format(stats.checkTotals.unclassified)} {t("dashboard.check.unclassified")}
        </p>
      ) : null}
    </article>
  );
}
