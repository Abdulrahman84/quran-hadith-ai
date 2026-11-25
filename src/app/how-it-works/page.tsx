"use client";

import { useI18n } from "@/components/i18n-provider";
import { InfoHero } from "@/components/info/info-hero";
import { InfoLinks } from "@/components/info/info-links";
import { LtrTerms } from "@/components/info/ltr-terms";
import type { TranslationKey } from "@/lib/i18n";

// Step names are shared with the search loader, so the page and the progress
// view use the same words.
const steps: Array<{ titleKey: TranslationKey; textKeys: TranslationKey[] }> = [
  { titleKey: "loading.step.understand", textKeys: ["how.step.understand.text"] },
  { titleKey: "loading.step.retrieve", textKeys: ["how.step.retrieve.text", "how.step.retrieve.meaningSearch"] },
  { titleKey: "loading.step.draft", textKeys: ["how.step.draft.text"] },
  { titleKey: "loading.step.check", textKeys: ["how.step.check.text"] },
];

const limitKeys: TranslationKey[] = ["how.limit.fatwa", "how.limit.check", "how.limit.only", "how.limit.meaning"];

export default function HowItWorks() {
  const { t } = useI18n();

  return (
    <main className="info-page">
      <InfoHero eyebrow={t("how.eyebrow")} intro={t("how.intro")} title={t("how.title")} />

      <section aria-labelledby="how-steps" className="info-section">
        <h2 className="info-section-title" id="how-steps">
          {t("how.steps.title")}
        </h2>
        <p className="info-section-lede">{t("how.steps.text")}</p>
        <ol className="info-steps">
          {steps.map((step, index) => (
            <li className="info-step" key={step.titleKey}>
              <span aria-hidden="true" className="step-numeral">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="info-step-title">{t(step.titleKey)}</h3>
                {step.textKeys.map((key) => (
                  <p className="info-step-text" key={key}>
                    <LtrTerms text={t(key)} />
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="how-limits" className="info-section">
        <h2 className="info-section-title" id="how-limits">
          {t("how.limits.title")}
        </h2>
        <ul className="info-list">
          {limitKeys.map((key) => (
            <li key={key}>
              <span aria-hidden="true" className="rule-diamond" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>
      <InfoLinks />
    </main>
  );
}
