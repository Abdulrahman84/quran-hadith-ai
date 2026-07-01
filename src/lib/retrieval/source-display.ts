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

export function formatHadithGrade(value: string, language: Language) {
  if (language !== "ar") {
    return value;
  }

  return arabicGradeLabels.get(normalizeGrade(value)) || value;
}

export function formatSourceRecordTitle(record: Pick<SourceRecord, "sourceKind" | "displayName" | "reference">, language: Language) {
  if (language !== "ar") {
    return record.sourceKind === "hadith" ? `${record.displayName} ${record.reference}`.trim() : record.displayName;
  }

  if (record.sourceKind === "quran") {
    return `القرآن ${record.reference}`;
  }

  if (record.sourceKind === "tafsir") {
    return `التفسير ${record.reference}`;
  }

  return `${record.displayName} ${record.reference}`.trim();
}
