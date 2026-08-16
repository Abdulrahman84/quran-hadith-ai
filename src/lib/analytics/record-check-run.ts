import type { CheckResponse, CheckType } from "@/lib/check/types";
import type { RetrievalLanguage } from "@/lib/retrieval/types";

import { recordActivityRun } from "./record-activity-run";

type RecordCheckRunInput = {
  text: string;
  checkType: CheckType;
  language: RetrievalLanguage;
  response: CheckResponse;
  durationMs: number;
};

function getRunStatus(response: CheckResponse) {
  if (response.status === "error") return "failed" as const;
  return response.warnings.length === 0 ? "completed" as const : "needs_review" as const;
}

export async function recordCheckRun(input: RecordCheckRunInput) {
  const records = input.response.records;
  const quranCount = records.filter((record) => record.sourceKind === "quran").length;
  const hadithCount = records.filter((record) => record.sourceKind === "hadith").length;

  await recordActivityRun({
    runId: crypto.randomUUID(),
    question: input.text,
    language: input.language,
    runKind: "check",
    checkType: input.checkType,
    ...(input.response.outcome ? { checkOutcome: input.response.outcome } : {}),
    status: getRunStatus(input.response),
    answerText: input.response.answer?.text ?? null,
    citationCount: input.response.answer?.citations.length ?? 0,
    quranCount,
    tafsirCount: 0,
    hadithCount,
    warningCount: input.response.warnings.length,
    durationMs: input.durationMs,
  });
}
