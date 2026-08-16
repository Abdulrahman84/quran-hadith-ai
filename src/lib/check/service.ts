import type { HadithCollectionSelection } from "@/lib/retrieval/hadith-collections";
import { searchHadithSources } from "@/lib/retrieval/hadith-mcp";
import { searchTafsirSources } from "@/lib/retrieval/tafsir-mcp";
import type { RetrievalLanguage, RetrievalResponse, SourceRecord } from "@/lib/retrieval/types";

import { generateCheckAnswer } from "./answer";
import { classifyCheckRecords } from "./matcher";
import { planCheckQueries } from "./query-planner";
import { judgeSimilarRecords } from "./semantic-judge";
import type { CheckResponse, CheckType } from "./types";

type CheckInput = {
  text: string;
  checkType: CheckType;
  language: RetrievalLanguage;
  hadithCollection: HadithCollectionSelection;
};

function searchQuery(input: CheckInput, query: string) {
  if (input.checkType === "ayah") {
    return searchTafsirSources(query, input.language, { tafsirSource: "all" });
  }

  return searchHadithSources(query, input.language, { collection: input.hadithCollection });
}

function recordKey(record: SourceRecord) {
  return `${record.sourceKind}:${record.sourceReference}`;
}

function allowedRecords(input: CheckInput, responses: RetrievalResponse[]) {
  const expectedKind = input.checkType === "ayah" ? "quran" : "hadith";
  const records = new Map<string, SourceRecord>();
  const tafsirByVerse = new Map(
    responses
      .flatMap((response) => response.records)
      .filter((record) => record.sourceKind === "tafsir" && record.verseKey && record.tafsirText)
      .map((record) => [record.verseKey as string, record] as const),
  );

  responses.flatMap((response) => response.records).forEach((record) => {
    if (record.sourceKind === expectedKind && !records.has(recordKey(record))) {
      const tafsir = record.verseKey ? tafsirByVerse.get(record.verseKey) : null;
      records.set(
        recordKey(record),
        tafsir ? { ...record, tafsirText: tafsir.tafsirText, tafsirSource: tafsir.tafsirSource } : record,
      );
    }
  });

  return [...records.values()].slice(0, 12);
}

export async function executeCheck(input: CheckInput): Promise<CheckResponse> {
  const literalSearch = searchQuery(input, input.text);
  const [plan, literalResponse] = await Promise.all([
    planCheckQueries(input.text, input.checkType, input.language),
    literalSearch,
  ]);
  const remainingQueries = plan.queries.filter((query) => query !== input.text).slice(0, 2);
  const semanticResponses: RetrievalResponse[] = [];

  for (const query of remainingQueries) {
    semanticResponses.push(await searchQuery(input, query));
  }

  const responses = [literalResponse, ...semanticResponses];
  const records = allowedRecords(input, responses);
  const retrievalErrors = responses.filter((response) => response.status === "error");
  const literalClassification = classifyCheckRecords(input.text, input.checkType, records);
  let semanticWarning: string | null = null;
  let classification = literalClassification;

  if (literalClassification.outcome !== "exact" && records.length > 0) {
    const semantic = await judgeSimilarRecords(input.text, input.checkType, input.language, records);
    semanticWarning = semantic.warning;
    classification = classifyCheckRecords(input.text, input.checkType, records, semantic.recordIds);
  }

  if (classification.outcome === "not_found" && retrievalErrors.length === responses.length) {
    return {
      status: "error",
      checkType: input.checkType,
      language: input.language,
      checkedText: input.text,
      outcome: null,
      records: [],
      answer: null,
      warnings: retrievalErrors.flatMap((response) => response.warnings),
      provenanceNotes: responses.flatMap((response) => response.provenanceNotes),
    };
  }

  const acceptedRecords = classification.accepted.map(({ record }) => record);
  const answer = await generateCheckAnswer(
    input.text,
    input.checkType,
    classification.outcome,
    input.language,
    acceptedRecords,
  );
  const warnings = [
    ...(plan.warning ? [{ code: "check_query_planner_fallback", message: plan.warning }] : []),
    ...(semanticWarning ? [{ code: "check_semantic_judge_fallback", message: semanticWarning }] : []),
    ...retrievalErrors.flatMap((response) => response.warnings),
    ...answer.warnings,
  ];

  return {
    status: "ok",
    checkType: input.checkType,
    language: input.language,
    checkedText: input.text,
    outcome: classification.outcome,
    records: acceptedRecords,
    answer,
    warnings,
    provenanceNotes: [
      `Check query planner: ${plan.planner}.`,
      `Check queries: ${plan.queries.join(" | ")}.`,
      ...responses.flatMap((response) => response.provenanceNotes),
    ],
  };
}
