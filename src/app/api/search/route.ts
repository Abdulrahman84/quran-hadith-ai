import { generateGroundedAnswer } from "@/lib/llm/ollama";
import { searchHadithSources } from "@/lib/retrieval/hadith-mcp";
import type { GroundedAnswer, RetrievalResponse } from "@/lib/retrieval/types";

export const runtime = "nodejs";

type SearchRequestBody = {
  language?: unknown;
  question?: unknown;
};

function noAnswer(status: GroundedAnswer["status"], code: string, message: string): GroundedAnswer {
  return {
    status,
    text: null,
    citations: [],
    warnings: [{ code, message }],
  };
}

export async function POST(request: Request) {
  let body: SearchRequestBody;

  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return Response.json(
      {
        status: "error",
        query: "",
        retrievalQuery: "",
        sourceMode: "hadith-only",
        records: [],
        answer: noAnswer("insufficient_sources", "invalid_json", "Request body must be valid JSON."),
        warnings: [{ code: "invalid_json", message: "Request body must be valid JSON." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const language = body.language === "arabic" || body.language === "english" ? body.language : "arabic";

  if (question.length === 0) {
    return Response.json(
      {
        status: "error",
        query: "",
        retrievalQuery: "",
        sourceMode: "hadith-only",
        records: [],
        answer: noAnswer("insufficient_sources", "empty_question", "Enter a question before searching."),
        warnings: [{ code: "empty_question", message: "Enter a question before searching." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const response = await searchHadithSources(question, language);
  const answer = await generateGroundedAnswer({
    question,
    language,
    records: response.records,
  });

  return Response.json({ ...response, answer } satisfies RetrievalResponse, {
    status: response.status === "error" ? 502 : 200,
  });
}
