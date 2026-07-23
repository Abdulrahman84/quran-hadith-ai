import type { Language, TranslationKey } from "@/lib/i18n";

import type { DashboardRun, DashboardStatus } from "./types";

type QuestionResultsProps = {
  runs: DashboardRun[] | undefined;
  language: Language;
  status: DashboardStatus;
  setStatus: (status: DashboardStatus) => void;
  t: (key: TranslationKey) => string;
};

const statuses: DashboardStatus[] = ["all", "completed", "needs_review", "failed"];

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

export function QuestionResults({ runs, language, status, setStatus, t }: QuestionResultsProps) {
  const locale = language === "ar" ? "ar" : "en";
  const number = new Intl.NumberFormat(locale);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(22,58,95,0.05)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-green-soft)]">
              {t("dashboard.questions.eyebrow")}
            </p>
          </div>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-green)]">{t("dashboard.questions.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--color-muted)]">
            {t("dashboard.questions.description")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2" aria-label={t("dashboard.questions.filterLabel")}>
          {statuses.map((item) => (
            <button
              aria-pressed={status === item}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-bold text-[var(--color-green)] transition hover:border-[var(--color-gold)] data-[active=true]:border-[var(--color-green)] data-[active=true]:bg-[var(--color-green)] data-[active=true]:text-white"
              data-active={status === item}
              key={item}
              onClick={() => setStatus(item)}
              type="button"
            >
              {t(statusKey(item))}
            </button>
          ))}
        </div>
      </div>

      {runs === undefined ? (
        <div className="mt-6 grid gap-3" aria-label={t("dashboard.loading")}>
          {[0, 1, 2].map((item) => <div className="h-36 animate-pulse rounded-xl bg-[var(--color-primary-soft)]" key={item} />)}
        </div>
      ) : runs.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
          {t("dashboard.questions.empty")}
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {runs.map((run) => (
            <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)]/65 p-4 sm:p-5" key={run._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[0.65rem] font-bold ${run.isDemo ? "border-[var(--color-gold)]/45 bg-[var(--color-gold-soft)] text-[var(--color-ink)]" : "border-[var(--color-green)]/20 bg-[var(--color-primary-soft)] text-[var(--color-green)]"}`}>
                      {run.isDemo ? t("dashboard.demoBadge") : t("dashboard.liveBadge")}
                    </span>
                  </div>
                  <p className="mt-2 text-base font-bold leading-7 text-[var(--color-green)]" dir="auto">{run.question}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--color-muted)]">
                    {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(new Date(run.occurredAt))}
                  </p>
                </div>
                <span className={`w-fit shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${statusClass(run.status)}`}>
                  {t(statusKey(run.status))}
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--color-green)]/10 bg-[var(--color-surface)] p-4">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">
                  {t("dashboard.questions.result")}
                </p>
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
          ))}
        </div>
      )}
    </section>
  );
}
