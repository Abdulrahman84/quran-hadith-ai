"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { CheckPanel } from "@/components/check/check-panel";
import { useI18n } from "@/components/i18n-provider";
import { AnswerPanel } from "@/components/search/answer-panel";
import { HomeHero } from "@/components/search/home-hero";
import { SearchForm, useQuestionFieldAutoResize } from "@/components/search/search-form";
import { SearchResult } from "@/components/search/search-result";
import { SearchStart } from "@/components/search/search-start";
import { SourceTrail } from "@/components/search/source-trail";
import type { ResultSourceFilter } from "@/components/search/source-results";
import { useSearchStream } from "@/components/search/use-search-stream";
import { WorkflowSwitch, type HomeWorkflow } from "@/components/workflow-switch";
import type { HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import type { TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";

export default function Home() {
  const { language, t } = useI18n();
  const [workflow, setWorkflow] = useState<HomeWorkflow>("general");
  const [question, setQuestion] = useState("");
  const [hadithCollection, setHadithCollection] = useState<HadithCollectionSelection>("all");
  const [resultSourceFilter, setResultSourceFilter] = useState<ResultSourceFilter>("all");
  const [tafsirSource, setTafsirSource] = useState<TafsirSourceSelection>("all");
  const [sourcePage, setSourcePage] = useState(1);
  const textareaRef = useQuestionFieldAutoResize(question);
  const loadingPanelRef = useRef<HTMLDivElement>(null);
  const loadingSummaryRef = useRef<HTMLDivElement>(null);
  const {
    submittedQuestion,
    isRetrieving,
    searchProgress,
    searchProgressPhase,
    retrieval,
    answerDraft,
    draftWasReplaced,
    requestError,
    requestErrorHelp,
    startSearch,
    cancelSearch,
    clearSearch,
  } = useSearchStream({ language, t });

  const hasScenario = workflow === "general" && (isRetrieving || Boolean(submittedQuestion) || retrieval !== null || requestError.length > 0);

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
    setSourcePage(1);
    await startSearch(trimmed, selectedTafsirSource, selectedHadithCollection);
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

    cancelSearch();
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
        {!hasScenario ? <HomeHero t={t} /> : null}

        <WorkflowSwitch onChange={handleWorkflowChange} t={t} value={workflow} />

        {workflow === "general" ? (
          <>
            <SearchForm
              hadithCollection={hadithCollection}
              hasScenario={hasScenario}
              isRetrieving={isRetrieving}
              language={language}
              loadingSummaryRef={loadingSummaryRef}
              onEditQuestion={clearSearch}
              onHadithCollectionChange={handleHadithCollectionChange}
              onQuestionChange={setQuestion}
              onQuestionKeyDown={handleQuestionKeyDown}
              onSubmit={handleSubmit}
              onTafsirSourceChange={handleTafsirSourceChange}
              question={question}
              submittedQuestion={submittedQuestion}
              t={t}
              tafsirSource={tafsirSource}
              textareaRef={textareaRef}
            />

            {!hasScenario ? <SearchStart onSuggestion={(suggestion) => void runSearch(suggestion)} t={t} /> : null}

            {hasScenario ? (
              <section className="mt-3 grid w-full gap-3 text-start">
                {!isRetrieving ? <SourceTrail records={retrieval?.records} t={t} /> : null}

                <AnswerPanel
                  answerDraft={answerDraft}
                  isRetrieving={isRetrieving}
                  language={language}
                  panelRef={loadingPanelRef}
                  requestError={requestError}
                  requestErrorHelp={requestErrorHelp}
                  searchProgress={searchProgress}
                  searchProgressPhase={searchProgressPhase}
                  submittedQuestion={submittedQuestion}
                  t={t}
                >
                  <SearchResult
                    draftWasReplaced={draftWasReplaced}
                    language={language}
                    onSourceFilterChange={setResultSourceFilter}
                    onSourcePageChange={setSourcePage}
                    retrieval={retrieval}
                    sourceFilter={resultSourceFilter}
                    sourcePage={sourcePage}
                    t={t}
                  />
                </AnswerPanel>
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
