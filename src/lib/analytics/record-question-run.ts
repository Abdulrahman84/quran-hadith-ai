import type { RetrievalLanguage, RetrievalResponse } from "@/lib/retrieval/types";

import { recordActivityRun } from "./record-activity-run";

type RecordQuestionRunInput = {
  question: string;
  language: RetrievalLanguage;
  response: RetrievalResponse;
  durationMs: number;
};

function getRunStatus(response: RetrievalResponse) {
  if (response.status === "error") return "failed" as const;
  if (response.answer?.status === "ready") return "completed" as const;
  return "needs_review" as const;
}

export async function recordQuestionRun(input: RecordQuestionRunInput) {
  const counts = input.response.records.reduce(
    (total, record) => ({
      ...total,
      [record.sourceKind]: total[record.sourceKind] + 1,
    }),
    { quran: 0, tafsir: 0, hadith: 0 },
  );

  await recordActivityRun({
    runId: crypto.randomUUID(),
    question: input.question,
    language: input.language,
    runKind: "general",
    status: getRunStatus(input.response),
    answerText: input.response.answer?.text ?? null,
    citationCount: input.response.answer?.citations.length ?? 0,
    quranCount: counts.quran,
    tafsirCount: counts.tafsir,
    hadithCount: counts.hadith,
    warningCount: input.response.warnings.length + (input.response.answer?.warnings.length ?? 0),
    durationMs: input.durationMs,
  });
}
