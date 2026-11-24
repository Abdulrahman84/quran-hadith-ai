"use client";

type AnswerDraftPreviewProps = {
  text: string;
  title: string;
  checkingLabel: string;
  dir: "rtl" | "ltr";
};

export function AnswerDraftPreview({ text, title, checkingLabel, dir }: AnswerDraftPreviewProps) {
  return (
    <div className="w-full self-stretch rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-busy="true">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-green-soft)]">{title}</p>
      <p className="whitespace-pre-wrap text-sm font-semibold leading-8 text-[var(--color-green)]/85" dir={dir}>
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
