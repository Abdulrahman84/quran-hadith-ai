"use client";

import { useEffect, useRef, useState } from "react";

import { ApiUnreachableError, fetchApi } from "@/lib/api-url";
import type { Language, TranslationKey } from "@/lib/i18n";
import type { HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import type { TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";
import type { RetrievalResponse } from "@/lib/retrieval/types";
import {
  answerDraftStreamFeature,
  readSearchResponse,
  searchStreamFeaturesHeader,
  searchStreamMediaType,
  type SearchProgressDetail,
  type SearchProgressPhase,
  type SearchSourceRoute,
} from "@/lib/search-stream";

import { DRAFT_REVEAL_MAX_WAIT_MS, DRAFT_REVEAL_TICK_MS, nextRevealLength } from "./draft-reveal";
import { getWarningKey } from "./search-display";

type UseSearchStreamOptions = {
  language: Language;
  t: (key: TranslationKey) => string;
};

export type SearchSelection = {
  hadithCollection: HadithCollectionSelection;
  tafsirSource: TafsirSourceSelection;
};

const sourceRoutes = new Set<SearchSourceRoute>(["tafsir", "hadith"]);

function countOrUndefined(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

// Keeps only well-formed details from a progress event; anything else is dropped, never guessed.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function progressDetailFrom(event: SearchProgressDetail): SearchProgressDetail {
  const detail: SearchProgressDetail = {};
  const completed = countOrUndefined(event.completed);
  const total = countOrUndefined(event.total);
  const records = countOrUndefined(event.records);

  if (completed !== undefined && total !== undefined && completed <= total) {
    detail.completed = completed;
    detail.total = total;
  }

  if (Array.isArray(event.sources)) {
    detail.sources = event.sources.filter((source): source is SearchSourceRoute => sourceRoutes.has(source));
  }

  if (records !== undefined) {
    detail.records = records;
  }

  return detail;
}

/** Owns one in-flight /api/search request: progress, the streamed answer draft, and the final result. */
export function useSearchStream({ language, t }: UseSearchStreamOptions) {
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchProgressPhase, setSearchProgressPhase] = useState<SearchProgressPhase>("starting");
  const [searchProgressDetail, setSearchProgressDetail] = useState<SearchProgressDetail>({});
  const [searchSelection, setSearchSelection] = useState<SearchSelection>({ hadithCollection: "all", tafsirSource: "all" });
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [draftWasReplaced, setDraftWasReplaced] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestErrorHelp, setRequestErrorHelp] = useState<TranslationKey>("result.checkPaths");
  const requestAbortRef = useRef<AbortController | null>(null);
  // The streamed draft as received, and how much of it is on screen. See draft-reveal.ts.
  const draftTargetRef = useRef("");
  const draftShownRef = useRef(0);
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftRevealedListenersRef = useRef<Array<() => void>>([]);

  function notifyDraftRevealed() {
    const listeners = draftRevealedListenersRef.current;
    draftRevealedListenersRef.current = [];
    listeners.forEach((listener) => listener());
  }

  function stopDraftReveal() {
    if (draftTimerRef.current !== null) {
      clearInterval(draftTimerRef.current);
      draftTimerRef.current = null;
    }
  }

  function resetDraft() {
    stopDraftReveal();
    draftTargetRef.current = "";
    draftShownRef.current = 0;
    setAnswerDraft("");
    notifyDraftRevealed();
  }

  function revealDraftStep() {
    const target = draftTargetRef.current;
    const length = prefersReducedMotion() ? target.length : nextRevealLength(target, draftShownRef.current);
    draftShownRef.current = length;
    setAnswerDraft(target.slice(0, length));

    if (length >= target.length) {
      stopDraftReveal();
      notifyDraftRevealed();
    }
  }

  function appendDraft(text: string) {
    draftTargetRef.current += text;

    if (draftTimerRef.current === null) {
      revealDraftStep();
      if (draftShownRef.current < draftTargetRef.current.length) {
        draftTimerRef.current = setInterval(revealDraftStep, DRAFT_REVEAL_TICK_MS);
      }
    }
  }

  /** Resolves once the whole draft is on screen, or after DRAFT_REVEAL_MAX_WAIT_MS. */
  function waitForDraftReveal() {
    if (draftShownRef.current >= draftTargetRef.current.length) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, DRAFT_REVEAL_MAX_WAIT_MS);
      draftRevealedListenersRef.current.push(() => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  useEffect(() => stopDraftReveal, []);

  async function startSearch(
    trimmed: string,
    selectedTafsirSource: TafsirSourceSelection,
    selectedHadithCollection: HadithCollectionSelection,
  ) {
    setSubmittedQuestion(trimmed);
    setRetrieval(null);
    resetDraft();
    setDraftWasReplaced(false);
    setRequestError("");
    setRequestErrorHelp("result.checkPaths");
    setSearchProgress(8);
    setSearchProgressPhase("starting");
    setSearchProgressDetail({});
    setSearchSelection({ hadithCollection: selectedHadithCollection, tafsirSource: selectedTafsirSource });
    setIsRetrieving(true);
    requestAbortRef.current?.abort();
    const requestController = new AbortController();
    requestAbortRef.current = requestController;

    try {
      const response = await fetchApi("/api/search", {
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
          setSearchProgressDetail((current) => ({ ...current, ...progressDetailFrom(event) }));
        },
        (event) => {
          if (!isCurrentRequest()) {
            return;
          }

          if (event.type === "answer_reset") {
            resetDraft();
            return;
          }

          draftWasShown = true;
          appendDraft(event.text);
        },
      );
      const payload = result.payload;
      const draftWasReplacedAfterCheck =
        draftWasShown && Boolean(payload.answer?.warnings.some((warning) => warning.code === "answer_replaced_after_check"));

      // Let the reader see the draft finish before the checked answer takes its place, unless
      // the check replaced it, in which case the draft is no longer worth finishing.
      if (draftWasShown && !draftWasReplacedAfterCheck && result.ok) {
        await waitForDraftReveal();

        if (!isCurrentRequest()) {
          return;
        }
      }

      resetDraft();
      setDraftWasReplaced(draftWasReplacedAfterCheck);

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

      if (error instanceof ApiUnreachableError) {
        setRequestError(t("error.offline"));
        setRequestErrorHelp("error.offlineHelp");
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

  /** Stops the in-flight request without clearing what is on screen. */
  function cancelSearch() {
    stopDraftReveal();
    notifyDraftRevealed();
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsRetrieving(false);
  }

  /** Stops the request and clears the submitted question and its results. */
  function clearSearch() {
    cancelSearch();
    setSubmittedQuestion("");
    setRetrieval(null);
    resetDraft();
    setDraftWasReplaced(false);
    setRequestError("");
  }

  return {
    submittedQuestion,
    isRetrieving,
    searchProgress,
    searchProgressPhase,
    searchProgressDetail,
    searchSelection,
    retrieval,
    answerDraft,
    draftWasReplaced,
    requestError,
    requestErrorHelp,
    startSearch,
    cancelSearch,
    clearSearch,
  };
}
