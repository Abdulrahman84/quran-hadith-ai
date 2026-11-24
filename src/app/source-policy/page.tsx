"use client";

import { useI18n } from "@/components/i18n-provider";
import { InfoHero } from "@/components/info/info-hero";
import { LtrTerms } from "@/components/info/ltr-terms";
import { hadithCollections } from "@/lib/retrieval/hadith-collections";
import { tafsirSources } from "@/lib/retrieval/tafsir-sources";

// Rows per collection in the Hadith MCP build, from the meeAtif import report
// (hadith-mcp: data/generated/hadith-meeatif-import-report.md). Total 33,736.
const hadithCounts: Record<(typeof hadithCollections)[number]["id"], number> = {
  bukhari: 7277,
  muslim: 7368,
  abu_dawud: 5276,
  tirmidhi: 4053,
  nasai: 5683,
  ibn_majah: 4079,
};

const hadithDatasetUrl = "https://huggingface.co/datasets/meeAtif/hadith_datasets";
const tafsirCenterUrl = "https://tafsir.net";

function CreditLine({ text, href, linkLabel }: { text: string; href: string; linkLabel: string }) {
  return (
    <p className="info-credit">
      <LtrTerms text={text} />{" "}
      <a className="info-credit-link" href={href} rel="noopener noreferrer" target="_blank">
        {linkLabel}
      </a>
    </p>
  );
}

export default function SourcePolicy() {
  const { language, t } = useI18n();
  const labelField = language === "ar" ? "labelAr" : "labelEn";
  const number = new Intl.NumberFormat("en-US");

  return (
    <main className="info-page">
      <InfoHero eyebrow={t("policy.eyebrow")} intro={t("policy.intro")} title={t("policy.title")} />

      <ol className="info-steps info-sources">
        <li className="info-step">
          <span aria-hidden="true" className="step-numeral">
            01
          </span>
          <div>
            <h2 className="info-step-title">{t("policy.hadith.title")}</h2>
            <p className="info-step-text">{t("policy.hadith.text")}</p>
            <ul className="info-ledger">
              {hadithCollections.map((collection) => (
                <li key={collection.id}>
                  <span>{collection[labelField]}</span>
                  <span className="info-ledger-count">
                    {t("policy.hadith.count").replace("{count}", number.format(hadithCounts[collection.id]))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="info-step-text">{t("policy.hadith.grades")}</p>
            <CreditLine href={hadithDatasetUrl} linkLabel={t("policy.creditLink")} text={t("policy.hadith.credit")} />
          </div>
        </li>

        <li className="info-step">
          <span aria-hidden="true" className="step-numeral">
            02
          </span>
          <div>
            <h2 className="info-step-title">{t("policy.quran.title")}</h2>
            <p className="info-step-text">{t("policy.quran.text")}</p>
            <ul className="info-ledger">
              {tafsirSources.map((source) => (
                <li key={source.id}>
                  <span>{source[labelField]}</span>
                </li>
              ))}
            </ul>
            <CreditLine href={tafsirCenterUrl} linkLabel={t("policy.creditLink")} text={t("policy.quran.credit")} />
          </div>
        </li>

        <li className="info-step">
          <span aria-hidden="true" className="step-numeral">
            03
          </span>
          <div>
            <h2 className="info-step-title">{t("policy.privacy.title")}</h2>
            <p className="info-step-text">{t("policy.privacy.ai")}</p>
            <p className="info-step-text">
              <LtrTerms text={t("policy.privacy.stats")} />
            </p>
          </div>
        </li>
      </ol>
    </main>
  );
}
