import type { Language } from "@/lib/i18n";
import type { SourceRecord } from "./types";

const arabicGradeLabels = new Map<string, string>([
  ["sahih", "صحيح"],
  ["sahih li ghairihi", "صحيح لغيره"],
  ["hasan", "حسن"],
  ["hasan li ghairihi", "حسن لغيره"],
  ["daif", "ضعيف"],
  ["daeef", "ضعيف"],
  ["da'if", "ضعيف"],
  ["mawdu", "موضوع"],
  ["mawdoo", "موضوع"],
  ["mawdu'", "موضوع"],
]);

function normalizeGrade(value: string) {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const arabicTafsirSourceLabels = new Map<string, string>([
  ["tabary", "تفسير الطبري"],
  ["tabari", "تفسير الطبري"],
  ["katheer", "تفسير ابن كثير"],
  ["ibn-kathir", "تفسير ابن كثير"],
  ["baghawy", "تفسير البغوي"],
  ["baghawi", "تفسير البغوي"],
  ["saady", "تفسير السعدي"],
  ["saadi", "تفسير السعدي"],
  ["moyassar", "التفسير الميسر"],
  ["muyassar", "التفسير الميسر"],
  ["mokhtasar", "المختصر في التفسير"],
  ["mukhtasar", "المختصر في التفسير"],
]);

function arabicTafsirSourceName(record: Pick<SourceRecord, "collection" | "tafsirSource">) {
  const collectionLabel = arabicTafsirSourceLabels.get(record.collection.toLowerCase());

  if (collectionLabel) {
    return collectionLabel;
  }

  if (record.tafsirSource && !/[A-Za-z]/.test(record.tafsirSource)) {
    return record.tafsirSource.split(/[،,]/)[0]?.trim() || "التفسير";
  }

  return "التفسير";
}

function arabicReferenceSuffix(record: Pick<SourceRecord, "reference" | "surahName">) {
  return record.surahName ? `سورة ${record.surahName} ${record.reference}` : record.reference;
}

function arabicHadithCollectionName(record: Pick<SourceRecord, "collection" | "displayName">) {
  const collection = record.collection.toLowerCase();
  const displayName = record.displayName.toLowerCase();

  if (collection.includes("bukhari") || displayName.includes("bukhari")) {
    return "صحيح البخاري";
  }

  if (collection.includes("muslim") || displayName.includes("muslim")) {
    return "صحيح مسلم";
  }

  if (collection.includes("abudawud") || collection.includes("abu-dawud") || displayName.includes("abu dawud")) {
    return "سنن أبي داود";
  }

  if (collection.includes("tirmidhi") || displayName.includes("tirmidhi")) {
    return "جامع الترمذي";
  }

  if (collection.includes("nasai") || collection.includes("nasa") || displayName.includes("nasa")) {
    return "سنن النسائي";
  }

  if (collection.includes("majah") || displayName.includes("majah")) {
    return "سنن ابن ماجه";
  }

  return "كتاب الحديث";
}

export function formatHadithGrade(value: string, language: Language) {
  if (language !== "ar") {
    return value;
  }

  return arabicGradeLabels.get(normalizeGrade(value)) || value;
}

export function formatSourceRecordTitle(
  record: Pick<SourceRecord, "collection" | "sourceKind" | "displayName" | "reference" | "surahName" | "tafsirSource">,
  language: Language,
) {
  if (language !== "ar") {
    return record.sourceKind === "hadith" ? `${record.displayName} ${record.reference}`.trim() : record.displayName;
  }

  if (record.sourceKind === "quran") {
    return `القرآن - ${arabicReferenceSuffix(record)}`;
  }

  if (record.sourceKind === "tafsir") {
    return `${arabicTafsirSourceName(record)} - ${arabicReferenceSuffix(record)}`;
  }

  return `${arabicHadithCollectionName(record)} ${record.reference}`.trim();
}
