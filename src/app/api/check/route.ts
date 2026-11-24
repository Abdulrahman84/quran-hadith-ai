import { executeCheck } from "@/lib/check/service";
import { recordCheckRun } from "@/lib/analytics/record-check-run";
import { isVagueCheckPrompt } from "@/lib/check/input-validation";
import { isCheckType, type CheckResponse, type CheckType } from "@/lib/check/types";
import {
  isHadithCollectionSelection,
  type HadithCollectionSelection,
} from "@/lib/retrieval/hadith-collections";
import { getClientIp } from "@/lib/server/client-ip";
import { consumeClientQuota, consumeGlobalDailyQuota, rateLimitMessage } from "@/lib/server/rate-limit";
import { responseCacheKey, sharedResponseCache } from "@/lib/server/response-cache";

export const runtime = "nodejs";

type CheckRequestBody = {
  text?: unknown;
  checkType?: unknown;
  language?: unknown;
  hadithCollection?: unknown;
};

function errorResponse(
  message: string,
  code: string,
  status: number,
  checkType: CheckType = "ayah",
  language: "arabic" | "english" = "arabic",
  headers?: HeadersInit,
): Response {
  const payload: CheckResponse = {
    status: "error",
    checkType,
    language,
    checkedText: "",
    outcome: null,
    records: [],
    answer: null,
    warnings: [{ code, message }],
    provenanceNotes: [],
  };

  return Response.json(payload, { status, headers });
}

const checkCache = sharedResponseCache<CheckResponse>("check");

function isCacheableCheckResponse(response: CheckResponse) {
  return response.status === "ok" && response.answer?.status === "ready";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const clientQuota = consumeClientQuota(getClientIp(request));

  if (!clientQuota.allowed) {
    return errorResponse(rateLimitMessage(clientQuota), "rate_limited", 429, undefined, undefined, {
      "Retry-After": String(clientQuota.retryAfterSeconds),
    });
  }

  let body: CheckRequestBody;

  try {
    body = (await request.json()) as CheckRequestBody;
  } catch {
    return errorResponse("Request body must be valid JSON.", "invalid_json", 400);
  }

  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  const language = body.language === "english" ? "english" : "arabic";

  if (!isCheckType(body.checkType)) {
    return errorResponse("Choose Ayah or Hadith before checking.", "invalid_check_type", 400);
  }

  if (text.length < 8) {
    return errorResponse("Enter at least 8 characters to check.", "check_text_too_short", 400, body.checkType, language);
  }

  if (text.length > 2000) {
    return errorResponse("Check text must be 2,000 characters or fewer.", "check_text_too_long", 400, body.checkType, language);
  }

  if (isVagueCheckPrompt(text)) {
    const message = language === "arabic"
      ? "ألصق نص العبارة نفسها بدلا من سؤال عام مثل: من قال هذا؟"
      : "Paste the wording itself instead of a general question such as ‘Who said this?’";

    return errorResponse(message, "check_text_too_ambiguous", 400, body.checkType, language);
  }

  const hadithCollection: HadithCollectionSelection = isHadithCollectionSelection(body.hadithCollection)
    ? body.hadithCollection
    : "all";
  const cacheKey = responseCacheKey({ text, checkType: body.checkType, language, hadithCollection });
  const cached = checkCache.get(cacheKey);

  if (cached) {
    await recordCheckRun({
      text,
      checkType: body.checkType,
      language,
      response: cached,
      durationMs: Date.now() - startedAt,
    });

    return Response.json(cached, { headers: { "X-Search-Cache": "hit" } });
  }

  const globalQuota = consumeGlobalDailyQuota();

  if (!globalQuota.allowed) {
    return errorResponse(rateLimitMessage(globalQuota), "rate_limited", 429, body.checkType, language, {
      "Retry-After": String(globalQuota.retryAfterSeconds),
    });
  }

  const result = await executeCheck({
    text,
    checkType: body.checkType,
    language,
    hadithCollection,
  });

  if (isCacheableCheckResponse(result)) {
    checkCache.set(cacheKey, result);
  }

  await recordCheckRun({
    text,
    checkType: body.checkType,
    language,
    response: result,
    durationMs: Date.now() - startedAt,
  });

  return Response.json(result, { status: result.status === "error" ? 502 : 200 });
}
