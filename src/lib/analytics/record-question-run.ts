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

function getConvexSiteUrl() {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicitSiteUrl) return new URL(explicitSiteUrl).origin;

  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!deploymentUrl) return null;

  const url = new URL(deploymentUrl);
  if (!url.hostname.endsWith(".convex.cloud")) return null;

  url.hostname = `${url.hostname.slice(0, -".convex.cloud".length)}.convex.site`;
  return url.origin;
}

export async function recordQuestionRun(input: RecordQuestionRunInput) {
  const ingestSecret = process.env.DASHBOARD_INGEST_SECRET;
  let siteUrl: string | null = null;

  try {
    siteUrl = getConvexSiteUrl();
  } catch (error) {
    console.error("[analytics] Invalid Convex URL configuration.", error);
  }

  if (!siteUrl || !ingestSecret) {
    console.error("[analytics] Question tracking is not configured.");
    return;
  }

  const counts = input.response.records.reduce(
    (total, record) => ({
      ...total,
      [record.sourceKind]: total[record.sourceKind] + 1,
    }),
    { quran: 0, tafsir: 0, hadith: 0 },
  );

  try {
    const response = await fetch(`${siteUrl}/analytics/record`, {
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
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      const responseBody = (await response.text()).slice(0, 200);
      console.error(`[analytics] Question tracking failed with ${response.status}: ${responseBody}`);
    }
  } catch (error) {
    // Analytics must never make source retrieval fail.
    console.error("[analytics] Question tracking request failed.", error);
  }
}
