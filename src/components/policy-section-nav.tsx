"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const sections: Array<{ href: string; labelKey: TranslationKey }> = [
  { href: "#trust-flow", labelKey: "policy.nav.flow" },
  { href: "#approved-sources", labelKey: "policy.nav.sources" },
  { href: "#guardrails", labelKey: "policy.nav.guardrails" },
  { href: "#provenance", labelKey: "policy.nav.provenance" },
];

export function PolicySectionNav() {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("policy.nav.label")}
      className="mt-7 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max gap-2 rounded-2xl border border-[var(--color-border)] border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-surface)] p-2 shadow-[0_12px_30px_rgba(23,26,25,0.06)]">
        {sections.map((section, index) => (
          <a
            className="group inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-transparent px-3 text-sm font-bold text-[var(--color-ink)] transition hover:border-[var(--color-gold)]/45 hover:bg-[var(--color-gold-soft)] sm:px-4"
            href={section.href}
            key={section.href}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-ink)] text-[0.65rem] text-[var(--color-gold-on-dark)] transition group-hover:bg-[var(--color-green)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {t(section.labelKey)}
          </a>
        ))}
      </div>
    </nav>
  );
}
