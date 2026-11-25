"use client";

import { useI18n } from "@/components/i18n-provider";
import { InfoHero } from "@/components/info/info-hero";
import { TextSections, type TextSection } from "@/components/info/text-sections";

const sections: TextSection[] = [
  { id: "privacy-sent", title: "privacy.sent.title", paragraphs: ["privacy.sent.text"] },
  { id: "privacy-processing", title: "privacy.processing.title", paragraphs: ["privacy.processing.text"] },
  { id: "privacy-stored", title: "privacy.stored.title", paragraphs: ["privacy.stored.text"] },
  { id: "privacy-network", title: "privacy.network.title", paragraphs: ["privacy.network.text"] },
  { id: "privacy-device", title: "privacy.device.title", paragraphs: ["privacy.device.text"] },
  { id: "privacy-delete", title: "privacy.delete.title", paragraphs: ["privacy.delete.text"] },
  { id: "privacy-children", title: "privacy.children.title", paragraphs: ["privacy.children.text"] },
  { id: "privacy-changes", title: "privacy.changes.title", paragraphs: ["privacy.changes.text"] },
];

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <main className="info-page">
      <InfoHero eyebrow={t("privacy.eyebrow")} intro={t("privacy.intro")} title={t("privacy.title")} />
      <TextSections sections={sections} />
    </main>
  );
}
