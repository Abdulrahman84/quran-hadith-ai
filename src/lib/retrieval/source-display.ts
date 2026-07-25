import type { Language } from "@/lib/i18n";
import type { SourceRecord } from "./types";

const arabicGradeLabels = new Map<string, string>([
  ["sahih", "صحيح"],
  ["sahih li ghairihi", "صحيح لغيره"],
  ["hasan", "حسن"],
  ["hasan sahih", "حسن صحيح"],
  ["hasan li ghairihi", "حسن لغيره"],
  ["daif", "ضعيف"],
  ["daeef", "ضعيف"],
  ["da'if", "ضعيف"],
  ["mawdu", "موضوع"],
  ["mawdoo", "موضوع"],
  ["mawdu'", "موضوع"],
  ["gharib", "غريب"],
]);

const arabicGradeSourceLabels: Array<[RegExp, string]> = [
  [/\bdarussalam\b/i, "دار السلام"],
  [/\bal[-\s]?albani\b|\balbani\b/i, "الألباني"],
  [/\bshu['’]?aib al[-\s]?arna['’]?ut\b|\bal[-\s]?arna['’]?ut\b/i, "شعيب الأرناؤوط"],
  [/\babu (?:eisa|isa)\b|\btirmidhi\b/i, "أبو عيسى الترمذي"],
];

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

  if (collection.includes("abudawud") || collection.includes("abu-dawud") || collection.includes("abu_dawud") || displayName.includes("abu dawud")) {
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

  const normalized = normalizeGrade(value);
  const exactLabel = arabicGradeLabels.get(normalized);

  if (exactLabel) {
    return exactLabel;
  }

  if (normalized.includes("hasan sahih")) {
    return "حسن صحيح";
  }

  if (normalized.includes("sahih")) {
    return "صحيح";
  }

  if (normalized.includes("hasan")) {
    return "حسن";
  }

  if (!/[A-Za-z]/.test(value)) {
    return value;
  }

  return "درجة أخرى";
}

export function formatHadithGradeSource(value: string, language: Language) {
  if (language !== "ar") {
    return value;
  }

  const localizedSource = arabicGradeSourceLabels.find(([pattern]) => pattern.test(value));

  if (localizedSource) {
    return localizedSource[1];
  }

  return /[A-Za-z]/.test(value) ? "الجهة المذكورة في سجل المصدر" : value;
}

export function formatHadithGradeReference(value: string, language: Language) {
  if (language !== "ar") {
    return value;
  }

  if (/grade field/i.test(value) && /hadith[_\s-]?datasets|meeatif/i.test(value)) {
    return "حقل الدرجة في مجموعة بيانات الحديث";
  }

  return /[A-Za-z]/.test(value) ? "مرجع الدرجة في سجل المصدر" : value;
}

export function formatSourceDetailLabel(
  value: string,
  sourceKind: SourceRecord["sourceKind"],
  language: Language,
) {
  if (language !== "ar" || !/[A-Za-z]/.test(value)) {
    return value;
  }

  if (sourceKind === "quran") {
    return "مصدر القرآن";
  }

  if (sourceKind === "tafsir") {
    return "مصدر التفسير";
  }

  return "مصدر الحديث";
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
