import type { Language, TranslationKey } from "@/lib/i18n";
import type { RetrievalResponse } from "@/lib/retrieval/types";

import { getAnswerStatusKey, getWarningKey, warningToneClass } from "./search-display";
import { SourceResults, type ResultSourceFilter } from "./source-results";

type SearchResultProps = {
  retrieval: RetrievalResponse | null;
  draftWasReplaced: boolean;
  sourceFilter: ResultSourceFilter;
  onSourceFilterChange: (filter: ResultSourceFilter) => void;
  sourcePage: number;
  onSourcePageChange: (update: (page: number) => number) => void;
  language: Language;
  t: (key: TranslationKey) => string;
};

export function SearchResult({
  retrieval,
  draftWasReplaced,
  sourceFilter,
  onSourceFilterChange,
  sourcePage,
  onSourcePageChange,
  language,
  t,
}: SearchResultProps) {
  return (
    <>
      {retrieval?.status === "empty" ? (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-semibold leading-7 text-[var(--color-muted)]">
          {t("result.empty")}
        </p>
      ) : null}
      {retrieval?.quotationMatch?.state === "similar" ? (
        <p className="mb-3 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold-soft)] p-3 text-sm font-semibold leading-7 text-[var(--color-ink)]">
          {t("result.similarSourceNotice")}
        </p>
      ) : null}
      {draftWasReplaced ? (
        <p className="mb-3 rounded-lg border border-[var(--color-gold)]/40 bg-[var(--color-gold-soft)] p-3 text-sm font-semibold leading-7 text-[var(--color-ink)]" role="status">
          {t("result.draftReplaced")}
        </p>
      ) : null}
      {retrieval?.answer?.status === "ready" && retrieval.answer.text ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">
            {t("result.answerTitle")}
          </p>
          <p
            className="whitespace-pre-wrap text-sm font-semibold leading-8 text-[var(--color-green)]"
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            {retrieval.answer.text}
          </p>
          {retrieval.answer.citations.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {retrieval.answer.citations.map((citation) => (
                <span
                  className="source-detail-badge"
                  key={citation}
                >
                  {citation}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p
          className={`mt-3 rounded-lg border p-3 text-sm font-semibold leading-7 ${
            retrieval?.answer?.status === "error"
              ? "border-[var(--color-red)]/24 bg-[var(--color-error-soft)] text-[var(--color-red)]"
              : "border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-green)]"
          }`}
        >
          {t(getAnswerStatusKey(retrieval?.answer))}
        </p>
      )}

      <SourceResults
        filter={sourceFilter}
        language={language}
        onFilterChange={onSourceFilterChange}
        onPageChange={onSourcePageChange}
        page={sourcePage}
        records={retrieval?.records ?? []}
        t={t}
      />

      {retrieval?.warnings.length ? (
        <div className="mt-4 grid gap-2">
          {retrieval.warnings.map((warning) => (
            <p className={`rounded-lg border p-3 text-sm font-medium leading-6 ${warningToneClass(warning)}`} key={warning.code}>
              {t(getWarningKey(warning))}
            </p>
          ))}
        </div>
      ) : null}
    </>
  );
}
