"use client";

import { useI18n } from "@/components/i18n-provider";
import { IslamicGeometry } from "@/components/islamic-geometry";
import { ProvenanceDisclosure } from "@/components/source-policy/provenance-disclosure";
import type { TranslationKey } from "@/lib/i18n";

const items: Array<{
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

export function ProvenanceSection() {
  const { t } = useI18n();

  return (
    <section
      className="relative z-10 mx-auto max-w-6xl scroll-mt-24 overflow-hidden px-5 py-20 sm:px-8 sm:py-28"
      id="provenance"
    >
      <IslamicGeometry
        className="bottom-2 end-[-4rem] h-48 w-48 text-[var(--color-green)] opacity-[0.045]"
        variant="weave"
      />

      <div className="relative z-10 mb-12 max-w-3xl">
        <p className="text-xs font-bold text-[var(--color-green)]">{t("policy.provenance.eyebrow")}</p>
        <h2 className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)] sm:text-4xl">
          {t("policy.provenance.title")}
        </h2>
        <p className="mt-4 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.provenance.text")}</p>
      </div>

      <div className="relative z-10 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {items.map((item, index) => (
          <ProvenanceDisclosure index={index} key={item.titleKey} {...item} />
        ))}
      </div>
    </section>
  );
}
