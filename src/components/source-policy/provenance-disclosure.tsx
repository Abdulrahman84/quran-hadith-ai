"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

type ProvenanceDisclosureProps = {
  index: number;
  titleKey: TranslationKey;
  originKey: TranslationKey;
  useKey: TranslationKey;
  visibleKey: TranslationKey;
  noteKey: TranslationKey;
};

export function ProvenanceDisclosure({
  index,
  titleKey,
  originKey,
  useKey,
  visibleKey,
  noteKey,
}: ProvenanceDisclosureProps) {
  const { t } = useI18n();
  const fields = [
    { label: t("policy.provenance.useLabel"), text: t(useKey) },
    { label: t("policy.provenance.visibleLabel"), text: t(visibleKey) },
    { label: t("policy.provenance.noteLabel"), text: t(noteKey) },
  ];

  return (
    <details className="animate-rise group py-7" style={{ animationDelay: `${index * 80}ms` }}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-4 rounded-sm marker:hidden focus-visible:ring-2 focus-visible:ring-[var(--color-green)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--background)] [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-mono text-sm font-bold text-[var(--color-gold)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-bold leading-8 text-[var(--color-ink)]">{t(titleKey)}</span>
          <span className="block text-sm font-semibold leading-6 text-[var(--color-green)]">{t(originKey)}</span>
        </span>
        <svg
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-[var(--color-gold)] transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path d="m7 9 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      </summary>

      <div className="mt-6 grid gap-6 border-t border-[var(--color-border)] pt-6 lg:grid-cols-3">
        {fields.map((field, fieldIndex) => (
          <div
            className={fieldIndex > 0 ? "lg:border-s lg:border-[var(--color-border)] lg:ps-6" : ""}
            key={field.label}
          >
            <p className="text-xs font-bold text-[var(--color-green)]">{field.label}</p>
            <p className="mt-2 text-sm font-medium leading-7 text-[var(--color-muted)]">{field.text}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
