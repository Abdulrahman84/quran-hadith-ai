"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";

type ExpandableSourceTextProps = {
  className: string;
  collapsible: boolean;
  dir: "ltr" | "rtl";
  showLessLabel: string;
  showMoreLabel: string;
  text: string;
};

export function ExpandableSourceText({
  className,
  collapsible,
  dir,
  showLessLabel,
  showMoreLabel,
  text,
}: ExpandableSourceTextProps) {
  const contentId = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const [overflowingText, setOverflowingText] = useState<string | null>(null);
  const isExpanded = expandedText === text;
  const hasOverflow = collapsible && overflowingText === text;

  useLayoutEffect(() => {
    const element = textRef.current;

    if (!collapsible || isExpanded || !element) {
      return;
    }

    let isActive = true;
    const measureOverflow = () => {
      if (isActive) {
        setOverflowingText(element.scrollHeight > element.clientHeight + 1 ? text : null);
      }
    };

    measureOverflow();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measureOverflow);
    observer?.observe(element);
    void document.fonts?.ready.then(measureOverflow);

    return () => {
      isActive = false;
      observer?.disconnect();
    };
  }, [collapsible, isExpanded, text]);

  return (
    <div className="mt-3">
      <p
        className={`source-result-text whitespace-pre-wrap ${className}`}
        data-collapsed={collapsible && !isExpanded}
        dir={dir}
        id={contentId}
        ref={textRef}
      >
        {text}
      </p>
      {hasOverflow ? (
        <button
          aria-controls={contentId}
          aria-expanded={isExpanded}
          className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-[var(--color-green)] transition hover:bg-[var(--color-primary-soft)]"
          onClick={() => setExpandedText(isExpanded ? null : text)}
          type="button"
        >
          {isExpanded ? showLessLabel : showMoreLabel}
          <svg
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
