import type { Language, TranslationKey } from "@/lib/i18n";

import type { DashboardStats } from "./types";

type ActivityChartProps = {
  activity: DashboardStats["dailyActivity"];
  language: Language;
  t: (key: TranslationKey) => string;
};

export function ActivityChart({ activity, language, t }: ActivityChartProps) {
  const maxCount = Math.max(...activity.map((day) => day.count), 1);
  const locale = language === "ar" ? "ar" : "en";
  const number = new Intl.NumberFormat(locale);

  return (
    <article className="rounded-2xl border border-[var(--color-border)] border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(23,26,25,0.05)]">
      <div>
        <p className="text-xs font-bold text-[var(--color-green)]">
          {t("dashboard.activity.eyebrow")}
        </p>
        <h2 className="mt-2 text-xl font-bold text-[var(--color-ink)]">{t("dashboard.activity.title")}</h2>
      </div>

      <div className="mt-7 grid h-44 grid-cols-7 items-end gap-2" role="img" aria-label={t("dashboard.activity.chartLabel")}>
        {activity.map((day) => {
          const label = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(day.dayStart));
          const height = day.count === 0 ? 2 : Math.max((day.count / maxCount) * 100, 10);

          return (
            <div className="grid h-full grid-rows-[1.4rem_1fr_1.4rem] gap-2 text-center" key={day.dayStart}>
              <span className="text-xs font-bold tabular-nums text-[var(--color-green)]">{number.format(day.count)}</span>
              <div className="flex items-end justify-center rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-gold-soft)]/50 px-1" aria-hidden="true">
                <span
                  className="w-full max-w-10 rounded-t-md bg-[var(--color-gold)] shadow-[0_6px_18px_rgba(198,154,75,0.22)]"
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[0.7rem] font-bold text-[var(--color-muted)]">{label}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
