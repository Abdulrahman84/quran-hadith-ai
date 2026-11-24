import type { QuotationMatch, RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

export type GenerateGroundedAnswerInput = {
  question: string;
  language: RetrievalLanguage;
  records: SourceRecord[];
  quotationMatch?: QuotationMatch;
};

export type AnswerDraftEvent = { type: "delta"; text: string } | { type: "reset" };

export type CitationPackRecord = {
  record: SourceRecord;
  citationNumber: number;
};
