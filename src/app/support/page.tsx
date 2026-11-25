"use client";

import Link from "next/link";

import { useI18n } from "@/components/i18n-provider";
import { InfoHero } from "@/components/info/info-hero";
import { TextSections, type TextSection } from "@/components/info/text-sections";

const issuesUrl = "https://github.com/Abdulrahman84/quran-hadith-ai/issues/new";

export default function SupportPage() {
  const { t } = useI18n();

  const sections: TextSection[] = [
    {
      id: "support-report",
      title: "support.report.title",
      paragraphs: ["support.report.text"],
      children: (
        <a className="text-section-link" href={issuesUrl} rel="noopener noreferrer" target="_blank">
          {t("support.report.link")}
        </a>
      ),
    },
    { id: "support-source", title: "support.source.title", paragraphs: ["support.source.text"] },
    {
      id: "support-faq",
      title: "support.faq.title",
      paragraphs: [],
      children: (
        <dl className="faq-list">
          <dt>{t("support.faq.fatwaQ")}</dt>
          <dd>{t("support.faq.fatwaA")}</dd>
          <dt>{t("support.faq.offlineQ")}</dt>
          <dd>{t("support.faq.offlineA")}</dd>
        </dl>
      ),
    },
  ];

  return (
    <main className="info-page">
      <InfoHero eyebrow={t("support.eyebrow")} intro={t("support.intro")} title={t("support.title")} />
      <TextSections sections={sections} />
      <p className="info-section">
        <Link className="text-section-link" href="/privacy">
          {t("support.privacyLink")}
        </Link>
      </p>
    </main>
  );
}
