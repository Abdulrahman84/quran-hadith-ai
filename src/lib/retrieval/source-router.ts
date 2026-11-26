import { searchHadithSources, startHadithQueryPlan } from "./hadith-mcp";
import { startQuestionRewrite } from "./question-rewrite";
import { startQuranVectorSearch } from "./quran-hybrid";
import type { HadithCollectionSelection } from "./hadith-collections";
import { isExplicitQuranOnlyRequest, planSourceRouteDecision, type SourceRoute } from "./source-intent";
import { orderRecords } from "./record-order";
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
  options: { tafsirSource?: TafsirSourceSelection; hadithCollection?: HadithCollectionSelection } = {},
  onProgress?: (completed: number, total: number, routes: SourceRoute[]) => void,
): Promise<RetrievalResponse> {
  // Hadith is searched for almost every question, so its query plan (a model call) starts now,
  // alongside the routing model call, instead of after it. Explicit Quran-only requests skip it.
  const hadithQueryPlan = isExplicitQuranOnlyRequest(query) ? undefined : startHadithQueryPlan(query, language);
  // A Fusha rewrite for dialect, Arabizi and misspelled questions, also started alongside routing.
  const questionRewrite = startQuestionRewrite(query, language);
  const routeDecision = await planSourceRouteDecision(query);
  const routes = routeDecision.routes;
  // With QURAN_SEARCH_MODE=hybrid the question is embedded for the Quran index once routing picks the
  // Quran, alongside the keyword search. Starting it before routing saved little and, for hadith-only
  // questions, slowed the hadith search's own embedding calls (OpenRouter serves parallel calls slower).
  const quranVectorSearch = routes.includes("tafsir") ? startQuranVectorSearch(query) : undefined;
  onProgress?.(0, routes.length, routes);

  let completedRoutes = 0;
  const responses = await Promise.all(
    routes.map(async (route) => {
      const response =
        route === "tafsir"
          ? await searchTafsirSources(query, language, {
              tafsirSource: options.tafsirSource,
              questionRewrite,
              vectorSearch: quranVectorSearch,
            })
          : await searchHadithSources(query, language, {
              collection: options.hadithCollection,
              queryPlan: hadithQueryPlan,
              questionRewrite,
            });

      completedRoutes += 1;
      onProgress?.(completedRoutes, routes.length, routes);
      return response;
    }),
  );
  const quranOnly = isExplicitQuranOnlyRequest(query);
  const allRecords = responses.flatMap((response) => response.records);
  const records = orderRecords(allRecords, query, quranOnly);

  return {
    status: combinedStatus(responses),
    query,
    retrievalQuery: responses.map((response) => response.retrievalQuery).filter(Boolean).join(" | ") || query,
    sourceMode: sourceModeForRoutes(routes),
    records,
    warnings: responses.flatMap((response) => response.warnings),
    provenanceNotes: [
      `Source tool router: ${routeDecision.planner}${routeDecision.reason ? ` (${routeDecision.reason})` : ""}.`,
      ...(routeDecision.warning ? [`Source tool router fallback warning: ${routeDecision.warning}`] : []),
      ...responses.flatMap((response) => response.provenanceNotes),
    ],
  };
}
