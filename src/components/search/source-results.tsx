import { useMemo } from "react";

import type { Language, TranslationKey } from "@/lib/i18n";
import type { SourceRecord } from "@/lib/retrieval/types";

import { SourceRecordCard } from "./source-record-card";

export type ResultSourceFilter = "all" | "quran" | "hadith";

const resultSourceFilters: Array<{ id: ResultSourceFilter; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "result.filterAll" },
  { id: "quran", labelKey: "result.filterQuran" },
  { id: "hadith", labelKey: "result.filterHadith" },
];

const sourcePageSize = 5;

type SourceResultsProps = {
  records: SourceRecord[];
  filter: ResultSourceFilter;
  onFilterChange: (filter: ResultSourceFilter) => void;
  page: number;
  onPageChange: (update: (page: number) => number) => void;
  language: Language;
  t: (key: TranslationKey) => string;
};

export function SourceResults({ records, filter, onFilterChange, page, onPageChange, language, t }: SourceResultsProps) {
  const sourceRecords = useMemo(() => {
    if (filter === "hadith") {
      return records.filter((record) => record.sourceKind === "hadith");
    }

    if (filter === "quran") {
      return records.filter((record) => record.sourceKind === "quran" || record.sourceKind === "tafsir");
    }

    return records;
  }, [records, filter]);
  const totalSourcePages = Math.max(1, Math.ceil(sourceRecords.length / sourcePageSize));
  const currentSourcePage = Math.min(page, totalSourcePages);
  const visibleSourceRecords = sourceRecords.slice((currentSourcePage - 1) * sourcePageSize, currentSourcePage * sourcePageSize);

  return (
    <>
      {records.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-1.5">
          {resultSourceFilters.map((option) => (
            <button
              aria-pressed={filter === option.id}
              className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-green)] aria-pressed:bg-[var(--color-green)] aria-pressed:text-white"
              key={option.id}
              onClick={() => {
                onFilterChange(option.id);
                onPageChange(() => 1);
              }}
              type="button"
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      ) : null}

      {sourceRecords.length === 0 && records.length ? (
        <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3 text-sm font-semibold leading-7 text-[var(--color-muted)]">
          {t("result.filterEmpty")}
        </p>
      ) : (
        <div className="mt-4 grid gap-2">
          {visibleSourceRecords.map((record) => (
            <SourceRecordCard key={record.id} language={language} record={record} t={t} />
          ))}
        </div>
      )}

      {sourceRecords.length > sourcePageSize ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
          <button
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-green)] disabled:opacity-40"
            disabled={currentSourcePage === 1}
            onClick={() => onPageChange((current) => Math.max(1, current - 1))}
            type="button"
          >
            {t("result.previousPage")}
          </button>
          <span className="text-xs font-semibold text-[var(--color-muted)]">
            {t("result.pageLabel")} {currentSourcePage} / {totalSourcePages}
          </span>
          <button
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-green)] disabled:opacity-40"
            disabled={currentSourcePage === totalSourcePages}
            onClick={() => onPageChange((current) => Math.min(totalSourcePages, current + 1))}
            type="button"
          >
            {t("result.nextPage")}
          </button>
        </div>
      ) : null}
    </>
  );
}
