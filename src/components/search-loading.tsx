"use client";

import Image from "next/image";

type SearchLoadingProps = {
  label: string;
  phaseLabel: string;
  progress: number;
};

export function SearchLoading({ label, phaseLabel, progress }: SearchLoadingProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="source-loading">
      <Image
        alt=""
        aria-hidden="true"
        className="source-loading-mark"
        height={82}
        src="/assets/sanad-ai-loader.svg?v=midnight-manuscript-3"
        style={{ height: "auto", width: "min(17rem, 72vw)" }}
        unoptimized
        width={176}
      />
      <div className="search-progress-copy">
        <p>{label}</p>
        <span aria-live="polite">{phaseLabel}</span>
      </div>
      <div
        aria-label={phaseLabel}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={safeProgress}
        aria-valuetext={`${safeProgress}% — ${phaseLabel}`}
        className="search-progress"
        role="progressbar"
      >
        <div className="search-progress-track">
          <span className="search-progress-fill" style={{ width: `${safeProgress}%` }} />
        </div>
        <strong>{safeProgress}%</strong>
      </div>
    </div>
  );
}
