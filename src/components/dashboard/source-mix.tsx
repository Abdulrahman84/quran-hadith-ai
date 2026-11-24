import type { Language, TranslationKey } from "@/lib/i18n";

import type { DashboardStats } from "./types";

type SourceMixProps = {
  language: Language;
  sources: DashboardStats["sourceTotals"];
  t: (key: TranslationKey) => string;
};

export function SourceMix({ language, sources, t }: SourceMixProps) {
  const number = new Intl.NumberFormat(language === "ar" ? "ar" : "en");
  const total = sources.quran + sources.tafsir + sources.hadith;
  const rows = [
    { label: t("routes.quran"), value: sources.quran, color: "bg-[var(--color-green)]" },
    { label: t("routes.tafsir"), value: sources.tafsir, color: "bg-[var(--color-gold)]" },
    { label: t("routes.hadith"), value: sources.hadith, color: "bg-[var(--color-green-soft)]" },
  ];

  return (
    <article className="ledger-card p-5">
      <p className="page-kicker">
        {t("dashboard.sources.eyebrow")}
      </p>
      <h2 className="mt-2 text-xl font-bold text-[var(--color-ink)]">{t("dashboard.sources.title")}</h2>

      <div className="mt-7 grid gap-5">
        {rows.map((row) => {
          const percentage = total === 0 ? 0 : Math.round((row.value / total) * 100);

          return (
            <div key={row.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm font-bold">
                <span className="text-[var(--color-ink)]">{row.label}</span>
                <span className="tabular-nums text-[var(--color-muted)]">
                  {number.format(row.value)} · {number.format(percentage)}%
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--background)]"
                role="progressbar"
                aria-label={row.label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
              >
                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${percentage}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}
