"use client";

import { useI18n } from "@/components/i18n-provider";
import { InfoHero } from "@/components/info/info-hero";
import { InfoLinks } from "@/components/info/info-links";
import { LtrTerms } from "@/components/info/ltr-terms";
import { SourceBookShelf, type SourceBook } from "@/components/info/source-books";
import { hadithCollections } from "@/lib/retrieval/hadith-collections";
import { tafsirSources } from "@/lib/retrieval/tafsir-sources";

type HadithCollectionId = (typeof hadithCollections)[number]["id"];
type TafsirSourceId = (typeof tafsirSources)[number]["id"];

// Rows per collection in the Hadith MCP build, from the meeAtif import report
// (hadith-mcp: data/generated/hadith-meeatif-import-report.md). Total 33,736.
// Grades exist for most rows of the four Sunan and none of the two Sahihs
// (meeatif-hadith-datasets-audit.md).
const hadithBooks: Record<HadithCollectionId, { count: number; compilerAr: string; compilerEn: string }> = {
  bukhari: { count: 7277, compilerAr: "الإمام البخاري", compilerEn: "Imam al-Bukhari" },
  muslim: { count: 7368, compilerAr: "الإمام مسلم", compilerEn: "Imam Muslim" },
  abu_dawud: { count: 5276, compilerAr: "أبو داود", compilerEn: "Abu Dawud" },
  tirmidhi: { count: 4053, compilerAr: "الترمذي", compilerEn: "al-Tirmidhi" },
  nasai: { count: 5683, compilerAr: "النسائي", compilerEn: "al-Nasa'i" },
  ibn_majah: { count: 4079, compilerAr: "ابن ماجه", compilerEn: "Ibn Majah" },
};

const sahihIds: HadithCollectionId[] = ["bukhari", "muslim"];
const sunanIds: HadithCollectionId[] = ["abu_dawud", "tirmidhi", "nasai", "ibn_majah"];
const largestCollection = Math.max(...Object.values(hadithBooks).map((book) => book.count));

// Authors as tafsir-mcp 1.0.0 attributes them (tafsir/models.py
// TAFSIR_ATTRIBUTIONS). The package names no author for the Mukhtasar, so none
// is shown.
const tafsirAuthors: Partial<Record<TafsirSourceId, { ar: string; en: string; diedAh?: number }>> = {
  tabary: { ar: "أبو جعفر الطبري", en: "Abu Ja'far al-Tabari", diedAh: 310 },
  katheer: { ar: "أبو الفداء إسماعيل بن كثير", en: "Abu al-Fida Isma'il ibn Kathir", diedAh: 774 },
  baghawy: { ar: "الحسين بن مسعود البغوي", en: "al-Husayn ibn Mas'ud al-Baghawi", diedAh: 510 },
  saadi: { ar: "عبد الرحمن بن ناصر السعدي", en: "Abd al-Rahman ibn Nasir al-Sa'di", diedAh: 1376 },
  moyassar: { ar: "مجمع الملك فهد لطباعة المصحف الشريف", en: "King Fahd Complex for the Printing of the Holy Quran" },
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
  const isArabic = language === "ar";
  const number = new Intl.NumberFormat("en-US");

  function hadithShelf(ids: HadithCollectionId[], badge?: string): SourceBook[] {
    return ids.map((id) => {
      const collection = hadithCollections.find((item) => item.id === id);
      const book = hadithBooks[id];

      return {
        id,
        title: (isArabic ? collection?.labelAr : collection?.labelEn) ?? id,
        author: isArabic ? book.compilerAr : book.compilerEn,
        count: t("policy.hadith.count").replace("{count}", number.format(book.count)),
        share: book.count / largestCollection,
        badge,
      };
    });
  }

  const tafsirShelf: SourceBook[] = tafsirSources.map((source) => {
    const author = tafsirAuthors[source.id];

    return {
      id: source.id,
      title: isArabic ? source.labelAr : source.labelEn,
      author: author ? (isArabic ? author.ar : author.en) : undefined,
      note: author?.diedAh ? t("policy.tafsir.died").replace("{year}", String(author.diedAh)) : undefined,
    };
  });

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

            <h3 className="book-group-title">{t("policy.hadith.sahihain")}</h3>
            <SourceBookShelf books={hadithShelf(sahihIds)} label={t("policy.hadith.sahihain")} tone="green" />

            <h3 className="book-group-title">{t("policy.hadith.sunan")}</h3>
            <SourceBookShelf
              books={hadithShelf(sunanIds, t("policy.hadith.gradedBadge"))}
              label={t("policy.hadith.sunan")}
              tone="gold"
            />
            <p className="book-group-note">{t("policy.hadith.gradedNote")}</p>

            <CreditLine href={hadithDatasetUrl} linkLabel={t("policy.creditLink")} text={t("policy.hadith.credit")} />
          </div>
        </li>

        <li className="info-step">
          <span aria-hidden="true" className="step-numeral">
            02
          </span>
          <div>
            <h2 className="info-step-title">{t("policy.quran.title")}</h2>

            <div className="quran-feature">
              <span aria-hidden="true" className="book-spine" />
              <span className="quran-feature-body">
                <span className="quran-feature-title">{t("policy.quran.featureTitle")}</span>
                <span className="quran-feature-text">{t("policy.quran.featureText")}</span>
              </span>
            </div>

            <p className="info-step-text">{t("policy.tafsir.lede")}</p>
            <SourceBookShelf books={tafsirShelf} label={t("policy.tafsir.lede")} size="small" tone="paper" />

            <CreditLine href={tafsirCenterUrl} linkLabel={t("policy.creditLink")} text={t("policy.quran.credit")} />
          </div>
        </li>
      </ol>
      <InfoLinks />
    </main>
  );
}
