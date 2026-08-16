import type { RetrievalLanguage, RetrievalWarning, SourceRecord } from "@/lib/retrieval/types";

export type CheckType = "ayah" | "hadith";

export type CheckOutcome = "exact" | "similar" | "not_found";

export type CheckAnswer = {
  status: "ready" | "fallback";
  text: string;
  citations: string[];
  warnings: RetrievalWarning[];
};

export type CheckResponse = {
  status: "ok" | "error";
  checkType: CheckType;
  language: RetrievalLanguage;
  checkedText: string;
  outcome: CheckOutcome | null;
  records: SourceRecord[];
  answer: CheckAnswer | null;
  warnings: RetrievalWarning[];
  provenanceNotes: string[];
};

export function isCheckType(value: unknown): value is CheckType {
  return value === "ayah" || value === "hadith";
}
