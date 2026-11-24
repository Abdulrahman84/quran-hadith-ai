"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { CheckPanel } from "@/components/check/check-panel";
import { useI18n } from "@/components/i18n-provider";
import { AnswerDraftPreview } from "@/components/answer-draft-preview";
import { SearchLoading } from "@/components/search-loading";
import { getAnswerStatusKey, getWarningKey, warningToneClass } from "@/components/search/search-display";
import { SourceResults, type ResultSourceFilter } from "@/components/search/source-results";
import { WorkflowSwitch, type HomeWorkflow } from "@/components/workflow-switch";
import type { TranslationKey } from "@/lib/i18n";
import { hadithCollections, type HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import { tafsirSources, type TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";
import type { RetrievalResponse } from "@/lib/retrieval/types";
import {
  answerDraftStreamFeature,
  readSearchResponse,
  searchStreamFeaturesHeader,
  searchStreamMediaType,
  type SearchProgressPhase,
} from "@/lib/search-stream";

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
function resizeQuestionField(element: HTMLTextAreaElement) {
  const maxHeight = 120;

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

export default function Home() {
  const { language, t } = useI18n();
  const [workflow, setWorkflow] = useState<HomeWorkflow>("general");
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchProgressPhase, setSearchProgressPhase] = useState<SearchProgressPhase>("starting");
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [draftWasReplaced, setDraftWasReplaced] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestErrorHelp, setRequestErrorHelp] = useState<TranslationKey>("result.checkPaths");
  const [hadithCollection, setHadithCollection] = useState<HadithCollectionSelection>("all");
  const [resultSourceFilter, setResultSourceFilter] = useState<ResultSourceFilter>("all");
  const [tafsirSource, setTafsirSource] = useState<TafsirSourceSelection>("all");
  const [sourcePage, setSourcePage] = useState(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingPanelRef = useRef<HTMLDivElement>(null);
  const loadingSummaryRef = useRef<HTMLDivElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const hasScenario = workflow === "general" && (isRetrieving || Boolean(submittedQuestion) || retrieval !== null || requestError.length > 0);

  const activeRoutes = useMemo(() => {
    const kinds = new Set(retrieval?.records.map((record) => record.sourceKind) ?? []);

    return {
      Quran: kinds.has("quran") || kinds.has("tafsir"),
      Tafsir: kinds.has("tafsir"),
      Hadith: kinds.has("hadith"),
    };
  }, [retrieval]);
  const loadingFilterLabels = [
    hadithCollection === "all"
      ? null
      : hadithCollections.find((collection) => collection.id === hadithCollection)?.[language === "ar" ? "labelAr" : "labelEn"],
    tafsirSource === "all"
      ? null
      : tafsirSources.find((source) => source.id === tafsirSource)?.[language === "ar" ? "labelAr" : "labelEn"],
  ].filter((label): label is string => Boolean(label));
  const progressPhaseLabels: Record<SearchProgressPhase, TranslationKey> = {
    starting: "result.progressStarting",
    routing: "result.progressRouting",
    retrieving: "result.progressRetrieving",
    answering: "result.progressAnswering",
    finalizing: "result.progressFinalizing",
  };

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  useEffect(() => {
    if (!isRetrieving) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      loadingSummaryRef.current?.focus({ preventScroll: true });
      loadingPanelRef.current?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRetrieving]);

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
    setAnswerDraft("");
    setDraftWasReplaced(false);
    setRequestError("");
    setRequestErrorHelp("result.checkPaths");
    setSourcePage(1);
    setSearchProgress(8);
    setSearchProgressPhase("starting");
    setIsRetrieving(true);
    requestAbortRef.current?.abort();
    const requestController = new AbortController();
    requestAbortRef.current = requestController;

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          Accept: searchStreamMediaType,
          "Content-Type": "application/json",
          [searchStreamFeaturesHeader]: answerDraftStreamFeature,
        },
        body: JSON.stringify({
          language: language === "ar" ? "arabic" : "english",
          question: trimmed,
          hadithCollection: selectedHadithCollection,
          tafsirSource: selectedTafsirSource,
        }),
        signal: requestController.signal,
      });

      if (requestController.signal.aborted) {
        return;
      }

      const isCurrentRequest = () => !requestController.signal.aborted && requestAbortRef.current === requestController;
      let draftWasShown = false;
      const result = await readSearchResponse(
        response,
        (event) => {
          if (!isCurrentRequest()) {
            return;
          }

          setSearchProgress((current) => Math.max(current, event.progress));
          setSearchProgressPhase(event.phase);
        },
        (event) => {
          if (!isCurrentRequest()) {
            return;
          }

          if (event.type === "answer_reset") {
            setAnswerDraft("");
            return;
          }

          draftWasShown = true;
          setAnswerDraft((current) => current + event.text);
        },
      );
      const payload = result.payload;
      setAnswerDraft("");
      setDraftWasReplaced(
        draftWasShown && Boolean(payload.answer?.warnings.some((warning) => warning.code === "answer_replaced_after_check")),
      );

      if (!result.ok) {
        const warning = payload.warnings.at(0);
        setRequestErrorHelp(warning?.code === "source_tool_router_unavailable" ? "result.checkAiRouter" : "result.checkPaths");
        throw new Error(warning ? t(getWarningKey(warning)) : t("warning.generic"));
      }

      setSearchProgress(100);
      setRetrieval(payload);
    } catch (error) {
      if (requestController.signal.aborted) {
        return;
      }

      setRequestError(error instanceof Error ? error.message : "The source retrieval request failed.");
    } finally {
      if (requestAbortRef.current === requestController) {
        requestAbortRef.current = null;
        setIsRetrieving(false);
      }
    }
  }

  function handleEditQuestion() {
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsRetrieving(false);
    setSubmittedQuestion("");
    setRetrieval(null);
    setAnswerDraft("");
    setDraftWasReplaced(false);
    setRequestError("");
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

  function handleWorkflowChange(nextWorkflow: HomeWorkflow) {
    if (nextWorkflow === workflow) {
      return;
    }

    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsRetrieving(false);
    setWorkflow(nextWorkflow);
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

        <WorkflowSwitch onChange={handleWorkflowChange} t={t} value={workflow} />

        {workflow === "general" ? (
          <>

        <form
          className={`search-shell animate-rise w-full overflow-hidden text-start transition-all duration-300 ${
            hasScenario ? "" : "mt-5 sm:mt-6 [animation-delay:160ms]"
          }`}
          onSubmit={handleSubmit}
        >
          {isRetrieving ? (
            <div className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 sm:px-5">
              <div
                aria-atomic="true"
                aria-live="polite"
                className="min-w-0 flex-1 outline-none focus:outline-none focus-visible:outline-none"
                ref={loadingSummaryRef}
                role="status"
                tabIndex={-1}
              >
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">
                  {t("result.tracing")}
                </p>
                <p
                  className="mt-1 line-clamp-1 whitespace-pre-wrap text-sm font-semibold text-[var(--color-ink)]"
                  dir={language === "ar" ? "rtl" : "ltr"}
                >
                  {submittedQuestion}
                </p>
                {loadingFilterLabels.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {loadingFilterLabels.map((label) => (
                      <span className="source-detail-badge" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="pulse-dot shrink-0" aria-hidden="true" />
              <button
                className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-green)] transition hover:border-[var(--color-green)]/35"
                onClick={handleEditQuestion}
                type="button"
              >
                {t("home.editQuestion")}
              </button>
            </div>
          ) : (
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

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-5 sm:gap-5 lg:grid-cols-[1fr_1fr_auto]">
              <div className="grid min-w-0 gap-2 text-start">
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

              <div className="grid min-w-0 gap-2 text-start">
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

              <div className="col-span-2 flex items-end lg:col-span-1">
                <button
                  className="action-button inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[10px] bg-[var(--color-green)] px-8 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-75 lg:w-auto"
                  disabled={isRetrieving || !question.trim()}
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
          )}

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
            {!isRetrieving ? (
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
            ) : null}

            <div
              className={`answer-preview scroll-mt-24 flex flex-col rounded-2xl bg-[var(--color-green)] p-4 ${
                isRetrieving ? "min-h-[clamp(18rem,48svh,36rem)]" : ""
              }`}
              ref={loadingPanelRef}
            >
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

              <div
                className={`mt-4 rounded-xl border border-[var(--color-gold)]/55 bg-[var(--color-sand)] p-4 text-[var(--color-ink)] ${
                  isRetrieving && !answerDraft ? "flex flex-1 items-center justify-center" : ""
                }`}
              >
                {isRetrieving && answerDraft ? (
                  <AnswerDraftPreview
                    checkingLabel={t("result.draftChecking")}
                    dir={language === "ar" ? "rtl" : "ltr"}
                    text={answerDraft}
                    title={t("result.answerTitle")}
                  />
                ) : isRetrieving ? (
                  <SearchLoading
                    label={t("result.loading")}
                    phaseLabel={t(progressPhaseLabels[searchProgressPhase])}
                    progress={searchProgress}
                  />
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
                      filter={resultSourceFilter}
                      language={language}
                      onFilterChange={setResultSourceFilter}
                      onPageChange={setSourcePage}
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
                )}
              </div>
            </div>
          </section>
        ) : null}
          </>
        ) : (
          <CheckPanel />
        )}
      </section>
    </main>
  );
}
