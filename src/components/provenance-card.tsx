"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

type ProvenanceCardProps = {
  index: number;
  titleKey: TranslationKey;
  originKey: TranslationKey;
  useKey: TranslationKey;
  visibleKey: TranslationKey;
  noteKey: TranslationKey;
};

export function ProvenanceCard({ index, titleKey, originKey, useKey, visibleKey, noteKey }: ProvenanceCardProps) {
  const { t } = useI18n();

  return (
    <details
      className="animate-rise group rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] p-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--color-green)] [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-green)] text-sm font-bold text-[var(--color-gold-on-dark)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-7 text-[var(--color-green)]">{t(titleKey)}</span>
          <span className="block text-sm font-semibold leading-6 text-[var(--color-green-soft)]">{t(originKey)}</span>
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-[var(--color-green)] transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m7 9 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </summary>

      <div className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 lg:grid-cols-3">
        <ProvenanceField label={t("policy.provenance.useLabel")} text={t(useKey)} />
        <ProvenanceField label={t("policy.provenance.visibleLabel")} text={t(visibleKey)} />
        <ProvenanceField label={t("policy.provenance.noteLabel")} text={t(noteKey)} />
      </div>
    </details>
  );
}

function ProvenanceField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-green)]/70">{label}</p>
      <p className="mt-2 text-sm font-medium leading-7 text-[var(--color-muted)]">{text}</p>
    </div>
  );
}
