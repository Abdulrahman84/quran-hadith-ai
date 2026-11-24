import type { TranslationKey } from "@/lib/i18n";
import {
  formatHadithGrade,
  formatHadithGradeReference,
  formatHadithGradeSource,
  formatSourceDetailLabel,
} from "@/lib/retrieval/source-display";
import type { RetrievalResponse, RetrievalWarning, SourceRecord } from "@/lib/retrieval/types";

type Translate = (key: TranslationKey) => string;

export function getWarningKey(warning: RetrievalWarning): TranslationKey {
  if (warning.code === "no_hadith_results") {
    return "warning.noHadithResults";
  }

  if (warning.code === "no_tafsir_results") {
    return "warning.noTafsirResults";
  }

  if (warning.code === "query_expanded") {
    return "warning.queryExpanded";
  }

  if (warning.code === "invalid_json") {
    return "warning.invalidJson";
  }

  if (warning.code === "empty_question") {
    return "warning.emptyQuestion";
  }

  if (warning.code === "source_tool_router_unavailable") {
    return "warning.sourceToolRouterUnavailable";
  }

  return "warning.generic";
}

export function getAnswerStatusKey(answer: RetrievalResponse["answer"]): TranslationKey {
  if (answer?.status === "disabled") {
    return "result.answerDisabled";
  }

  if (answer?.status === "error") {
    return "result.answerError";
  }

  if (answer?.status === "insufficient_sources") {
    return "result.answerInsufficient";
  }

  return "result.answerPending";
}

export function warningToneClass(warning: RetrievalWarning) {
  if (warning.code === "query_expanded") {
    return "border-[var(--color-green)]/20 bg-[var(--color-primary-soft)] text-[var(--color-green)]";
  }

  if (warning.code === "no_hadith_results" || warning.code === "no_tafsir_results") {
    return "border-[var(--color-gold)]/40 bg-[var(--color-gold-soft)] text-[var(--color-ink)]";
  }

  return "border-[var(--color-red)]/24 bg-[var(--color-error-soft)] text-[var(--color-red)]";
}

export function sourceKindLabel(record: SourceRecord, t: Translate) {
  if (record.sourceKind === "hadith") {
    return t("routes.hadith");
  }

  if (record.sourceKind === "tafsir") {
    return t("routes.tafsir");
  }

  return t("routes.quran");
}

export function recordDetailBadge(record: SourceRecord, language: "ar" | "en", t: Translate) {
  if (record.sourceKind === "hadith") {
    return record.grade ? formatHadithGrade(record.grade.value, language) : t("result.gradeUnavailable");
  }

  if (record.sourceKind === "tafsir") {
    const source = record.tafsirSource || t("result.tafsirUnavailable");
    return formatSourceDetailLabel(source, record.sourceKind, language);
  }

  return null;
}

export function recordGradeMetadata(record: SourceRecord, language: "ar" | "en", t: Translate) {
  if (record.sourceKind !== "hadith" || !record.grade) {
    return "";
  }

  return [
    record.grade.source
      ? `${t("result.gradeSourceLabel")}: ${formatHadithGradeSource(record.grade.source, language)}`
      : null,
    record.grade.sourceReference
      ? `${t("result.gradeReferenceLabel")}: ${formatHadithGradeReference(record.grade.sourceReference, language)}`
      : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function recordMetadata(record: SourceRecord, language: string, t: Translate) {
  if (record.sourceKind === "hadith") {
    if (!record.book && !record.chapter) {
      return "";
    }

    if (language === "ar") {
      return [
        record.book && !/[A-Za-z]/.test(record.book) ? `${t("result.bookLabel")}: ${record.book}` : null,
        record.chapter && !/[A-Za-z]/.test(record.chapter) ? `${t("result.chapterLabel")}: ${record.chapter}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
    }

    return [record.book, record.chapter].filter(Boolean).join(" / ");
  }

  return [
    record.translationEdition && (language !== "ar" || !/[A-Za-z]/.test(record.translationEdition))
      ? `${t("result.translationLabel")}: ${record.translationEdition}`
      : null,
    record.tafsirSource && (language !== "ar" || !/[A-Za-z]/.test(record.tafsirSource))
      ? `${t("result.tafsirLabel")}: ${record.tafsirSource}`
      : null,
  ]
    .filter(Boolean)
    .join(" / ");
}
