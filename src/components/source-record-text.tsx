import { ExpandableSourceText } from "@/components/expandable-source-text";
import type { TranslationKey } from "@/lib/i18n";
import { splitHadithTextForDisplay } from "@/lib/retrieval/source-text-presentation";
import type { SourceRecord } from "@/lib/retrieval/types";

type SourceRecordTextProps = {
  record: SourceRecord;
  language: "ar" | "en";
  t: (key: TranslationKey) => string;
};

function displayedText(record: SourceRecord, language: "ar" | "en", t: SourceRecordTextProps["t"]) {
  if (language === "en" && record.englishText) {
    return { dir: "ltr" as const, text: record.englishText };
  }

  return {
    dir: "rtl" as const,
    text: record.arabicText || t(language === "ar" ? "result.arabicUnavailable" : "result.englishUnavailable"),
  };
}

function commentaryDirection(value: string) {
  return /\p{Script=Arabic}/u.test(value) ? "rtl" as const : "ltr" as const;
}

export function SourceRecordText({ record, language, t }: SourceRecordTextProps) {
  const displayed = displayedText(record, language, t);
  const hadith = record.sourceKind === "hadith" ? splitHadithTextForDisplay(displayed.text) : null;
  const commentary = record.sourceKind === "tafsir" || record.tafsirText ? record.tafsirText : null;
  const contentKey = [record.id, language, displayed.text, commentary].filter(Boolean).join(":");

  return (
    <ExpandableSourceText
      className="text-start"
      collapsible={record.sourceKind === "quran" || record.sourceKind === "hadith"}
      dir={displayed.dir}
      showLessLabel={t("result.showLess")}
      showMoreLabel={t("result.showMore")}
      text={contentKey}
    >
      {hadith?.narration ? (
        <>
          <span className="mb-1 block text-xs font-medium leading-6 text-[var(--color-muted)]">
            <span aria-hidden="true" className="me-1 select-none font-bold text-[var(--color-gold)]">
              {t("result.narrationLabel")}:
            </span>
            {hadith.narration}
          </span>
          <span className="block text-base font-semibold leading-8 text-[var(--color-green)]">{hadith.matn}</span>
        </>
      ) : (
        <span className="block text-base font-semibold leading-8 text-[var(--color-green)]">
          {hadith?.matn || displayed.text}
        </span>
      )}
      {commentary ? (
        <span className="mt-3 block border-t border-[var(--color-border)] pt-3" dir={commentaryDirection(commentary)}>
          <span aria-hidden="true" className="mb-1 block select-none text-xs font-bold text-[var(--color-gold)]">
            {t("result.tafsirLabel")}
          </span>
          <span className="block text-sm font-medium leading-7 text-[var(--color-muted)]">{commentary}</span>
        </span>
      ) : null}
    </ExpandableSourceText>
  );
}
