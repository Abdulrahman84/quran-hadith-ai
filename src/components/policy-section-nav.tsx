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
      <div className="flex w-max gap-2">
        {sections.map((section, index) => (
          <a
            className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm font-bold text-[var(--color-green)] shadow-[0_8px_20px_rgba(22,58,95,0.04)] transition hover:border-[var(--color-green-soft)] hover:bg-[var(--color-primary-soft)]"
            href={section.href}
            key={section.href}
          >
            <span className="text-xs text-[var(--color-green)]">{String(index + 1).padStart(2, "0")}</span>
            {t(section.labelKey)}
          </a>
        ))}
      </div>
    </nav>
  );
}
