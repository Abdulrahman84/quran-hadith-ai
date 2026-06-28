import { searchHadithSources } from "@/lib/retrieval/hadith-mcp";
import type { RetrievalResponse } from "@/lib/retrieval/types";

export const runtime = "nodejs";

type SearchRequestBody = {
  question?: unknown;
};

export async function POST(request: Request) {
  let body: SearchRequestBody;

  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return Response.json(
      {
        status: "error",
        query: "",
        sourceMode: "hadith-only",
        records: [],
        warnings: [{ code: "invalid_json", message: "Request body must be valid JSON." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (question.length === 0) {
    return Response.json(
      {
        status: "error",
        query: "",
        sourceMode: "hadith-only",
        records: [],
        warnings: [{ code: "empty_question", message: "Enter a question before searching." }],
        provenanceNotes: [],
      } satisfies RetrievalResponse,
      { status: 400 },
    );
  }

  const response = await searchHadithSources(question);
  return Response.json(response, { status: response.status === "error" ? 502 : 200 });
}
