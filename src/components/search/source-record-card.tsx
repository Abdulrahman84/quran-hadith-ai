import { SourceRecordText } from "@/components/source-record-text";
import type { Language, TranslationKey } from "@/lib/i18n";
import { formatSourceRecordTitle } from "@/lib/retrieval/source-display";
import type { SourceRecord } from "@/lib/retrieval/types";

import { recordDetailBadge, recordGradeMetadata, recordMetadata, sourceKindLabel } from "./search-display";

type SourceRecordCardProps = {
  record: SourceRecord;
  language: Language;
  t: (key: TranslationKey) => string;
};

export function SourceRecordCard({ record, language, t }: SourceRecordCardProps) {
  const metadata = recordMetadata(record, language, t);
  const gradeMetadata = recordGradeMetadata(record, language, t);
  const detailBadge = recordDetailBadge(record, language, t);

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(22,58,95,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm font-bold text-[var(--color-green)]">
          {formatSourceRecordTitle(record, language)}
        </strong>
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="source-type-badge">{sourceKindLabel(record, t)}</span>
          {detailBadge ? <span className="source-detail-badge">{detailBadge}</span> : null}
        </span>
      </div>
      {metadata ? (
        <p
          className={`mt-2 text-xs font-semibold text-[var(--color-muted)] ${
            language === "ar" ? "" : "uppercase tracking-[0.12em]"
          }`}
        >
          {metadata}
        </p>
      ) : null}
      {gradeMetadata ? (
        <p className="mt-2 text-xs font-medium leading-6 text-[var(--color-green-soft)]">
          {gradeMetadata}
        </p>
      ) : null}
      <SourceRecordText language={language} record={record} t={t} />
    </article>
  );
}
