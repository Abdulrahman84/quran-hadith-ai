"use client";

import { useI18n } from "@/components/i18n-provider";
import { PolicySectionNav } from "@/components/policy-section-nav";
import { Guardrails } from "@/components/source-policy/guardrails";
import { ProvenanceSection } from "@/components/source-policy/provenance-section";
import { SourceDirectory } from "@/components/source-policy/source-directory";
import { TrustFlow } from "@/components/source-policy/trust-flow";

export default function SourcePolicy() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] pt-20 text-[var(--color-ink)] sm:pt-24">

      <section className="relative z-10 mx-auto max-w-6xl overflow-hidden px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="animate-rise relative z-10">
          <p className="page-kicker">{t("policy.eyebrow")}</p>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-bold leading-[1.18] text-[var(--color-ink)] sm:text-6xl">
            {t("policy.title")}
          </h1>
          <p className="mt-6 max-w-3xl text-base font-medium leading-8 text-[var(--color-muted)] sm:text-lg sm:leading-9">
            {t("policy.intro")}
          </p>
          <PolicySectionNav />
        </div>
      </section>

      <TrustFlow />
      <SourceDirectory />
      <Guardrails />
      <ProvenanceSection />
    </main>
  );
}
