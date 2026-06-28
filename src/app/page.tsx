"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

const suggestions = [
  "Find hadith on intention with source",
  "Show tafsir notes about mercy",
  "Explain what the sources say",
];

const sourceRoutes = ["Quran", "Tafsir", "Hadith"];

type MockRecord = {
  label: string;
  source: string;
  status: string;
  note: string;
};

function buildMockRetrieval(question: string): MockRecord[] {
  const normalized = question.toLowerCase();
  const wantsHadith = /hadith|sunnah|grade|intention/.test(normalized);
  const wantsTafsir = /tafsir|quran|verse|mercy|explain/.test(normalized);

  return [
    {
      label: wantsTafsir ? "Quran + Tafsir match" : "Quran route available",
      source: "Tafsir MCP mock",
      status: wantsTafsir ? "Queued for retrieval" : "Available if Quran or tafsir evidence is needed",
      note: "No Quran text or tafsir excerpt is generated in mock mode. Real text must come from the configured source server.",
    },
    {
      label: wantsHadith ? "Hadith match" : "Hadith route available",
      source: "Hadith MCP mock",
      status: wantsHadith ? "Queued for retrieval" : "Available if hadith evidence is needed",
      note: "No hadith text or grade is generated in mock mode. Grades stay null until an attributed source returns them.",
    },
    {
      label: "Answer boundary",
      source: "Product policy",
      status: "Citation pack required",
      note: "The assistant can summarize retrieved records, expose missing provenance, and avoid fatwas or unsupported interpretation.",
    },
  ];
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasScenario = isRetrieving || Boolean(submittedQuestion);

  const mockRecords = useMemo(
    () => (submittedQuestion ? buildMockRetrieval(submittedQuestion) : []),
    [submittedQuestion],
  );

  const activeRoutes = useMemo(() => {
    const normalized = submittedQuestion.toLowerCase();

    return {
      Quran: /quran|verse|mercy|explain|tafsir/.test(normalized),
      Tafsir: /tafsir|explain|mercy|quran/.test(normalized),
      Hadith: /hadith|sunnah|grade|intention/.test(normalized),
    };
  }, [submittedQuestion]);

  useEffect(() => {
    if (textareaRef.current) {
      resizeQuestionField(textareaRef.current);
    }
  }, [question]);

  useEffect(() => {
    if (!isRetrieving) {
      return;
    }

    const retrievalTimer = window.setTimeout(() => {
      setIsRetrieving(false);
    }, 5000);

    return () => window.clearTimeout(retrievalTimer);
  }, [isRetrieving, submittedQuestion]);

  function runMockSearch(nextQuestion: string) {
    const trimmed = nextQuestion.trim();

    if (!trimmed) {
      return;
    }

    setQuestion(trimmed);
    setSubmittedQuestion(trimmed);
    setIsRetrieving(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runMockSearch(question);
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    runMockSearch(question);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-sand)] text-[var(--color-ink)]">
      <div className="source-grid" aria-hidden="true" />

      <header className="sticky top-0 z-30 border-b border-[var(--color-green)]/10 bg-[var(--color-sand)]/88 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link className="group flex items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-2xl border border-[var(--color-gold)] bg-[var(--color-green)] text-sm font-black text-[var(--color-sand)] transition-transform duration-300 group-hover:-translate-y-0.5">
              QH
            </span>
            <span>
              <strong className="block text-sm font-black uppercase tracking-[0.16em]">Quran Hadith AI</strong>
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
                <button className="chip" key={suggestion} onClick={() => runMockSearch(suggestion)} type="button">
                  {suggestion}
                </button>
              ))}
            </div>

            <div className="animate-rise mt-8 w-full max-w-3xl rounded-[2rem] border border-[var(--color-green)]/12 bg-white/54 p-5 [animation-delay:300ms]">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--color-green)]">
                Start a mock source retrieval
              </p>
              <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-7 text-[var(--color-muted)]">
                Results appear only after you search. The app stays empty until there is a question to route.
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
                    {isRetrieving ? "Retrieving" : "Mock retrieval"}
                  </p>
                  <h2 className="mt-1 text-lg font-black text-white">
                    {isRetrieving ? "Tracing source routes" : "Citation pack preview"}
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
                  <p className="text-xs font-bold text-white/70">Mock routing only</p>
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
                    <p>Retrieving mock source routes...</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-red)]">
                      Mock records returned
                    </p>
                    <p className="mt-3 text-sm font-bold leading-7">
                      Placeholder retrieval data only. The UI shows where sources, grades, and limits appear before a
                      model drafts an answer.
                    </p>

                    <div className="mt-4 grid gap-2">
                      {mockRecords.map((record) => (
                        <article
                          className="rounded-2xl border border-[var(--color-green)]/14 bg-white/72 p-3"
                          key={record.label}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong className="text-sm text-[var(--color-green)]">{record.label}</strong>
                            <span className="rounded-full border border-[var(--color-gold)]/60 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[var(--color-red)]">
                              {record.source}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--color-muted)]">
                            {record.status}
                          </p>
                          <p className="mt-2 text-sm font-bold leading-6 text-[var(--color-muted)]">{record.note}</p>
                        </article>
                      ))}
                    </div>
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
