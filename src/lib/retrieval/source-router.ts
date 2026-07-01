import { searchHadithSources } from "./hadith-mcp";
import { planSourceRoutes, type SourceRoute } from "./source-intent";
import { searchTafsirSources } from "./tafsir-mcp";
import type { TafsirSourceSelection } from "./tafsir-sources";
import type { RetrievalLanguage, RetrievalResponse, RetrievalStatus, SourceMode } from "./types";

function sourceModeForRoutes(routes: SourceRoute[]): SourceMode {
  if (routes.length === 1 && routes[0] === "hadith") {
    return "hadith-only";
  }

  if (routes.length === 1 && routes[0] === "tafsir") {
    return "quran-tafsir-only";
  }

  return "quran-tafsir-hadith";
}

function combinedStatus(responses: RetrievalResponse[]): RetrievalStatus {
  if (responses.some((response) => response.records.length > 0)) {
    return "ok";
  }

  if (responses.some((response) => response.status === "error")) {
    return "error";
  }

  return "empty";
}

export async function searchSources(
  query: string,
  language: RetrievalLanguage,
  options: { tafsirSource?: TafsirSourceSelection } = {},
): Promise<RetrievalResponse> {
  const routes = planSourceRoutes(query);
  const responses = await Promise.all(
    routes.map((route) =>
      route === "tafsir" ? searchTafsirSources(query, language, { tafsirSource: options.tafsirSource }) : searchHadithSources(query, language),
    ),
  );
  const records = responses
    .flatMap((response) => response.records)
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER));

  return {
    status: combinedStatus(responses),
    query,
    retrievalQuery: responses.map((response) => response.retrievalQuery).filter(Boolean).join(" | ") || query,
    sourceMode: sourceModeForRoutes(routes),
    records,
    warnings: responses.flatMap((response) => response.warnings),
    provenanceNotes: responses.flatMap((response) => response.provenanceNotes),
  };
}
