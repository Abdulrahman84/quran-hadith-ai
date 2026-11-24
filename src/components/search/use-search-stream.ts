"use client";

import { useRef, useState } from "react";

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
  type SearchProgressPhase,
} from "@/lib/search-stream";

import { getWarningKey } from "./search-display";

type UseSearchStreamOptions = {
  language: Language;
  t: (key: TranslationKey) => string;
};

/** Owns one in-flight /api/search request: progress, the streamed answer draft, and the final result. */
export function useSearchStream({ language, t }: UseSearchStreamOptions) {
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchProgressPhase, setSearchProgressPhase] = useState<SearchProgressPhase>("starting");
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [answerDraft, setAnswerDraft] = useState("");
  const [draftWasReplaced, setDraftWasReplaced] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [requestErrorHelp, setRequestErrorHelp] = useState<TranslationKey>("result.checkPaths");
  const requestAbortRef = useRef<AbortController | null>(null);

  async function startSearch(
    trimmed: string,
    selectedTafsirSource: TafsirSourceSelection,
    selectedHadithCollection: HadithCollectionSelection,
  ) {
    setSubmittedQuestion(trimmed);
    setRetrieval(null);
    setAnswerDraft("");
    setDraftWasReplaced(false);
    setRequestError("");
    setRequestErrorHelp("result.checkPaths");
    setSearchProgress(8);
    setSearchProgressPhase("starting");
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
    requestAbortRef.current?.abort();
    requestAbortRef.current = null;
    setIsRetrieving(false);
  }

  /** Stops the request and clears the submitted question and its results. */
  function clearSearch() {
    cancelSearch();
    setSubmittedQuestion("");
    setRetrieval(null);
    setAnswerDraft("");
    setDraftWasReplaced(false);
    setRequestError("");
  }

  return {
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
  };
}
