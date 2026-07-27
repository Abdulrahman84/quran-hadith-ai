import { generateGroundedAnswer } from "@/lib/llm/grounded-answer";
import { recordQuestionRun } from "@/lib/analytics/record-question-run";
import {
  isHadithCollectionSelection,
  type HadithCollectionSelection,
} from "@/lib/retrieval/hadith-collections";
import { assessQuotationMatch } from "@/lib/retrieval/quotation-match";
import { searchSources } from "@/lib/retrieval/source-router";
import {
  isTafsirSourceSelection,
  type TafsirSourceSelection,
} from "@/lib/retrieval/tafsir-sources";
import type { GroundedAnswer, RetrievalResponse } from "@/lib/retrieval/types";
import {
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

async function executeSearch(input: ValidatedSearchRequest, startedAt: number, report?: ProgressReporter) {
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
  const answer = await generateGroundedAnswer({
    question,
    language,
    records: response.records,
    quotationMatch,
  });

  const result = { ...response, answer, quotationMatch } satisfies RetrievalResponse;
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

      report(8, "starting");
      void executeSearch(input, startedAt, report)
        .then((payload) => {
          if (request.signal.aborted) {
            close();
            return;
          }

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
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": `${searchStreamMediaType}; charset=utf-8`,
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  let body: SearchRequestBody;

  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return Response.json(
      {
        status: "error",
        query: "",
        retrievalQuery: "",
        sourceMode: "quran-tafsir-hadith",
        records: [],
        answer: noAnswer("insufficient_sources", "invalid_json", "Request body must be valid JSON."),
        warnings: [{ code: "invalid_json", message: "Request body must be valid JSON." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const language: ValidatedSearchRequest["language"] =
    body.language === "arabic" || body.language === "english" ? body.language : "arabic";
  const hadithCollection = isHadithCollectionSelection(body.hadithCollection) ? body.hadithCollection : "all";
  const tafsirSource = isTafsirSourceSelection(body.tafsirSource) ? body.tafsirSource : "all";

  if (question.length === 0) {
    return Response.json(
      {
        status: "error",
        query: "",
        retrievalQuery: "",
        sourceMode: "quran-tafsir-hadith",
        records: [],
        answer: noAnswer("insufficient_sources", "empty_question", "Enter a question before searching."),
        warnings: [{ code: "empty_question", message: "Enter a question before searching." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const input = { question, language, hadithCollection, tafsirSource };
  const acceptsProgressStream = request.headers.get("accept")?.toLowerCase().includes(searchStreamMediaType);

  if (acceptsProgressStream) {
    return streamSearch(request, input, startedAt);
  }

  const response = await executeSearch(input, startedAt);
  return Response.json(response, {
    status: response.status === "error" ? 502 : 200,
  });
}
