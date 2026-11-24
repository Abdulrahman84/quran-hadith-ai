"use client";

import { type FormEvent, type KeyboardEvent, type RefObject, useEffect, useRef } from "react";

import type { Language, TranslationKey } from "@/lib/i18n";
import { hadithCollections, type HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import { tafsirSources, type TafsirSourceSelection } from "@/lib/retrieval/tafsir-sources";

const maxQuestionFieldHeight = 120;

function resizeQuestionField(element: HTMLTextAreaElement) {
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxQuestionFieldHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxQuestionFieldHeight ? "auto" : "hidden";
}

/** Resizes the question field whenever the question changes, including programmatic changes. */
export function useQuestionFieldAutoResize(question: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  return textareaRef;
}

type SearchFormProps = {
  hasScenario: boolean;
  isRetrieving: boolean;
  submittedQuestion: string;
  question: string;
  onQuestionChange: (question: string) => void;
  onQuestionKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEditQuestion: () => void;
  hadithCollection: HadithCollectionSelection;
  onHadithCollectionChange: (collection: HadithCollectionSelection) => void;
  tafsirSource: TafsirSourceSelection;
  onTafsirSourceChange: (source: TafsirSourceSelection) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  loadingSummaryRef: RefObject<HTMLDivElement | null>;
  language: Language;
  t: (key: TranslationKey) => string;
};

export function SearchForm({
  hasScenario,
  isRetrieving,
  submittedQuestion,
  question,
  onQuestionChange,
  onQuestionKeyDown,
  onSubmit,
  onEditQuestion,
  hadithCollection,
  onHadithCollectionChange,
  tafsirSource,
  onTafsirSourceChange,
  textareaRef,
  loadingSummaryRef,
  language,
  t,
}: SearchFormProps) {
  const loadingFilterLabels = [
    hadithCollection === "all"
      ? null
      : hadithCollections.find((collection) => collection.id === hadithCollection)?.[language === "ar" ? "labelAr" : "labelEn"],
    tafsirSource === "all"
      ? null
      : tafsirSources.find((source) => source.id === tafsirSource)?.[language === "ar" ? "labelAr" : "labelEn"],
  ].filter((label): label is string => Boolean(label));

  return (
    <form
      className={`search-shell animate-rise w-full overflow-hidden text-start transition-all duration-300 ${
        hasScenario ? "" : "mt-5 sm:mt-6 [animation-delay:160ms]"
      }`}
      onSubmit={onSubmit}
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
            onClick={onEditQuestion}
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
                onQuestionChange(event.target.value);
              }}
              onInput={(event) => resizeQuestionField(event.currentTarget)}
              onKeyDown={onQuestionKeyDown}
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
                  onChange={(event) => onHadithCollectionChange(event.target.value as HadithCollectionSelection)}
                  value={hadithCollection}
                >
                  <option value="all">{t("home.hadithCollectionAll")}</option>
                  {hadithCollections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {language === "ar" ? collection.labelAr : collection.labelEn}
                    </option>
                  ))}
                </select>
                <SelectChevron />
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
                  onChange={(event) => onTafsirSourceChange(event.target.value as TafsirSourceSelection)}
                  value={tafsirSource}
                >
                  <option value="all">{t("home.tafsirSourceAll")}</option>
                  {tafsirSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {language === "ar" ? source.labelAr : source.labelEn}
                    </option>
                  ))}
                </select>
                <SelectChevron />
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
  );
}

function SelectChevron() {
  return (
    <svg className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gold)]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}
