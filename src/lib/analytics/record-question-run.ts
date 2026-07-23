import type { RetrievalLanguage, RetrievalResponse } from "@/lib/retrieval/types";

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
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const ingestSecret = process.env.DASHBOARD_INGEST_SECRET;

  if (!siteUrl || !ingestSecret) return;

  const counts = input.response.records.reduce(
    (total, record) => ({
      ...total,
      [record.sourceKind]: total[record.sourceKind] + 1,
    }),
    { quran: 0, tafsir: 0, hadith: 0 },
  );

  try {
    await fetch(`${siteUrl}/analytics/record`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ingestSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        runId: crypto.randomUUID(),
        question: input.question,
        language: input.language,
        status: getRunStatus(input.response),
        answerText: input.response.answer?.text ?? null,
        citationCount: input.response.answer?.citations.length ?? 0,
        quranCount: counts.quran,
        tafsirCount: counts.tafsir,
        hadithCount: counts.hadith,
        warningCount: input.response.warnings.length + (input.response.answer?.warnings.length ?? 0),
        durationMs: input.durationMs,
      }),
      cache: "no-store",
    });
  } catch {
    // Analytics must never make source retrieval fail.
  }
}
