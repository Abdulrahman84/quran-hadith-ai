import type { RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

export function arabicRecordTitle(record: SourceRecord) {
  if (record.sourceKind === "quran") {
    return `القرآن - ${arabicReferenceSuffix(record)}`;
  }

  if (record.sourceKind === "tafsir") {
    return `${arabicTafsirSourceName(record)} - ${arabicReferenceSuffix(record)}`;
  }

  return `${arabicHadithCollectionName(record)} ${record.reference}`.trim();
}

export const arabicTafsirSourceLabels = new Map<string, string>([
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

export function arabicTafsirSourceName(record: SourceRecord) {
  const collectionLabel = arabicTafsirSourceLabels.get(record.collection.toLowerCase());

  if (collectionLabel) {
    return collectionLabel;
  }

  if (record.tafsirSource && !/[A-Za-z]/.test(record.tafsirSource)) {
    return record.tafsirSource.split(/[،,]/)[0]?.trim() || "التفسير";
  }

  return "التفسير";
}

export function arabicReferenceSuffix(record: SourceRecord) {
  return record.surahName ? `سورة ${record.surahName} ${record.reference}` : record.reference;
}

export function arabicHadithCollectionName(record: SourceRecord) {
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

export function arabicRecordMetadata(record: SourceRecord) {
  if (record.sourceKind === "hadith") {
    return [
      arabicRecordTitle(record),
      record.book ? `الكتاب: ${record.book}` : null,
      record.chapter ? `الباب: ${record.chapter}` : null,
      record.grade?.value ? `الدرجة: ${record.grade.value}` : "الدرجة: غير متاحة",
      `المصدر: ${record.sourceReference}`,
    ];
  }

  return [
    arabicRecordTitle(record),
    record.sourceKind === "tafsir" ? "النوع: تفسير" : "النوع: قرآن",
  ];
}

export function citationLabels(records: SourceRecord[], language: RetrievalLanguage) {
  return records.map((record, index) => {
    const title = language === "arabic" ? arabicRecordTitle(record) : `${record.displayName} ${record.reference}`.trim();

    return `[${index + 1}] ${title}`;
  });
}

export function citationLabelsForText(records: SourceRecord[], language: RetrievalLanguage, text: string) {
  const allLabels = citationLabels(records, language);
  const usedIndexes = [...text.matchAll(/\[(\d+)\]/g)]
    .map((match) => Number.parseInt(match[1] || "", 10))
    .filter((index) => Number.isInteger(index) && index >= 1 && index <= records.length);
  const uniqueUsedIndexes = [...new Set(usedIndexes)];

  return uniqueUsedIndexes.map((index) => allLabels[index - 1]).filter((label): label is string => Boolean(label));
}
