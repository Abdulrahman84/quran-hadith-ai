import { isVagueCheckPrompt } from "./input-validation";
import type { CheckOutcome, CheckType } from "./types";
import { checkTokens, normalizeCheckText } from "./text-normalization";
import type { SourceRecord } from "@/lib/retrieval/types";

export type ScoredCheckRecord = {
  record: SourceRecord;
  score: number;
};

const SIMILARITY_THRESHOLD = 0.42;

function sourceTexts(record: SourceRecord, checkType: CheckType) {
  if (checkType === "ayah" && record.sourceKind !== "quran") {
    return [];
  }

  if (checkType === "hadith" && record.sourceKind !== "hadith") {
    return [];
  }

  return [record.arabicText, record.englishText].filter((text): text is string => Boolean(text));
}

function containsLiteral(candidate: string, source: string) {
  if (isVagueCheckPrompt(candidate)) {
    return false;
  }

  const normalizedCandidate = normalizeCheckText(candidate);
  const normalizedSource = normalizeCheckText(source);
  const candidateTokens = checkTokens(candidate);
  const hasEnoughContext = candidateTokens.length >= 3 || normalizedCandidate.length >= 16;

  return hasEnoughContext && ` ${normalizedSource} `.includes(` ${normalizedCandidate} `);
}

function tokenContainment(candidate: string, source: string) {
  const candidateTokens = [...new Set(checkTokens(candidate))];
  const sourceTokens = new Set(checkTokens(source));

  if (candidateTokens.length < 3) {
    return 0;
  }

  const matches = candidateTokens.filter((token) => sourceTokens.has(token)).length;
  return matches / candidateTokens.length;
}

function scoreRecord(candidate: string, record: SourceRecord, checkType: CheckType) {
  return sourceTexts(record, checkType).reduce(
    (best, text) => ({
      exact: best.exact || containsLiteral(candidate, text),
      score: Math.max(best.score, tokenContainment(candidate, text)),
    }),
    { exact: false, score: 0 },
  );
}

export function classifyCheckRecords(
  candidate: string,
  checkType: CheckType,
  records: SourceRecord[],
  semanticRecordIds: ReadonlySet<string> = new Set(),
): { outcome: CheckOutcome; accepted: ScoredCheckRecord[] } {
  const scored = records
    .map((record) => ({ record, ...scoreRecord(candidate, record, checkType) }))
    .filter(({ record }) => sourceTexts(record, checkType).length > 0)
    .sort((left, right) => right.score - left.score);
  const exact = scored.filter(({ exact: isExact }) => isExact);

  if (exact.length > 0) {
    return { outcome: "exact", accepted: exact.slice(0, 5) };
  }

  const similar = scored.filter(({ record, score }) => score >= SIMILARITY_THRESHOLD || semanticRecordIds.has(record.id));

  if (similar.length > 0) {
    return { outcome: "similar", accepted: similar.slice(0, 5) };
  }

  return { outcome: "not_found", accepted: [] };
}
