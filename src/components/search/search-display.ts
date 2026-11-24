import type { Language, TranslationKey } from "@/lib/i18n";
import { hadithCollections, type HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import {
  formatHadithGrade,
  formatHadithGradeReference,
  formatHadithGradeSource,
  formatSourceDetailLabel,
} from "@/lib/retrieval/source-display";
import { tafsirSources, type TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";
import type { RetrievalResponse, RetrievalWarning, SourceRecord } from "@/lib/retrieval/types";
import type { SearchProgressDetail, SearchProgressPhase, SearchSourceRoute } from "@/lib/search-stream";

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

type ProgressDetailSelection = {
  hadithCollection: HadithCollectionSelection;
  tafsirSource: TafsirSourceSelection;
};

function sourceRouteLabel(
  route: SearchSourceRoute,
  selection: ProgressDetailSelection,
  language: Language,
  t: Translate,
) {
  const labelField = language === "ar" ? "labelAr" : "labelEn";

  if (route === "hadith" && selection.hadithCollection !== "all") {
    return hadithCollections.find((collection) => collection.id === selection.hadithCollection)?.[labelField] ?? t("loading.source.hadith");
  }

  if (route === "tafsir" && selection.tafsirSource !== "all") {
    return tafsirSources.find((source) => source.id === selection.tafsirSource)?.[labelField] ?? t("loading.source.tafsir");
  }

  return t(route === "hadith" ? "loading.source.hadith" : "loading.source.tafsir");
}

/**
 * The quiet sub-line under the active loading step. Built only from what the
 * progress events reported: the source routes being searched and how many
 * finished, then the number of records retrieval returned.
 */
export function formatProgressDetail(
  phase: SearchProgressPhase,
  detail: SearchProgressDetail,
  selection: ProgressDetailSelection,
  language: Language,
  t: Translate,
): string | null {
  if (phase === "retrieving" && detail.sources?.length) {
    const names = detail.sources.map((route) => sourceRouteLabel(route, selection, language, t)).join(language === "ar" ? "، " : ", ");
    const done =
      detail.total !== undefined && detail.completed !== undefined && detail.total > 1
        ? ` · ${t("loading.sourcesDone").replace("{completed}", String(detail.completed)).replace("{total}", String(detail.total))}`
        : "";

    return `${names}${done}`;
  }

  if ((phase === "answering" || phase === "finalizing") && detail.records !== undefined) {
    return t("loading.records").replace("{count}", String(detail.records));
  }

  return null;
}
