"use client";

import Image from "next/image";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { SiteHeader } from "@/components/site-header";
import type { TranslationKey } from "@/lib/i18n";
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
const minimumLoadingMs = 5000;
const sourcePageSize = 5;

function resizeQuestionField(element: HTMLTextAreaElement) {
  const maxHeight = 128;

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
      textClass: "text-right text-base font-black leading-8 text-[var(--color-green)]",
    };
  }

  return {
    dir: "ltr" as const,
    text:
      [record.englishText, record.sourceKind === "tafsir" ? record.tafsirText : null].filter(Boolean).join("\n\n") ||
      fallbackText.english,
    textClass: "text-left text-sm font-bold leading-6 text-[var(--color-ink)]",
  };
}

function recordBadge(record: RetrievalResponse["records"][number], language: "ar" | "en", t: (key: TranslationKey) => string) {
  if (record.sourceKind === "hadith") {
    return record.grade ? formatHadithGrade(record.grade.value, language) : t("result.gradeUnavailable");
  }

  if (record.sourceKind === "tafsir") {
    return record.tafsirSource || t("result.tafsirUnavailable");
  }

  return t("routes.quran");
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
  const sourceRecords = retrieval?.records ?? [];
  const totalSourcePages = Math.max(1, Math.ceil(sourceRecords.length / sourcePageSize));
  const currentSourcePage = Math.min(sourcePage, totalSourcePages);
  const visibleSourceRecords = sourceRecords.slice((currentSourcePage - 1) * sourcePageSize, currentSourcePage * sourcePageSize);

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  async function runSearch(nextQuestion: string, selectedTafsirSource = tafsirSource) {
    const trimmed = nextQuestion.trim();

    if (!trimmed) {
      return;
    }

    setQuestion(trimmed);
    setSubmittedQuestion(trimmed);
    setRetrieval(null);
    setRequestError("");
    setSourcePage(1);
    setIsRetrieving(true);

    try {
      const [response] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: language === "ar" ? "arabic" : "english", question: trimmed, tafsirSource: selectedTafsirSource }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, minimumLoadingMs)),
      ]);
      const payload = (await response.json()) as RetrievalResponse;

      if (!response.ok) {
        const warning = payload.warnings.at(0);
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
      void runSearch(submittedQuestion, nextSource);
    }
  }

  return (
    <main className="relative min-h-screen bg-[var(--color-sand)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />

      <SiteHeader />

      <section
        className={`relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-5 text-center sm:px-8 ${
          hasScenario ? "py-4" : "min-h-[calc(100vh-80px)] justify-center py-12"
        }`}
      >
        {!hasScenario ? (
          <>
            <p className="animate-rise text-xs font-black uppercase tracking-[0.28em] text-[var(--color-red)]">
              {t("home.eyebrow")}
            </p>
            <h1 className="animate-rise mt-5 text-balance text-4xl font-black leading-tight text-[var(--color-green)] [animation-delay:80ms] sm:text-6xl">
              {t("home.title")}
            </h1>
          </>
        ) : null}

        <form
          className={`search-shell animate-rise w-full max-w-3xl rounded-[2rem] bg-white/86 p-2 text-start backdrop-blur ${
            hasScenario ? "" : "mt-8 [animation-delay:160ms]"
          }`}
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="question">
            {t("home.inputLabel")}
          </label>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <textarea
              className="query-textarea min-h-14 flex-1 resize-none rounded-[1.5rem] bg-transparent px-5 py-4 text-base font-bold leading-6 outline-none placeholder:text-[var(--color-muted)]"
              id="question"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleQuestionKeyDown}
              placeholder={t("home.placeholder")}
              ref={textareaRef}
              rows={1}
              value={question}
            />
            <label className="sr-only" htmlFor="tafsir-source">
              {t("home.tafsirSourceLabel")}
            </label>
            <select
              className="min-h-14 rounded-[1.5rem] border border-[var(--color-green)]/18 bg-white px-4 text-sm font-black text-[var(--color-green)] outline-none"
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
            <button
              className="min-h-14 rounded-[1.5rem] border border-[var(--color-green)] bg-[var(--color-green)] px-6 text-sm font-black uppercase tracking-[0.16em] text-[var(--color-sand)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--color-ink)] disabled:cursor-wait disabled:opacity-75"
              disabled={isRetrieving}
              type="submit"
            >
              {isRetrieving ? t("home.scan") : t("home.search")}
            </button>
          </div>
        </form>

        {!hasScenario ? (
          <>
            <div className="animate-rise mt-5 flex max-w-3xl flex-wrap justify-center gap-2 [animation-delay:220ms]">
              {suggestionKeys.map((suggestionKey) => (
                <button
                  className="chip"
                  key={suggestionKey}
                  onClick={() => void runSearch(t(suggestionKey))}
                  type="button"
                >
                  {t(suggestionKey)}
                </button>
              ))}
            </div>

            <div className="animate-rise mt-8 w-full max-w-3xl rounded-[2rem] border border-[var(--color-green)]/12 bg-white/54 p-5 [animation-delay:300ms]">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--color-green)]">
                {t("home.startTitle")}
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-[var(--color-muted)]">
                {t("home.startText")}
              </p>
            </div>
          </>
        ) : null}

        {hasScenario ? (
          <section className="mt-3 grid w-full max-w-3xl text-start">
            <div className="answer-preview rounded-[2rem] bg-[var(--color-green)] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-gold)]">
                    {isRetrieving ? t("result.retrieving") : t("result.retrieved")}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    {isRetrieving ? t("result.tracing") : t("result.recordsTitle")}
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-xl whitespace-pre-wrap text-sm font-bold leading-6 text-white/70">
                    {submittedQuestion}
                  </p>
                </div>
                <span className="pulse-dot" aria-hidden="true" />
              </div>

              <div className="mt-4 rounded-3xl border border-white/12 bg-white/8 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-gold)]">
                    {t("result.routes")}
                  </p>
                  <p className="text-xs font-bold text-white/70">{t("result.mode")}</p>
                </div>
                <div className="evidence-map">
                  {sourceRoutes.map((route) => (
                    <span className={activeRoutes[route.id] ? "is-active" : ""} key={route.id}>
                      {t(route.labelKey)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-[var(--color-gold)]/55 bg-[var(--color-sand)] p-4 text-[var(--color-ink)]">
                {isRetrieving ? (
                  <div className="source-loading" role="status" aria-live="polite">
                    <Image
                      alt=""
                      aria-hidden="true"
                      className="source-loading-mark"
                      height={153}
                      src="/assets/sanad-ai-loader.svg"
                      unoptimized
                      width={272}
                    />
                    <p>{t("result.loading")}</p>
                  </div>
                ) : requestError ? (
                  <div role="alert">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                      {t("result.failed")}
                    </p>
                    <p className="mt-3 text-sm font-bold leading-7 text-[var(--color-muted)]">{requestError}</p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--color-green)]">
                      {t("result.checkPaths")}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                      {retrieval?.status === "empty" ? t("result.empty") : t("result.returned")}
                    </p>
                    {retrieval?.answer?.status === "ready" && retrieval.answer.text ? (
                      <div className="mt-4 rounded-2xl border border-[var(--color-green)]/14 bg-white/72 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                          {t("result.answerTitle")}
                        </p>
                        <p
                          className="mt-3 whitespace-pre-wrap text-sm font-black leading-8 text-[var(--color-green)]"
                          dir={language === "ar" ? "rtl" : "ltr"}
                        >
                          {retrieval.answer.text}
                        </p>
                        {retrieval.answer.citations.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {retrieval.answer.citations.map((citation) => (
                              <span
                                className="rounded-full border border-[var(--color-gold)]/60 px-3 py-1 text-[0.68rem] font-black text-[var(--color-muted)]"
                                key={citation}
                              >
                                {citation}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm font-bold leading-7">{t(getAnswerStatusKey(retrieval?.answer))}</p>
                    )}

                    <div className="mt-4 grid gap-2">
                      {visibleSourceRecords.map((record) => (
                        (() => {
                          const sourceText = sourceTextForLanguage(record, language, {
                            arabic: t("result.arabicUnavailable"),
                            english: t("result.englishUnavailable"),
                          });
                          const metadata = recordMetadata(record, language, t);

                          return (
                            <article
                              className="rounded-2xl border border-[var(--color-green)]/14 bg-white/72 p-3"
                              key={record.id}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <strong className="text-sm text-[var(--color-green)]">
                                  {formatSourceRecordTitle(record, language)}
                                </strong>
                                <span className="rounded-full border border-[var(--color-gold)]/60 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--color-red)]">
                                  {recordBadge(record, language, t)}
                                </span>
                              </div>
                              {metadata ? (
                                <p
                                  className={`mt-2 text-xs font-black text-[var(--color-muted)] ${
                                    language === "ar" ? "" : "uppercase tracking-[0.12em]"
                                  }`}
                                >
                                  {metadata}
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

                    {sourceRecords.length > sourcePageSize ? (
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-green)]/14 bg-white/60 p-3">
                        <button
                          className="rounded-full border border-[var(--color-gold)]/60 px-4 py-2 text-xs font-black text-[var(--color-green)] disabled:opacity-40"
                          disabled={currentSourcePage === 1}
                          onClick={() => setSourcePage((page) => Math.max(1, page - 1))}
                          type="button"
                        >
                          {t("result.previousPage")}
                        </button>
                        <span className="text-xs font-black text-[var(--color-muted)]">
                          {t("result.pageLabel")} {currentSourcePage} / {totalSourcePages}
                        </span>
                        <button
                          className="rounded-full border border-[var(--color-gold)]/60 px-4 py-2 text-xs font-black text-[var(--color-green)] disabled:opacity-40"
                          disabled={currentSourcePage === totalSourcePages}
                          onClick={() => setSourcePage((page) => Math.min(totalSourcePages, page + 1))}
                          type="button"
                        >
                          {t("result.nextPage")}
                        </button>
                      </div>
                    ) : null}

                    {retrieval?.warnings.length ? (
                      <div className="mt-4 rounded-2xl border border-[var(--color-red)]/18 bg-white/60 p-3">
                        {retrieval.warnings.map((warning) => (
                          <p className="text-sm font-bold leading-6 text-[var(--color-muted)]" key={warning.code}>
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
