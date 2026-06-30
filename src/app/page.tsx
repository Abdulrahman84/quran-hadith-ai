"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";
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
      text: record.arabicText || fallbackText.arabic,
      textClass: "text-right text-base font-black leading-8 text-[var(--color-green)]",
    };
  }

  return {
    dir: "ltr" as const,
    text: record.englishText || fallbackText.english,
    textClass: "text-left text-sm font-bold leading-6 text-[var(--color-ink)]",
  };
}

export default function Home() {
  const { language, t } = useI18n();
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [isRetrieving, setIsRetrieving] = useState(false);
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [requestError, setRequestError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasScenario = isRetrieving || Boolean(submittedQuestion) || retrieval !== null || requestError.length > 0;

  const activeRoutes = useMemo(() => {
    return {
      Quran: false,
      Tafsir: false,
      Hadith: hasScenario,
    };
  }, [hasScenario]);

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  async function runSearch(nextQuestion: string) {
    const trimmed = nextQuestion.trim();

    if (!trimmed) {
      return;
    }

    setQuestion(trimmed);
    setSubmittedQuestion(trimmed);
    setRetrieval(null);
    setRequestError("");
    setIsRetrieving(true);

    try {
      const [response] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: language === "ar" ? "arabic" : "english", question: trimmed }),
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
      setRequestError(error instanceof Error ? error.message : "The local retrieval request failed.");
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

  return (
    <main className="relative min-h-screen bg-[var(--color-sand)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--color-green)]/10 bg-[var(--color-sand)]/88 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link className="group flex items-center" href="/" aria-label="Sanad AI">
            <Image
              alt="Sanad AI"
              className="h-10 w-auto shrink-0 object-contain transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-14"
              height={56}
              priority
              src="/brand/sanad-logo.png"
              width={201}
            />
          </Link>

          <nav className="flex items-center gap-2 text-sm font-black">
            <Link className="nav-link" href="/how-it-works">
              {t("nav.howItWorks")}
            </Link>
            <Link className="nav-link nav-link-mobile-hidden" href="/source-policy">
              {t("nav.policy")}
            </Link>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

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
                      {retrieval?.records.map((record) => (
                        (() => {
                          const sourceText = sourceTextForLanguage(record, language, {
                            arabic: t("result.arabicUnavailable"),
                            english: t("result.englishUnavailable"),
                          });

                          return (
                            <article
                              className="rounded-2xl border border-[var(--color-green)]/14 bg-white/72 p-3"
                              key={record.id}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <strong className="text-sm text-[var(--color-green)]">
                                  {record.displayName} {record.hadithNumber}
                                </strong>
                                <span className="rounded-full border border-[var(--color-gold)]/60 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--color-red)]">
                                  {record.grade ? record.grade.value : t("result.gradeUnavailable")}
                                </span>
                              </div>
                              {record.book || record.chapter ? (
                                <p
                                  className={`mt-2 text-xs font-black text-[var(--color-muted)] ${
                                    language === "ar" ? "" : "uppercase tracking-[0.12em]"
                                  }`}
                                >
                                  {language === "ar"
                                    ? [
                                        record.book ? `${t("result.bookLabel")}: ${record.book}` : null,
                                        record.chapter ? `${t("result.chapterLabel")}: ${record.chapter}` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" / ")
                                    : [record.book, record.chapter].filter(Boolean).join(" / ")}
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
