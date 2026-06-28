export type RetrievalStatus = "ok" | "empty" | "error";

export type SourceKind = "hadith";

export type SourceGrade = {
  value: string;
  source: string;
  sourceReference: string;
  provenanceNotes: string[];
};

export type SourceRecord = {
  id: string;
  sourceKind: SourceKind;
  collection: string;
  displayName: string;
  book: string | null;
  chapter: string | null;
  hadithNumber: string;
  arabicText: string;
  englishText: string | null;
  grade: SourceGrade | null;
  sourceDataset: string;
  sourceReference: string;
  provenanceNotes: string[];
  snippet: string | null;
  rank: number | null;
};

export type RetrievalWarning = {
  code: string;
  message: string;
};

export type RetrievalResponse = {
  status: RetrievalStatus;
  query: string;
  sourceMode: "hadith-only";
  records: SourceRecord[];
  warnings: RetrievalWarning[];
  provenanceNotes: string[];
};
