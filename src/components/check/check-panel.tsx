"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import { SearchLoading } from "@/components/search-loading";
import { ApiUnreachableError, fetchApi } from "@/lib/api-url";
import { isVagueCheckPrompt } from "@/lib/check/input-validation";
import type { CheckResponse, CheckType } from "@/lib/check/types";

import { CheckSourceCard } from "./check-source-card";

const checkTypes: CheckType[] = ["ayah", "hadith"];

const outcomeKeys = {
  exact: "check.outcome.exact",
  similar: "check.outcome.similar",
  not_found: "check.outcome.not_found",
} as const;

export function CheckPanel() {
  const { language, t } = useI18n();
  const [text, setText] = useState("");
  const [submittedText, setSubmittedText] = useState("");
  const [checkType, setCheckType] = useState<CheckType>("ayah");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!result && !error) {
      return;
    }

    resultRef.current?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [error, result]);

  function changeType(nextType: CheckType) {
    abortRef.current?.abort();
    setCheckType(nextType);
    setResult(null);
    setError("");
    setIsLoading(false);
  }

  function editCheck() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setResult(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checkedText = text.trim();

    if (checkedText.length < 8) {
      setError(t("check.tooShort"));
      return;
    }

    if (isVagueCheckPrompt(checkedText)) {
      setError(t("check.ambiguous"));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSubmittedText(checkedText);
    setIsLoading(true);
    setResult(null);
    setError("");

    try {
      const response = await fetchApi("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: checkedText,
          checkType,
          language: language === "ar" ? "arabic" : "english",
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as CheckResponse;

      if (!response.ok || payload.status === "error") {
        throw new Error(payload.warnings[0]?.message || t("check.failed"));
      }

      setResult(payload);
    } catch (caught) {
      if (!controller.signal.aborted) {
        if (caught instanceof ApiUnreachableError) {
          setError(t("error.offline"));
        } else {
          setError(caught instanceof Error ? caught.message : t("check.failed"));
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsLoading(false);
      }
    }
  }

  return (
    <div className="w-full">
      <form className="search-shell w-full overflow-hidden text-start" onSubmit={submit}>
        {isLoading ? (
          <div className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3 sm:px-5">
            <div aria-atomic="true" aria-live="polite" className="min-w-0 flex-1" role="status">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">
                {t("check.checking")}
              </p>
              <p className="mt-1 line-clamp-1 whitespace-pre-wrap text-sm font-semibold text-[var(--color-ink)]">
                {submittedText}
              </p>
            </div>
            <span className="pulse-dot shrink-0" aria-hidden="true" />
            <button
              className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-green)] transition hover:border-[var(--color-green)]/35"
              onClick={editCheck}
              type="button"
            >
              {t("home.editQuestion")}
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
        <label className="text-sm font-bold text-[var(--color-muted)]" htmlFor="check-text">
          {t("check.inputLabel")}
        </label>
        <textarea
          className="query-textarea mt-3 min-h-28 w-full resize-y bg-transparent text-lg font-semibold leading-8 text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/50"
          disabled={isLoading}
          id="check-text"
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("check.placeholder")}
          value={text}
        />

        <div className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-[1fr_auto]">
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-[var(--color-muted)]">{t("check.typeLabel")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {checkTypes.map((type) => (
                <label
                  className={`cursor-pointer rounded-lg border px-3 py-3 text-center text-sm font-bold transition ${
                    checkType === type
                      ? "border-[var(--color-green)] bg-[var(--color-primary-soft)] text-[var(--color-green)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)]"
                  }`}
                  key={type}
                >
                  <input
                    checked={checkType === type}
                    className="sr-only"
                    disabled={isLoading}
                    name="check-type"
                    onChange={() => changeType(type)}
                    type="radio"
                    value={type}
                  />
                  {t(type === "ayah" ? "check.ayah" : "check.hadith")}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-end">
            <button
              className="action-button inline-flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[var(--color-green)] px-8 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              disabled={isLoading || text.trim().length < 8}
              type="submit"
            >
              {isLoading ? t("check.checking") : t("check.submit")}
            </button>
          </div>
        </div>
          </div>
        )}
      </form>

      {(isLoading || result || error) ? (
        <div
          aria-live="polite"
          className="mt-4 scroll-mt-24 rounded-2xl bg-[var(--color-green)] p-4 text-start outline-none"
          ref={resultRef}
          tabIndex={-1}
        >
          {isLoading ? (
            <div className="flex min-h-[clamp(18rem,48svh,36rem)] items-center justify-center rounded-xl bg-[var(--color-sand)] p-4">
              <SearchLoading
                label={t("check.searchingMeaning")}
                phaseLabel={t("result.progressRetrieving")}
                progress={48}
              />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-[var(--color-sand)] p-4" role="alert">
              <strong className="text-sm text-[var(--color-red)]">{t("check.failed")}</strong>
              <p className="mt-2 text-sm text-[var(--color-muted)]">{error}</p>
            </div>
          ) : result?.outcome ? (
            <div className="rounded-xl bg-[var(--color-sand)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">
                {t("check.resultLabel")}
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--color-green)]">
                {t(outcomeKeys[result.outcome])}
              </h2>
              {result.answer ? (
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--color-ink)]">
                  {result.answer.text}
                </p>
              ) : null}
              {result.records.length ? (
                <div className="mt-4 grid gap-3">
                  {result.records.map((record) => (
                    <CheckSourceCard key={record.id} language={language} record={record} t={t} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
