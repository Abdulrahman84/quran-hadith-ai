export type ActivityRunPayload = {
  runId: string;
  question: string;
  language: "arabic" | "english";
  runKind: "general" | "check";
  checkType?: "ayah" | "hadith";
  checkOutcome?: "exact" | "similar" | "not_found";
  status: "completed" | "needs_review" | "failed";
  answerText: string | null;
  citationCount: number;
  quranCount: number;
  tafsirCount: number;
  hadithCount: number;
  warningCount: number;
  durationMs: number;
};

function getAnalyticsSiteUrl() {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicitSiteUrl) return new URL(explicitSiteUrl).origin;

  const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!deploymentUrl) return null;

  const url = new URL(deploymentUrl);
  if (!url.hostname.endsWith(".convex.cloud")) return null;

  url.hostname = `${url.hostname.slice(0, -".convex.cloud".length)}.convex.site`;
  return url.origin;
}

export async function recordActivityRun(payload: ActivityRunPayload) {
  const ingestSecret = process.env.DASHBOARD_INGEST_SECRET;
  let siteUrl: string | null = null;

  try {
    siteUrl = getAnalyticsSiteUrl();
  } catch (error) {
    console.error("[analytics] Invalid analytics URL configuration.", error);
  }

  if (!siteUrl || !ingestSecret) {
    console.error("[analytics] Activity tracking is not configured.");
    return;
  }

  try {
    const response = await fetch(`${siteUrl}/analytics/record`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ingestSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      const responseBody = (await response.text()).slice(0, 200);
      console.error(`[analytics] Activity tracking failed with ${response.status}: ${responseBody}`);
    }
  } catch (error) {
    // Analytics must never make source retrieval fail.
    console.error("[analytics] Activity tracking request failed.", error);
  }
}
