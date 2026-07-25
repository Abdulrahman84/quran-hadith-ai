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
      className="mt-9 overflow-x-auto border-y border-[var(--color-border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex w-max">
        {sections.map((section, index) => (
          <a
            className={`group inline-flex min-h-14 items-center gap-2 whitespace-nowrap px-4 text-sm font-bold text-[var(--color-muted)] transition hover:text-[var(--color-green)] sm:px-5 ${
              index < sections.length - 1 ? "border-e border-[var(--color-border)]" : ""
            }`}
            href={section.href}
            key={section.href}
          >
            <span className="font-mono text-[0.65rem] font-bold text-[var(--color-gold)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {t(section.labelKey)}
          </a>
        ))}
      </div>
    </nav>
  );
}
