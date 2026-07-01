export type RetrievalStatus = "ok" | "empty" | "error";

export type RetrievalLanguage = "arabic" | "english";

export type SourceKind = "quran" | "tafsir" | "hadith";

export type SourceMode = "quran-tafsir-hadith" | "quran-tafsir-only" | "hadith-only";

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
  reference: string;
  book: string | null;
  chapter: string | null;
  hadithNumber: string | null;
  surahNumber: number | null;
  surahName: string | null;
  ayahNumber: number | null;
  verseKey: string | null;
  translationEdition: string | null;
  tafsirSource: string | null;
  arabicText: string;
  englishText: string | null;
  tafsirText: string | null;
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

export type GroundedAnswerStatus = "ready" | "disabled" | "insufficient_sources" | "error";

export type GroundedAnswer = {
  status: GroundedAnswerStatus;
  text: string | null;
  citations: string[];
  warnings: RetrievalWarning[];
};

export type RetrievalResponse = {
  status: RetrievalStatus;
  query: string;
  retrievalQuery: string;
  sourceMode: SourceMode;
  records: SourceRecord[];
  answer?: GroundedAnswer;
  warnings: RetrievalWarning[];
  provenanceNotes: string[];
};
