"use client";

type AnswerDraftPreviewProps = {
  text: string;
  title: string;
  checkingLabel: string;
  dir: "rtl" | "ltr";
};

export function AnswerDraftPreview({ text, title, checkingLabel, dir }: AnswerDraftPreviewProps) {
  return (
    <div className="answer-block w-full self-stretch" aria-busy="true">
      <p className="home-section-label">{title}</p>
      <p className="answer-text answer-text-draft whitespace-pre-wrap" dir={dir}>
        {text}
        <span aria-hidden="true" className="answer-draft-caret" />
      </p>
      <p className="mt-4 flex items-center gap-2 text-xs font-semibold leading-6 text-[var(--color-muted)]" role="status">
        <span aria-hidden="true" className="pulse-dot" />
        {checkingLabel}
      </p>
    </div>
  );
}
