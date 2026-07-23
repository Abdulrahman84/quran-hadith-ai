"use client";

import { useI18n } from "@/components/i18n-provider";
import { PolicySectionNav } from "@/components/policy-section-nav";
import { ProvenanceCard } from "@/components/provenance-card";
import { SiteHeader } from "@/components/site-header";
import type { TranslationKey } from "@/lib/i18n";

const ruleKeys: TranslationKey[] = [
  "policy.rule.one",
  "policy.rule.two",
  "policy.rule.three",
  "policy.rule.four",
  "policy.rule.five",
];

const sourceGroups: Array<{ titleKey: TranslationKey; textKey: TranslationKey; itemKeys: TranslationKey[] }> = [
  {
    titleKey: "policy.sources.quran.title",
    textKey: "policy.sources.quran.text",
    itemKeys: ["policy.sources.quran.item"],
  },
  {
    titleKey: "policy.sources.tafsir.title",
    textKey: "policy.sources.tafsir.text",
    itemKeys: [
      "policy.sources.tafsir.tabari",
      "policy.sources.tafsir.kathir",
      "policy.sources.tafsir.baghawi",
      "policy.sources.tafsir.saadi",
      "policy.sources.tafsir.muyassar",
      "policy.sources.tafsir.mukhtasar",
    ],
  },
  {
    titleKey: "policy.sources.hadith.title",
    textKey: "policy.sources.hadith.text",
    itemKeys: [
      "policy.sources.hadith.bukhari",
      "policy.sources.hadith.muslim",
      "policy.sources.hadith.abudawud",
      "policy.sources.hadith.tirmidhi",
      "policy.sources.hadith.nasai",
      "policy.sources.hadith.majah",
    ],
  },
];

const trustFlowItems: Array<{ icon: "source" | "arrange" | "answer"; titleKey: TranslationKey; textKey: TranslationKey }> = [
  {
    icon: "source",
    titleKey: "policy.flow.sources.title",
    textKey: "policy.flow.sources.text",
  },
  {
    icon: "arrange",
    titleKey: "policy.flow.arrange.title",
    textKey: "policy.flow.arrange.text",
  },
  {
    icon: "answer",
    titleKey: "policy.flow.answer.title",
    textKey: "policy.flow.answer.text",
  },
];

const provenanceItems: Array<{
  titleKey: TranslationKey;
  originKey: TranslationKey;
  useKey: TranslationKey;
  visibleKey: TranslationKey;
  noteKey: TranslationKey;
}> = [
  {
    titleKey: "policy.provenance.quran.title",
    originKey: "policy.provenance.quran.origin",
    useKey: "policy.provenance.quran.use",
    visibleKey: "policy.provenance.quran.visible",
    noteKey: "policy.provenance.quran.note",
  },
  {
    titleKey: "policy.provenance.tafsir.title",
    originKey: "policy.provenance.tafsir.origin",
    useKey: "policy.provenance.tafsir.use",
    visibleKey: "policy.provenance.tafsir.visible",
    noteKey: "policy.provenance.tafsir.note",
  },
  {
    titleKey: "policy.provenance.hadith.title",
    originKey: "policy.provenance.hadith.origin",
    useKey: "policy.provenance.hadith.use",
    visibleKey: "policy.provenance.hadith.visible",
    noteKey: "policy.provenance.hadith.note",
  },
];

const boundarySteps: Array<{ icon: "source" | "arrange" | "answer"; titleKey: TranslationKey }> = [
  {
    icon: "source",
    titleKey: "policy.boundary.sources",
  },
  {
    icon: "arrange",
    titleKey: "policy.boundary.model",
  },
  {
    icon: "answer",
    titleKey: "policy.boundary.answer",
  },
];

function FlowIcon({ type }: { type: "source" | "arrange" | "answer" }) {
  if (type === "source") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path d="M5 5.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v13l-3-1.8-3 1.8-3-1.8-3 1.8v-13Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        <path d="M8.5 8h7M8.5 11h7M8.5 14h4" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </svg>
    );
  }

  if (type === "arrange") {
    return (
      <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path d="M7 5h10M7 12h10M7 19h10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        <path d="M4 5h.01M4 12h.01M4 19h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-7Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 8.5h8M8 11.5h5" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export default function SourcePolicy() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-sand)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />
      <SiteHeader />

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-green-soft)]">{t("policy.eyebrow")}</p>
        <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold leading-tight text-[var(--color-green)] sm:text-5xl">
          {t("policy.title")}
        </h1>
        <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
          {t("policy.intro")}
        </p>
        <PolicySectionNav />
      </section>

      <section className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 pb-10 sm:px-8" id="trust-flow">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-green-soft)]">
            {t("policy.flow.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-green)] sm:text-3xl">
            {t("policy.flow.title")}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.flow.text")}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {trustFlowItems.map((item, index) => (
            <article
              className="animate-rise rounded-2xl border border-[var(--color-green)] bg-[var(--color-green)] p-5 text-[var(--color-sand)] shadow-[0_18px_42px_rgba(22,58,95,0.14)]"
              key={item.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="grid h-12 w-12 place-items-center rounded-full border border-[var(--color-gold)]/60 bg-white/8 text-[var(--color-gold-on-dark)]">
                <FlowIcon type={item.icon} />
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">{t(item.titleKey)}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-white/76">{t(item.textKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 pb-10 sm:px-8" id="approved-sources">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-green-soft)]">
            {t("policy.sources.eyebrow")}
          </p>
          <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-green)] sm:text-3xl">
            {t("policy.sources.title")}
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.sources.text")}</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {sourceGroups.map((group, index) => (
            <article
              className="animate-rise rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_10px_28px_rgba(22,58,95,0.04)]"
              key={group.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <h3 className="text-xl font-bold text-[var(--color-green)]">{t(group.titleKey)}</h3>
              <p className="mt-2 text-sm font-medium leading-7 text-[var(--color-muted)]">{t(group.textKey)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.itemKeys.map((itemKey) => (
                  <span
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-gold-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-green)]"
                    key={itemKey}
                  >
                    {t(itemKey)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 pb-10 sm:px-8" id="guardrails">
        <div className="relative overflow-hidden rounded-2xl bg-[var(--color-green)] p-5 text-[var(--color-sand)] shadow-[0_24px_60px_rgba(22,58,95,0.20)] sm:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-[var(--color-gold)]/60" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08]" aria-hidden="true">
            <div className="h-full w-full bg-[linear-gradient(90deg,currentColor_1px,transparent_1px),linear-gradient(0deg,currentColor_1px,transparent_1px)] bg-[size:46px_46px]" />
          </div>

          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-gold-on-dark)]">
                {t("policy.boundary.title")}
              </p>
              <h2 className="mt-4 max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">
                {t("policy.guardrails.title")}
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/76">{t("policy.guardrails.text")}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {boundarySteps.map((step, index) => (
                <article
                  className="animate-rise relative rounded-xl border border-white/12 bg-white/8 p-4"
                  key={step.titleKey}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {index < boundarySteps.length - 1 ? (
                    <span
                      className="absolute top-9 hidden h-px w-8 bg-[var(--color-gold)]/60 ltr:-right-5 rtl:-left-5 md:block"
                      aria-hidden="true"
                    />
                  ) : null}
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--color-gold)] text-[var(--color-green)]">
                    <FlowIcon type={step.icon} />
                  </div>
                  <p className="mt-4 text-base font-semibold leading-7 text-white">{t(step.titleKey)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="relative mt-7 grid gap-2 border-t border-white/12 pt-5 lg:grid-cols-2">
            {ruleKeys.map((ruleKey, index) => (
              <article
                className={`animate-rise flex gap-3 rounded-xl border border-white/10 bg-[var(--color-green)]/55 p-4 ${index === ruleKeys.length - 1 ? "lg:col-span-2" : ""}`}
                key={ruleKey}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-gold)]/50 text-xs font-bold text-[var(--color-gold-on-dark)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-sm font-semibold leading-7 text-white/86">{t(ruleKey)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 pb-16 sm:px-8" id="provenance">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_18px_42px_rgba(22,58,95,0.07)] sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-green-soft)]">
                {t("policy.provenance.eyebrow")}
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--color-green)]">
                {t("policy.provenance.title")}
              </h2>
              <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">
                {t("policy.provenance.text")}
              </p>
            </div>

            <div className="grid gap-3">
              {provenanceItems.map((item, index) => (
                <ProvenanceCard
                  index={index}
                  key={item.titleKey}
                  noteKey={item.noteKey}
                  originKey={item.originKey}
                  titleKey={item.titleKey}
                  useKey={item.useKey}
                  visibleKey={item.visibleKey}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
