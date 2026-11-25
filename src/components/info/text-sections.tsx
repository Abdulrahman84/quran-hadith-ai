"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/components/i18n-provider";
import { LtrTerms } from "@/components/info/ltr-terms";
import type { TranslationKey } from "@/lib/i18n";

export type TextSection = {
  id: string;
  title: TranslationKey;
  paragraphs: TranslationKey[];
  children?: ReactNode;
};

export function TextSections({ sections }: { sections: TextSection[] }) {
  const { t } = useI18n();

  return (
    <>
      {sections.map((section) => (
        <section aria-labelledby={section.id} className="info-section text-section" key={section.id}>
          <h2 className="info-section-title" id={section.id}>
            {t(section.title)}
          </h2>
          {section.paragraphs.map((key) => (
            <p className="info-step-text" key={key}>
              <LtrTerms text={t(key)} />
            </p>
          ))}
          {section.children}
        </section>
      ))}
    </>
  );
}
