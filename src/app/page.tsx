"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";
import { hadithCollections, type HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import { formatHadithGrade, formatSourceRecordTitle } from "@/lib/retrieval/source-display";
import { tafsirSources, type TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";
import type { RetrievalResponse, RetrievalWarning } from "@/lib/retrieval/types";

const suggestionKeys: TranslationKey[] = [
  "home.suggestion.intention",
  "home.suggestion.mercy",
  "home.suggestion.prayer",
];

const sourceRoutes: Array<{ id: "Quran" | "Tafsir" | "Hadith"; labelKey: TranslationKey }> = [
  { id: "Quran", labelKey: "routes.quran" },
  { id: "Tafsir", labelKey: "routes.tafsir" },
  { id: "Hadith", labelKey: "routes.hadith" },
];
type ResultSourceFilter = "all" | "quran" | "hadith";

const resultSourceFilters: Array<{ id: ResultSourceFilter; labelKey: TranslationKey }> = [
  { id: "all", labelKey: "result.filterAll" },
  { id: "quran", labelKey: "result.filterQuran" },
  { id: "hadith", labelKey: "result.filterHadith" },
];

const minimumLoadingMs = 5000;
const sourcePageSize = 5;

function resizeQuestionField(element: HTMLTextAreaElement) {
  const maxHeight = 120;

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

function getWarningKey(warning: RetrievalWarning): TranslationKey {
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

function getAnswerStatusKey(answer: RetrievalResponse["answer"]): TranslationKey {
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

function sourceTextForLanguage(
  record: RetrievalResponse["records"][number],
  language: string,
  fallbackText: { arabic: string; english: string },
) {
  if (language === "ar") {
    return {
      dir: "rtl" as const,
      text: [record.arabicText, record.sourceKind === "tafsir" ? record.tafsirText : null].filter(Boolean).join("\n\n") || fallbackText.arabic,
      textClass: "text-right text-base font-semibold leading-8 text-[var(--color-green)]",
    };
  }

  const translatedText = [record.englishText, record.sourceKind === "tafsir" ? record.tafsirText : null].filter(Boolean).join("\n\n");
  const originalText = [record.arabicText, record.sourceKind === "tafsir" ? record.tafsirText : null].filter(Boolean).join("\n\n");
  const direction: "ltr" | "rtl" = record.englishText ? "ltr" : "rtl";

  return {
    dir: direction,
    text: translatedText || originalText || record.arabicText || fallbackText.english,
    textClass: record.englishText
      ? "text-left text-sm font-bold leading-6 text-[var(--color-ink)]"
      : "text-right text-base font-semibold leading-8 text-[var(--color-green)]",
  };
}

function sourceKindLabel(record: RetrievalResponse["records"][number], t: (key: TranslationKey) => string) {
  if (record.sourceKind === "hadith") {
    return t("routes.hadith");
  }

  if (record.sourceKind === "tafsir") {
    return t("routes.tafsir");
  }

  return t("routes.quran");
}

function recordDetailBadge(record: RetrievalResponse["records"][number], language: "ar" | "en", t: (key: TranslationKey) => string) {
  if (record.sourceKind === "hadith") {
    return record.grade ? formatHadithGrade(record.grade.value, language) : t("result.gradeUnavailable");
  }

  if (record.sourceKind === "tafsir") {
    return record.tafsirSource || t("result.tafsirUnavailable");
  }

  return record.translationEdition || record.sourceDataset || null;
}

function recordGradeMetadata(record: RetrievalResponse["records"][number], t: (key: TranslationKey) => string) {
  if (record.sourceKind !== "hadith" || !record.grade) {
    return "";
  }

  return [
    record.grade.source ? `${t("result.gradeSourceLabel")}: ${record.grade.source}` : null,
    record.grade.sourceReference ? `${t("result.gradeReferenceLabel")}: ${record.grade.sourceReference}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function warningToneClass(warning: RetrievalWarning) {
  if (warning.code === "query_expanded") {
    return "border-[var(--color-green)]/20 bg-[var(--color-primary-soft)] text-[var(--color-green)]";
  }

  if (warning.code === "no_hadith_results" || warning.code === "no_tafsir_results") {
    return "border-[var(--color-gold)]/40 bg-[var(--color-gold-soft)] text-[var(--color-ink)]";
  }

  return "border-[var(--color-red)]/24 bg-[var(--color-error-soft)] text-[var(--color-red)]";
}

function recordMetadata(record: RetrievalResponse["records"][number], language: string, t: (key: TranslationKey) => string) {
  if (record.sourceKind === "hadith") {
    if (!record.book && !record.chapter) {
      return "";
    }

    if (language === "ar") {
      return [
        record.book ? `${t("result.bookLabel")}: ${record.book}` : null,
        record.chapter ? `${t("result.chapterLabel")}: ${record.chapter}` : null,
      ]
        .filter(Boolean)
        .join(" / ");
    }

    return [record.book, record.chapter].filter(Boolean).join(" / ");
  }

  return [
    record.translationEdition ? `${t("result.translationLabel")}: ${record.translationEdition}` : null,
    record.tafsirSource ? `${t("result.tafsirLabel")}: ${record.tafsirSource}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

export default function Home() {
  const { language, t } = useI18n();
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const [requestErrorHelp, setRequestErrorHelp] = useState<TranslationKey>("result.checkPaths");
  const [hadithCollection, setHadithCollection] = useState<HadithCollectionSelection>("all");
  const [resultSourceFilter, setResultSourceFilter] = useState<ResultSourceFilter>("all");
  const [tafsirSource, setTafsirSource] = useState<TafsirSourceSelection>("all");
  const [sourcePage, setSourcePage] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasScenario = isRetrieving || Boolean(submittedQuestion) || retrieval !== null || requestError.length > 0;

  const activeRoutes = useMemo(() => {
    const kinds = new Set(retrieval?.records.map((record) => record.sourceKind) ?? []);

    return {
      Quran: kinds.has("quran") || kinds.has("tafsir"),
      Tafsir: kinds.has("tafsir"),
      Hadith: kinds.has("hadith"),
    };
  }, [retrieval]);
  const sourceRecords = useMemo(() => {
    const records = retrieval?.records ?? [];

    if (resultSourceFilter === "hadith") {
      return records.filter((record) => record.sourceKind === "hadith");
    }

    if (resultSourceFilter === "quran") {
      return records.filter((record) => record.sourceKind === "quran" || record.sourceKind === "tafsir");
    }

    return records;
  }, [retrieval, resultSourceFilter]);
  const totalSourcePages = Math.max(1, Math.ceil(sourceRecords.length / sourcePageSize));
  const currentSourcePage = Math.min(sourcePage, totalSourcePages);
  const visibleSourceRecords = sourceRecords.slice((currentSourcePage - 1) * sourcePageSize, currentSourcePage * sourcePageSize);

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  async function runSearch(
    nextQuestion: string,
    selectedTafsirSource = tafsirSource,
    selectedHadithCollection = hadithCollection,
  ) {
    const trimmed = nextQuestion.trim();

    if (!trimmed) {
      return;
    }

    setQuestion(trimmed);
    setSubmittedQuestion(trimmed);
    setRetrieval(null);
    setRequestError("");
    setRequestErrorHelp("result.checkPaths");
    setSourcePage(1);
    setIsRetrieving(true);

    try {
      const [response] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language: language === "ar" ? "arabic" : "english",
            question: trimmed,
            hadithCollection: selectedHadithCollection,
            tafsirSource: selectedTafsirSource,
          }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, minimumLoadingMs)),
      ]);
      const payload = (await response.json()) as RetrievalResponse;

      if (!response.ok) {
        const warning = payload.warnings.at(0);
        setRequestErrorHelp(warning?.code === "source_tool_router_unavailable" ? "result.checkAiRouter" : "result.checkPaths");
        throw new Error(warning ? t(getWarningKey(warning)) : t("warning.generic"));
      }

      setRetrieval(payload);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The source retrieval request failed.");
    } finally {
      setIsRetrieving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(question);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void runSearch(question);
  }

  function handleTafsirSourceChange(nextSource: TafsirSourceSelection) {
    setTafsirSource(nextSource);

    if (submittedQuestion.trim()) {
      void runSearch(submittedQuestion, nextSource, hadithCollection);
    }
  }

  function handleHadithCollectionChange(nextCollection: HadithCollectionSelection) {
    setHadithCollection(nextCollection);

    if (submittedQuestion.trim()) {
      void runSearch(submittedQuestion, tafsirSource, nextCollection);
    }
  }

  return (
    <main className="relative min-h-screen overflow-x-clip bg-[var(--color-sand)] pt-20 text-[var(--color-ink)]">
      <div className="source-grid" aria-hidden="true" />

      <section
        className={`relative z-10 mx-auto flex w-full max-w-[920px] flex-col items-center px-4 text-center sm:px-8 ${
          hasScenario ? "py-4 sm:py-8" : "min-h-[calc(100vh-80px)] py-8 sm:py-10"
        }`}
      >
        {!hasScenario ? (
          <>
            <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-[var(--color-green)]/10 bg-[var(--color-green)]/5 px-4 py-2 text-xs font-bold text-[var(--color-green)]">
              <span className="h-2 w-2 rounded-full bg-[var(--color-green)]" aria-hidden="true" />
              {t("home.eyebrow")}
            </p>
            <h1 className="animate-rise mt-4 text-balance text-[2.15rem] font-bold leading-[1.2] tracking-tight text-[var(--color-ink)] [animation-delay:80ms] sm:mt-5 sm:text-[3.5rem]">
              {t("home.title")}
            </h1>
          </>
        ) : null}

        <form
          className={`search-shell animate-rise w-full overflow-hidden text-start ${
            hasScenario ? "" : "mt-5 sm:mt-6 [animation-delay:160ms]"
          }`}
          onSubmit={handleSubmit}
        >
          <div className="p-4 sm:p-6">
            <div>
              <label className="text-sm font-bold text-[var(--color-muted)]" htmlFor="question">
                {t("home.inputLabel")}
              </label>
            </div>

            <div className="mt-3">
              <textarea
                className={`query-textarea w-full min-w-0 resize-none bg-transparent text-lg font-semibold leading-8 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/50 ${
                  hasScenario ? "min-h-12" : "min-h-14 sm:min-h-16"
                }`}
                id="question"
                onChange={(event) => {
                  resizeQuestionField(event.currentTarget);
                  setQuestion(event.target.value);
                }}
                onInput={(event) => resizeQuestionField(event.currentTarget)}
                onKeyDown={handleQuestionKeyDown}
                onKeyUp={(event) => resizeQuestionField(event.currentTarget)}
                placeholder={t("home.placeholder")}
                ref={textareaRef}
                rows={1}
                value={question}
              />
            </div>

            <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 sm:gap-5 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <div className="grid gap-2 text-start">
                <label className="text-xs font-bold text-[var(--color-muted)]" htmlFor="hadith-collection">
                  {t("home.hadithCollectionLabel")}
                </label>
                <div className="relative">
                  <select
                    className="filter-select disabled:cursor-wait disabled:opacity-60"
                    id="hadith-collection"
                    disabled={isRetrieving}
                    onChange={(event) => handleHadithCollectionChange(event.target.value as HadithCollectionSelection)}
                    value={hadithCollection}
                  >
                    <option value="all">{t("home.hadithCollectionAll")}</option>
                    {hadithCollections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {language === "ar" ? collection.labelAr : collection.labelEn}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="grid gap-2 text-start">
                <label className="text-xs font-bold text-[var(--color-muted)]" htmlFor="tafsir-source">
                  {t("home.tafsirSourceLabel")}
                </label>
                <div className="relative">
                  <select
                    className="filter-select disabled:cursor-wait disabled:opacity-60"
                    id="tafsir-source"
                    disabled={isRetrieving}
                    onChange={(event) => handleTafsirSourceChange(event.target.value as TafsirSourceSelection)}
                    value={tafsirSource}
                  >
                    <option value="all">{t("home.tafsirSourceAll")}</option>
                    {tafsirSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {language === "ar" ? source.labelAr : source.labelEn}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  className="action-button inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] bg-[var(--color-green)] px-8 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-75 lg:w-auto"
                  disabled={isRetrieving}
                  type="submit"
                >
                  <span>{isRetrieving ? t("home.scan") : t("home.search")}</span>
                  <svg className="h-5 w-5 rtl:rotate-180" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

        </form>

        {!hasScenario ? (
          <>
            <div className="animate-rise mt-5 w-full max-w-3xl [animation-delay:220ms]">
              <div className="flex w-full flex-wrap justify-center gap-2">
                {suggestionKeys.map((suggestionKey) => (
                  <button
                    className="chip w-full justify-center whitespace-normal text-center sm:w-auto"
                    key={suggestionKey}
                    onClick={() => void runSearch(t(suggestionKey))}
                    type="button"
                  >
                    {t(suggestionKey)}
                  </button>
                ))}
              </div>
            </div>

            <div className="animate-rise relative mt-8 w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 p-5 shadow-inner [animation-delay:300ms] sm:mt-10 sm:p-9">
              <span className="absolute -end-7 -top-7 h-28 w-28 rounded-full border border-[var(--color-gold)]/20" aria-hidden="true" />
              <p className="relative text-base font-bold text-[var(--color-green)]">
                {t("home.startTitle")}
              </p>
              <p className="relative mx-auto mt-3 max-w-xl text-sm font-medium leading-7 text-[var(--color-muted)]">
                {t("home.startText")}
              </p>
            </div>
          </>
        ) : null}

        {hasScenario ? (
          <section className="mt-3 grid w-full gap-3 text-start">
            <div className="animate-rise rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/92 px-4 py-3 shadow-[0_14px_34px_rgba(22,58,95,0.05)]">
              <div className="source-trail" aria-label={t("result.routes")}>
                {sourceRoutes.map((route, index) => (
                  <span className="contents" key={route.id}>
                    <span className="source-trail-item" data-active={activeRoutes[route.id]}>
                      <span className="source-trail-dot" aria-hidden="true" />
                      <span>{t(route.labelKey)}</span>
                    </span>
                    {index < sourceRoutes.length - 1 ? <span className="source-trail-separator" aria-hidden="true" /> : null}
                  </span>
                ))}
              </div>
            </div>

            <div className="answer-preview rounded-2xl bg-[var(--color-green)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {isRetrieving ? t("result.tracing") : t("result.recordsTitle")}
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-xl whitespace-pre-wrap text-sm font-medium leading-6 text-white/72">
                    {submittedQuestion}
                  </p>
                </div>
                <span className="pulse-dot" aria-hidden="true" />
              </div>

              <div className="mt-4 rounded-xl border border-[var(--color-gold)]/55 bg-[var(--color-sand)] p-4 text-[var(--color-ink)]">
                {isRetrieving ? (
                  <div className="source-loading" role="status" aria-live="polite">
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="source-loading-mark"
                      height={82}
                      src="/assets/sanad-ai-loader.svg?v=midnight-manuscript-3"
                      style={{ height: "auto", width: "min(17rem, 72vw)" }}
                      unoptimized
                      width={176}
                    />
                    <p>{t("result.loading")}</p>
                  </div>
                ) : requestError ? (
                  <div role="alert">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-red)]">
                      {t("result.failed")}
                    </p>
                    <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">{requestError}</p>
                    <p className="mt-3 rounded-lg bg-[var(--color-error-soft)] p-3 text-xs font-semibold leading-6 text-[var(--color-red)]">
                      {t(requestErrorHelp)}
                    </p>
                  </div>
                ) : (
                  <>
                    {retrieval?.status === "empty" ? (
                      <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm font-semibold leading-7 text-[var(--color-muted)]">
                        {t("result.empty")}
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

                    {retrieval?.records.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-1.5">
                        {resultSourceFilters.map((filter) => (
                          <button
                            aria-pressed={resultSourceFilter === filter.id}
                            className="min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-green)] aria-pressed:bg-[var(--color-green)] aria-pressed:text-white"
                            key={filter.id}
                            onClick={() => {
                              setResultSourceFilter(filter.id);
                              setSourcePage(1);
                            }}
                            type="button"
                          >
                            {t(filter.labelKey)}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {sourceRecords.length === 0 && retrieval?.records.length ? (
                      <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3 text-sm font-semibold leading-7 text-[var(--color-muted)]">
                        {t("result.filterEmpty")}
                      </p>
                    ) : (
                      <div className="mt-4 grid gap-2">
                        {visibleSourceRecords.map((record) => (
                          (() => {
                            const sourceText = sourceTextForLanguage(record, language, {
                              arabic: t("result.arabicUnavailable"),
                              english: t("result.englishUnavailable"),
                            });
                            const metadata = recordMetadata(record, language, t);
                            const gradeMetadata = recordGradeMetadata(record, t);
                            const detailBadge = recordDetailBadge(record, language, t);

                            return (
                              <article
                                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_8px_24px_rgba(22,58,95,0.04)]"
                                key={record.id}
                              >
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
                                <p className={`mt-3 whitespace-pre-wrap ${sourceText.textClass}`} dir={sourceText.dir}>
                                  {sourceText.text}
                                </p>
                              </article>
                            );
                          })()
                        ))}
                      </div>
                    )}

                    {sourceRecords.length > sourcePageSize ? (
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 p-3">
                        <button
                          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-green)] disabled:opacity-40"
                          disabled={currentSourcePage === 1}
                          onClick={() => setSourcePage((page) => Math.max(1, page - 1))}
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
                          onClick={() => setSourcePage((page) => Math.min(totalSourcePages, page + 1))}
                          type="button"
                        >
                          {t("result.nextPage")}
                        </button>
                      </div>
                    ) : null}

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
                )}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
