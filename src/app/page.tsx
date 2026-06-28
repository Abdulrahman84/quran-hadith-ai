"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type { RetrievalResponse } from "@/lib/retrieval/types";

const suggestions = [
  "Find hadith on intention with source",
  "Search hadith about mercy",
  "Show hadith evidence about prayer",
];

const sourceRoutes = ["Quran", "Tafsir", "Hadith"];
const minimumLoadingMs = 5000;

function resizeQuestionField(element: HTMLTextAreaElement) {
  const maxHeight = 128;

  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
  element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
}

export default function Home() {
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
          body: JSON.stringify({ question: trimmed }),
        }),
        new Promise((resolve) => window.setTimeout(resolve, minimumLoadingMs)),
      ]);
      const payload = (await response.json()) as RetrievalResponse;

      if (!response.ok) {
        const warning = payload.warnings.at(0);
        throw new Error(warning?.message || "The retrieval server could not answer this request.");
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
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-sand)] text-[var(--color-ink)]">
      <div className="source-grid" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-[var(--color-green)]/10 bg-[var(--color-sand)]/88 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link className="group flex items-center gap-3" href="/">
            <span className="grid size-12 place-items-center overflow-hidden rounded-2xl border border-[var(--color-gold)] bg-white transition-transform duration-300 group-hover:-translate-y-0.5">
              <Image
                alt=""
                className="size-10 object-contain"
                height={40}
                priority
                src="/brand/sanad-icon.png"
                width={40}
              />
            </span>
            <span>
              <strong className="block text-sm font-black uppercase tracking-[0.16em]">Sanad AI</strong>
              <span className="text-xs font-bold text-[var(--color-muted)]">Source-grounded chat</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2 text-sm font-black">
            <Link className="nav-link" href="/how-it-works">
              How it works
            </Link>
            <Link className="nav-link hidden sm:inline-flex" href="/source-policy">
              Policy
            </Link>
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
              Ask from retrieved sources
            </p>
            <h1 className="animate-rise mt-5 text-balance text-4xl font-black leading-tight text-[var(--color-green)] [animation-delay:80ms] sm:text-6xl">
              What do you want to verify?
            </h1>
          </>
        ) : null}

        <form
          className={`search-shell animate-rise w-full max-w-3xl rounded-[2rem] bg-white/86 p-2 text-left backdrop-blur ${
            hasScenario ? "" : "mt-8 [animation-delay:160ms]"
          }`}
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="question">
            Ask about Quran, tafsir, or hadith
          </label>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <textarea
              className="query-textarea min-h-14 flex-1 resize-none rounded-[1.5rem] bg-transparent px-5 py-4 text-base font-bold leading-6 outline-none placeholder:text-[var(--color-muted)]"
              id="question"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleQuestionKeyDown}
              placeholder="Ask about Quran, tafsir, or hadith..."
              ref={textareaRef}
              rows={1}
              value={question}
            />
            <button
              className="min-h-14 rounded-[1.5rem] border border-[var(--color-green)] bg-[var(--color-green)] px-6 text-sm font-black uppercase tracking-[0.16em] text-[var(--color-sand)] transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--color-ink)] disabled:cursor-wait disabled:opacity-75"
              disabled={isRetrieving}
              type="submit"
            >
              {isRetrieving ? "Scan" : "Search"}
            </button>
          </div>
        </form>

        {!hasScenario ? (
          <>
            <div className="animate-rise mt-5 flex max-w-3xl flex-wrap justify-center gap-2 [animation-delay:220ms]">
              {suggestions.map((suggestion) => (
                <button className="chip" key={suggestion} onClick={() => void runSearch(suggestion)} type="button">
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="animate-rise mt-8 w-full max-w-3xl rounded-[2rem] border border-[var(--color-green)]/12 bg-white/54 p-5 [animation-delay:300ms]">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--color-green)]">
                Start real local retrieval
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-[var(--color-muted)]">
                Results appear only after you search. V1 connects to your local Hadith MCP and returns cited source
                records, not model-written answers.
              </p>
            </div>
          </>
        ) : null}

        {hasScenario ? (
          <section className="mt-3 grid w-full max-w-3xl text-left">
            <div className="answer-preview rounded-[2rem] bg-[var(--color-green)] p-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-gold)]">
                    {isRetrieving ? "Retrieving" : "Hadith MCP retrieval"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    {isRetrieving ? "Tracing local sources" : "Retrieved source records"}
                  </h2>
                  <p className="mt-2 line-clamp-2 max-w-xl whitespace-pre-wrap text-sm font-bold leading-6 text-white/70">
                    {submittedQuestion}
                  </p>
                </div>
                <span className="pulse-dot" aria-hidden="true" />
              </div>

              <div className="mt-4 rounded-3xl border border-white/12 bg-white/8 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-gold)]">Result routes</p>
                  <p className="text-xs font-bold text-white/70">Hadith-only v1</p>
                </div>
                <div className="evidence-map">
                  {sourceRoutes.map((route) => (
                    <span className={activeRoutes[route as keyof typeof activeRoutes] ? "is-active" : ""} key={route}>
                      {route}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 rounded-3xl border border-[var(--color-gold)]/55 bg-[var(--color-sand)] p-4 text-[var(--color-ink)]">
                {isRetrieving ? (
                  <div className="source-loading" role="status" aria-live="polite">
                    <span />
                    <span />
                    <span />
                    <p>Opening local MCP and retrieving sources...</p>
                  </div>
                ) : requestError ? (
                  <div role="alert">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                      Retrieval failed
                    </p>
                    <p className="mt-3 text-sm font-bold leading-7 text-[var(--color-muted)]">{requestError}</p>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--color-green)]">
                      Check Hadith MCP build and database paths in .env.local.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                      {retrieval?.status === "empty" ? "No records found" : "Source records returned"}
                    </p>
                    <p className="mt-3 text-sm font-bold leading-7">
                      The app is showing retrieved Hadith MCP records only. No AI answer is generated in this mode.
                    </p>

                    <div className="mt-4 grid gap-2">
                      {retrieval?.records.map((record) => (
                        <article
                          className="rounded-2xl border border-[var(--color-green)]/14 bg-white/72 p-3"
                          key={record.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-sm text-[var(--color-green)]">
                              {record.displayName} {record.hadithNumber}
                            </strong>
                            <span className="rounded-full border border-[var(--color-gold)]/60 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--color-red)]">
                              {record.grade ? record.grade.value : "grade unavailable"}
                            </span>
                          </div>
                          {record.book || record.chapter ? (
                            <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                              {[record.book, record.chapter].filter(Boolean).join(" / ")}
                            </p>
                          ) : null}
                          <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-[var(--color-ink)]">
                            {record.englishText || record.snippet || "English text unavailable in this source record."}
                          </p>
                          <p className="mt-3 whitespace-pre-wrap text-right text-base font-black leading-8 text-[var(--color-green)]">
                            {record.arabicText}
                          </p>
                          <div className="mt-3 grid gap-1 text-xs font-bold leading-5 text-[var(--color-muted)]">
                            <span>Dataset: {record.sourceDataset}</span>
                            <span>Reference: {record.sourceReference}</span>
                            {record.grade ? (
                              <span>
                                Grade source: {record.grade.source} ({record.grade.sourceReference})
                              </span>
                            ) : null}
                          </div>
                          {record.provenanceNotes.length > 0 ? (
                            <p className="mt-3 rounded-2xl border border-[var(--color-green)]/10 bg-[var(--color-sand)] px-3 py-2 text-xs font-bold leading-5 text-[var(--color-muted)]">
                              {record.provenanceNotes.join(" ")}
                            </p>
                          ) : null}
                        </article>
                      ))}
                    </div>

                    {retrieval?.warnings.length ? (
                      <div className="mt-4 rounded-2xl border border-[var(--color-red)]/18 bg-white/60 p-3">
                        {retrieval.warnings.map((warning) => (
                          <p className="text-sm font-bold leading-6 text-[var(--color-muted)]" key={warning.code}>
                            {warning.message}
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
