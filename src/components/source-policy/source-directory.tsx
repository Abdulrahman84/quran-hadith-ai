"use client";

import { useI18n } from "@/components/i18n-provider";
import type { TranslationKey } from "@/lib/i18n";

const sourceGroups: Array<{
  titleKey: TranslationKey;
  textKey: TranslationKey;
  itemKeys: TranslationKey[];
}> = [
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

export function SourceDirectory() {
  const { t } = useI18n();

  return (
    <section
      className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28"
      id="approved-sources"
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:gap-16">
        <div>
          <p className="text-xs font-bold text-[var(--color-green)]">{t("policy.sources.eyebrow")}</p>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-[var(--color-ink)]">{t("policy.sources.title")}</h2>
          <p className="mt-5 text-sm font-medium leading-7 text-[var(--color-muted)]">{t("policy.sources.text")}</p>
        </div>

        <div className="border-y border-[var(--color-border)] lg:grid lg:grid-cols-3 lg:border-y-0 lg:border-s lg:ps-12">
          {sourceGroups.map((group, index) => (
            <article
              className={`animate-rise py-8 lg:py-0 ${
                index > 0 ? "border-t border-[var(--color-border)] lg:border-t-0 lg:border-s lg:ps-8" : ""
              } ${index < sourceGroups.length - 1 ? "lg:pe-8" : ""}`}
              key={group.titleKey}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--color-gold)]" />
                <h3 className="text-lg font-bold text-[var(--color-green)]">{t(group.titleKey)}</h3>
              </div>
              <p className="mt-3 text-sm font-medium leading-7 text-[var(--color-muted)]">{t(group.textKey)}</p>
              <ul className="mt-5 border-t border-[var(--color-border)]">
                {group.itemKeys.map((itemKey) => (
                  <li
                    className="border-b border-[var(--color-border)] py-2.5 text-sm font-semibold text-[var(--color-ink)]"
                    key={itemKey}
                  >
                    {t(itemKey)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
