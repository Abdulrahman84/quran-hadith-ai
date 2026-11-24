"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";
import type { SearchProgressPhase } from "@/lib/search-stream";

// The four steps a search goes through, in the order the server reports them.
// "starting" is the moment before routing begins, so it counts as the first step.
const steps: Array<{ labelKey: TranslationKey; phases: SearchProgressPhase[] }> = [
  { labelKey: "loading.step.understand", phases: ["starting", "routing"] },
  { labelKey: "loading.step.retrieve", phases: ["retrieving"] },
  { labelKey: "loading.step.draft", phases: ["answering"] },
  { labelKey: "loading.step.check", phases: ["finalizing"] },
];

export function activeStepIndex(phase: SearchProgressPhase) {
  return Math.max(
    0,
    steps.findIndex((step) => step.phases.includes(phase)),
  );
}

type SearchLoadingProps = {
  phase: SearchProgressPhase;
  /** Server-reported progress; announced to assistive tech, never drawn as a percentage. */
  progress: number;
  /** A quiet line of real retrieval detail under the active step. */
  detail?: string | null;
  /** Optional heading above the steps. */
  label?: string;
  /** One-line form shown above a streaming answer draft. */
  compact?: boolean;
};

// Seconds spent on the current step; restarts whenever the step changes.
function useStepSeconds(stepIndex: number) {
  const [elapsed, setElapsed] = useState({ stepIndex, seconds: 0 });

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsed({ stepIndex, seconds: Math.floor((Date.now() - startedAt) / 1000) });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [stepIndex]);

  return elapsed.stepIndex === stepIndex ? elapsed.seconds : 0;
}

export function SearchLoading({ phase, progress, detail, label, compact = false }: SearchLoadingProps) {
  const { t } = useI18n();
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const currentStep = activeStepIndex(phase);
  const seconds = useStepSeconds(currentStep);
  const currentLabel = t(steps[currentStep].labelKey);
  const stepText = t("loading.stepOf")
    .replace("{step}", String(currentStep + 1))
    .replace("{total}", String(steps.length))
    .replace("{label}", currentLabel);
  const elapsedText = t("loading.elapsed").replace("{seconds}", String(seconds));

  return (
    <div className="search-steps" data-compact={compact || undefined}>
      {label && !compact ? <p className="search-steps-title">{label}</p> : null}
      <div
        aria-label={currentLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={safeProgress}
        aria-valuetext={stepText}
        className="search-steps-progress"
        role="progressbar"
      >
        <ol className="search-steps-list">
          {steps.map((step, index) => {
            const state = index < currentStep ? "done" : index === currentStep ? "active" : "pending";

            if (compact && state !== "active") {
              return null;
            }

            return (
              <li className="search-step" data-state={state} key={step.labelKey}>
                <span aria-hidden="true" className="search-step-marker">
                  {state === "done" ? (
                    <svg fill="none" viewBox="0 0 12 12">
                      <path d="m2.5 6.2 2.3 2.3 4.7-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                    </svg>
                  ) : null}
                </span>
                <span className="search-step-body">
                  <span className="search-step-heading">
                    <span className="search-step-label">{t(step.labelKey)}</span>
                    {state === "active" ? (
                      <span aria-hidden="true" className="search-step-time">
                        {elapsedText}
                      </span>
                    ) : null}
                  </span>
                  {state === "active" && detail ? <span className="search-step-detail">{detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p aria-live="polite" className="sr-only" role="status">
        {stepText}
      </p>
    </div>
  );
}
