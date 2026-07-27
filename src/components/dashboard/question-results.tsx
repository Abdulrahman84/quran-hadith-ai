import type { Language, TranslationKey } from "@/lib/i18n";

import { QuestionResultCard } from "./question-result-card";
import { QuestionResultsToolbar } from "./question-results-toolbar";
import type { DashboardPaginationStatus, DashboardRun, DashboardStatus } from "./types";

type QuestionResultsProps = {
  language: Language;
  loadMore: () => void;
  paginationStatus: DashboardPaginationStatus;
  runs: DashboardRun[];
  search: string;
  setSearch: (search: string) => void;
  setStatus: (status: DashboardStatus) => void;
  status: DashboardStatus;
  t: (key: TranslationKey) => string;
};

function ResultsLoading({ label }: { label: string }) {
  return (
    <div className="mt-6 grid gap-3" aria-label={label}>
      {[0, 1, 2].map((item) => (
        <div
          className="h-36 animate-pulse rounded-xl border-s-[3px] border-s-[var(--color-gold)] bg-[var(--color-gold-soft)]"
          key={item}
        />
      ))}
    </div>
  );
}

export function QuestionResults(props: QuestionResultsProps) {
  const { language, loadMore, paginationStatus, runs, search, setSearch, setStatus, status, t } = props;
  const isFirstPageLoading = paginationStatus === "LoadingFirstPage";
  const isLoadingMore = paginationStatus === "LoadingMore";

  return (
    <section className="rounded-2xl border border-[var(--color-border)] border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-surface)] p-5 shadow-[0_12px_34px_rgba(23,26,25,0.05)] sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold text-[var(--color-green)]">{t("dashboard.questions.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-ink)]">{t("dashboard.questions.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--color-muted)]">
            {t("dashboard.questions.description")}
          </p>
        </div>

        <QuestionResultsToolbar
          search={search}
          setSearch={setSearch}
          setStatus={setStatus}
          status={status}
          t={t}
        />
      </div>

      {isFirstPageLoading ? (
        <ResultsLoading label={t("dashboard.loading")} />
      ) : runs.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm font-semibold text-[var(--color-muted)]">
          {t("dashboard.questions.empty")}
        </p>
      ) : (
        <div className="mt-6 grid gap-3">
          {runs.map((run) => <QuestionResultCard key={run._id} language={language} run={run} t={t} />)}
        </div>
      )}

      {paginationStatus === "CanLoadMore" || isLoadingMore ? (
        <div className="mt-5 flex justify-center">
          <button
            className="min-h-11 rounded-lg bg-[var(--color-green)] px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            disabled={isLoadingMore}
            onClick={loadMore}
            type="button"
          >
            {isLoadingMore ? t("dashboard.questions.loadingMore") : t("dashboard.questions.loadMore")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
