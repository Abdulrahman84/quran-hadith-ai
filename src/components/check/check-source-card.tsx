import { SourceRecordText } from "@/components/source-record-text";
import type { TranslationKey } from "@/lib/i18n";
import {
  formatHadithGrade,
  formatSourceRecordTitle,
} from "@/lib/retrieval/source-display";
import type { SourceRecord } from "@/lib/retrieval/types";

type CheckSourceCardProps = {
  record: SourceRecord;
  language: "ar" | "en";
  t: (key: TranslationKey) => string;
};

function reference(record: SourceRecord) {
  if (record.sourceKind === "quran") {
    return record.verseKey || record.reference;
  }

  return [record.displayName, record.hadithNumber || record.reference].filter(Boolean).join(" · ");
}

export function CheckSourceCard({ record, language, t }: CheckSourceCardProps) {
  const grade = record.grade ? formatHadithGrade(record.grade.value, language) : null;

  return (
    <article className="border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <strong className="text-sm font-bold text-[var(--color-green)]">
          {formatSourceRecordTitle(record, language)}
        </strong>
        <span className="source-detail-badge">{reference(record)}</span>
      </div>
      {grade ? (
        <p className="mt-2 text-xs font-semibold text-[var(--color-green-soft)]">
          {t("check.gradeLabel")}: {grade}
        </p>
      ) : null}
      <SourceRecordText language={language} record={record} t={t} />
    </article>
  );
}
