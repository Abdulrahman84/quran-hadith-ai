import type { ReactNode, RefObject } from "react";

import { AnswerDraftPreview } from "@/components/answer-draft-preview";
import { SearchLoading } from "@/components/search-loading";
import type { Language, TranslationKey } from "@/lib/i18n";
import type { SearchProgressDetail, SearchProgressPhase } from "@/lib/search-stream";

import { formatProgressDetail } from "./search-display";
import type { SearchSelection } from "./use-search-stream";

type AnswerPanelProps = {
  panelRef: RefObject<HTMLDivElement | null>;
  isRetrieving: boolean;
  submittedQuestion: string;
  answerDraft: string;
  searchProgress: number;
  searchProgressPhase: SearchProgressPhase;
  searchProgressDetail: SearchProgressDetail;
  searchSelection: SearchSelection;
  requestError: string;
  requestErrorHelp: TranslationKey;
  language: Language;
  t: (key: TranslationKey) => string;
  /** The settled result, shown once retrieval finished without a request error. */
  children: ReactNode;
};

export function AnswerPanel({
  panelRef,
  isRetrieving,
  submittedQuestion,
  answerDraft,
  searchProgress,
  searchProgressPhase,
  searchProgressDetail,
  searchSelection,
  requestError,
  requestErrorHelp,
  language,
  t,
  children,
}: AnswerPanelProps) {
  const progressDetail = formatProgressDetail(searchProgressPhase, searchProgressDetail, searchSelection, language, t);

  return (
    <div
      className={`answer-preview scroll-mt-24 flex flex-col rounded-2xl p-4 sm:p-5 ${
        isRetrieving ? "min-h-[clamp(18rem,48svh,36rem)]" : ""
      }`}
      ref={panelRef}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-ink)]">
            {isRetrieving ? t("result.tracing") : t("result.recordsTitle")}
          </h2>
          <p className="mt-1 line-clamp-2 max-w-xl whitespace-pre-wrap text-sm font-medium leading-6 text-[var(--color-muted)]">
            {submittedQuestion}
          </p>
        </div>
        <span className="pulse-dot" aria-hidden="true" />
      </div>

      <div
        className={`mt-4 text-[var(--color-ink)] ${
          isRetrieving && !answerDraft ? "flex flex-1 items-center justify-center" : ""
        }`}
      >
        {isRetrieving && answerDraft ? (
          <div className="grid w-full gap-4">
            <SearchLoading compact detail={progressDetail} phase={searchProgressPhase} progress={searchProgress} />
            <AnswerDraftPreview
              checkingLabel={t("result.draftChecking")}
              dir={language === "ar" ? "rtl" : "ltr"}
              text={answerDraft}
              title={t("result.answerTitle")}
            />
          </div>
        ) : isRetrieving ? (
          <SearchLoading detail={progressDetail} phase={searchProgressPhase} progress={searchProgress} />
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
          children
        )}
      </div>
    </div>
  );
}
