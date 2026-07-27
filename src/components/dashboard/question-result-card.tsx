import type { Language, TranslationKey } from "@/lib/i18n";

import type { DashboardRun, DashboardStatus } from "./types";

type QuestionResultCardProps = {
  language: Language;
  run: DashboardRun;
  t: (key: TranslationKey) => string;
};

const dateTimeFormatters = {
  ar: new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }),
  en: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }),
};

function statusKey(status: DashboardStatus): TranslationKey {
  if (status === "completed") return "dashboard.status.completed";
  if (status === "needs_review") return "dashboard.status.warnings";
  if (status === "failed") return "dashboard.status.failed";
  return "dashboard.status.all";
}

function statusClass(status: DashboardRun["status"]) {
  if (status === "completed") return "border-[var(--color-green)]/20 bg-[var(--color-primary-soft)] text-[var(--color-green)]";
  if (status === "needs_review") return "border-[var(--color-gold)]/45 bg-[var(--color-gold-soft)] text-[var(--color-ink)]";
  return "border-[var(--color-red)]/25 bg-[var(--color-error-soft)] text-[var(--color-red)]";
}

export function QuestionResultCard({ language, run, t }: QuestionResultCardProps) {
  const number = new Intl.NumberFormat(language === "ar" ? "ar" : "en");
  const occurredAt = new Date(run.occurredAt);

  return (
    <article className="rounded-xl border border-[var(--color-border)] border-s-[3px] border-s-[var(--color-gold)] bg-[var(--background)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-bold leading-7 text-[var(--color-ink)]" dir="auto">{run.question}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
            <time dateTime={occurredAt.toISOString()}>{dateTimeFormatters[language].format(occurredAt)}</time>
          </p>
        </div>
        <span className={`w-fit shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${statusClass(run.status)}`}>
          {t(statusKey(run.status))}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--color-gold)]/35 bg-[var(--color-gold-soft)]/40 p-4">
        <p className="text-[0.68rem] font-bold text-[var(--color-green)]">{t("dashboard.questions.result")}</p>
        <p className="mt-2 text-sm font-semibold leading-7 text-[var(--color-ink)]" dir="auto">
          {run.answerText ?? t("dashboard.questions.noAnswer")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] font-bold text-[var(--color-muted)]">
        {run.quranCount > 0 ? <span className="source-type-badge">{t("routes.quran")} · {number.format(run.quranCount)}</span> : null}
        {run.tafsirCount > 0 ? <span className="source-type-badge">{t("routes.tafsir")} · {number.format(run.tafsirCount)}</span> : null}
        {run.hadithCount > 0 ? <span className="source-type-badge">{t("routes.hadith")} · {number.format(run.hadithCount)}</span> : null}
        <span className="source-detail-badge">{number.format(run.citationCount)} {t("dashboard.questions.citations")}</span>
      </div>
    </article>
  );
}
