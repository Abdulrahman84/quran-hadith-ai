import { answerReplacedWarningCode, generateGroundedAnswer, type GenerateGroundedAnswerOptions } from "@/lib/llm/grounded-answer";
import { recordQuestionRun } from "@/lib/analytics/record-question-run";
import {
  isHadithCollectionSelection,
  type HadithCollectionSelection,
} from "@/lib/retrieval/hadith-collections";
import { assessQuotationMatch } from "@/lib/retrieval/quotation-match";
import { searchSources } from "@/lib/retrieval/source-router";
import { getClientIp } from "@/lib/server/client-ip";
import {
  consumeClientQuota,
  consumeGlobalDailyQuota,
  rateLimitMessage,
  type RateLimitDecision,
} from "@/lib/server/rate-limit";
import { responseCacheKey, sharedResponseCache } from "@/lib/server/response-cache";
import {
  isTafsirSourceSelection,
  type TafsirSourceSelection,
} from "@/lib/retrieval/tafsir-sources";
import type { GroundedAnswer, RetrievalResponse } from "@/lib/retrieval/types";
import {
  clientAcceptsAnswerDraft,
  createAnswerDraftCoalescer,
  searchStreamMediaType,
  type SearchProgressPhase,
  type SearchStreamEvent,
} from "@/lib/search-stream";

export const runtime = "nodejs";

type SearchRequestBody = {
  language?: unknown;
  question?: unknown;
  hadithCollection?: unknown;
  tafsirSource?: unknown;
};

type ValidatedSearchRequest = {
  question: string;
  language: "arabic" | "english";
  hadithCollection: HadithCollectionSelection;
  tafsirSource: TafsirSourceSelection;
};

type ProgressReporter = (
  progress: number,
  phase: SearchProgressPhase,
  routeProgress?: { completed: number; total: number },
) => void;

function noAnswer(status: GroundedAnswer["status"], code: string, message: string): GroundedAnswer {
  return {
    status,
    text: null,
    citations: [],
    warnings: [{ code, message }],
  };
}

function errorResponse(code: string, message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    {
      status: "error",
      query: "",
      retrievalQuery: "",
      sourceMode: "quran-tafsir-hadith",
      records: [],
      answer: noAnswer("insufficient_sources", code, message),
      warnings: [{ code, message }],
      provenanceNotes: [],
    } satisfies RetrievalResponse,
    { status, headers },
  );
}

function rateLimitedResponse(decision: Extract<RateLimitDecision, { allowed: false }>) {
  return errorResponse("rate_limited", rateLimitMessage(decision), 429, {
    "Retry-After": String(decision.retryAfterSeconds),
  });
}

const searchCache = sharedResponseCache<RetrievalResponse>("search");

function searchCacheKey(input: ValidatedSearchRequest) {
  return responseCacheKey({
    text: input.question,
    language: input.language,
    hadithCollection: input.hadithCollection,
    tafsirSource: input.tafsirSource,
  });
}

function isCacheableSearchResponse(response: RetrievalResponse) {
  return response.status === "ok" && response.answer?.status === "ready";
}

const streamHeaders = {
  "Cache-Control": "no-store, no-transform",
  "Content-Type": `${searchStreamMediaType}; charset=utf-8`,
  "X-Accel-Buffering": "no",
};

function cachedStreamResponse(payload: RetrievalResponse) {
  const events: SearchStreamEvent[] = [
    { version: 1, type: "progress", progress: 94, phase: "finalizing" },
    { version: 1, type: "result", progress: 100, payload, httpStatus: 200, ok: true },
  ];
  const body = events.map((event) => JSON.stringify(event)).join("\n") + "\n";

  return new Response(body, { headers: { ...streamHeaders, "X-Search-Cache": "hit" } });
}

// The replaced-draft notice only means something to the client that saw the draft.
function withoutDraftWarnings(response: RetrievalResponse): RetrievalResponse {
  if (!response.answer) {
    return response;
  }

  return {
    ...response,
    answer: {
      ...response.answer,
      warnings: response.answer.warnings.filter((warning) => warning.code !== answerReplacedWarningCode),
    },
  };
}

async function executeSearch(
  input: ValidatedSearchRequest,
  startedAt: number,
  report?: ProgressReporter,
  draftOptions: GenerateGroundedAnswerOptions = {},
) {
  const { question, language, hadithCollection, tafsirSource } = input;

  report?.(14, "routing");
  const response = await searchSources(
    question,
    language,
    { tafsirSource, hadithCollection },
    (completed, total) => {
      const progress = total === 0 ? 22 : 22 + Math.round((completed / total) * 50);
      report?.(progress, "retrieving", { completed, total });
    },
  );
  const quotationMatch = assessQuotationMatch(question, language, response.records);

  report?.(76, "answering");
  const answer = await generateGroundedAnswer(
    {
      question,
      language,
      records: response.records,
      quotationMatch,
    },
    draftOptions,
  );

  const result = { ...response, answer, quotationMatch } satisfies RetrievalResponse;

  if (isCacheableSearchResponse(result)) {
    searchCache.set(searchCacheKey(input), withoutDraftWarnings(result));
  }

  report?.(94, "finalizing");
  await recordQuestionRun({
    question,
    language,
    response: result,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

function streamSearch(request: Request, input: ValidatedSearchRequest, startedAt: number) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const close = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };
      const send = (event: SearchStreamEvent) => {
        if (!isClosed && !request.signal.aborted) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      };
      const report: ProgressReporter = (progress, phase, routeProgress) => {
        send({
          version: 1,
          type: "progress",
          progress: Math.max(0, Math.min(99, progress)),
          phase,
          ...routeProgress,
        });
      };

      const draft = clientAcceptsAnswerDraft(request) ? createAnswerDraftCoalescer(send) : null;
      const draftOptions: GenerateGroundedAnswerOptions = draft
        ? {
            onDraft: (event) => (event.type === "delta" ? draft.delta(event.text) : draft.reset()),
            signal: request.signal,
          }
        : {};

      report(8, "starting");
      void executeSearch(input, startedAt, report, draftOptions)
        .then((payload) => {
          if (request.signal.aborted) {
            close();
            return;
          }

          draft?.flush();

          const httpStatus = payload.status === "error" ? 502 : 200;
          send({
            version: 1,
            type: "result",
            progress: 100,
            payload,
            httpStatus,
            ok: httpStatus < 400,
          });
          close();
        })
        .catch((error: unknown) => {
          draft?.reset();
          send({
            version: 1,
            type: "error",
            message: error instanceof Error ? error.message : "The source retrieval request failed.",
          });
          close();
        });
    },
  });

  return new Response(stream, {
    headers: streamHeaders,
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const clientQuota = consumeClientQuota(getClientIp(request));

  if (!clientQuota.allowed) {
    return rateLimitedResponse(clientQuota);
  }

  let body: SearchRequestBody;

  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return errorResponse("invalid_json", "Request body must be valid JSON.", 400);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const language: ValidatedSearchRequest["language"] =
    body.language === "arabic" || body.language === "english" ? body.language : "arabic";
  const hadithCollection = isHadithCollectionSelection(body.hadithCollection) ? body.hadithCollection : "all";
  const tafsirSource = isTafsirSourceSelection(body.tafsirSource) ? body.tafsirSource : "all";

  if (question.length === 0) {
    return errorResponse("empty_question", "Enter a question before searching.", 400);
  }

  const input = { question, language, hadithCollection, tafsirSource };
  const acceptsProgressStream = request.headers.get("accept")?.toLowerCase().includes(searchStreamMediaType);
  const cached = searchCache.get(searchCacheKey(input));

  if (cached) {
    await recordQuestionRun({ question, language, response: cached, durationMs: Date.now() - startedAt });

    return acceptsProgressStream
      ? cachedStreamResponse(cached)
      : Response.json(cached, { headers: { "X-Search-Cache": "hit" } });
  }

  const globalQuota = consumeGlobalDailyQuota();

  if (!globalQuota.allowed) {
    return rateLimitedResponse(globalQuota);
  }

  if (acceptsProgressStream) {
    return streamSearch(request, input, startedAt);
  }

  const response = await executeSearch(input, startedAt);
  return Response.json(response, {
    status: response.status === "error" ? 502 : 200,
  });
}
