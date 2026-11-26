import { searchHadithSources, startHadithQueryPlan } from "./hadith-mcp";
import { getHadithSearchMode } from "./hadith-hybrid";
import { createQueryEmbedder, startSharedQueryEmbedding, type SharedQueryEmbedding } from "./query-embedding";
import { startQuestionRewrite, type QuestionRewrite } from "./question-rewrite";
import { getQuranSearchMode, startQuranVectorSearch } from "./quran-hybrid";
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

const notSettled = Symbol("not settled");

async function valueIfSettled<T>(promise: Promise<T>): Promise<T | null> {
  const value = await Promise.race([promise, Promise.resolve(notSettled)]);
  return value === notSettled ? null : (value as T);
}

/**
 * Starts the question's embedding once routing has picked the sources, and only when a picked
 * source searches by embedding: the Quran with QURAN_SEARCH_MODE=hybrid, hadith with
 * HADITH_SEARCH_MODE=hybrid. Starting it before routing saved little, and a source that ends up not
 * searched would pay for nothing. The hadith search also embeds the Fusha rewrite: when the rewrite
 * is already ready, it joins the question's request; otherwise the Hadith MCP embeds it itself
 * when it arrives, so the question is not held back waiting for it.
 *
 * Returns undefined when nothing uses an embedding, and null when no embedding provider is set.
 */
async function startSearchQueryEmbedding(
  query: string,
  routes: SourceRoute[],
  questionRewrite: Promise<QuestionRewrite>,
): Promise<SharedQueryEmbedding | null | undefined> {
  const quranUsesIt =
    routes.includes("tafsir") && getQuranSearchMode() === "hybrid" && Boolean(process.env.QURAN_EMBEDDINGS_PATH?.trim());
  const hadithUsesIt =
    routes.includes("hadith") && getHadithSearchMode() === "hybrid" && Boolean(process.env.HADITH_MCP_EMBEDDINGS_PATH?.trim());

  if (!quranUsesIt && !hadithUsesIt) {
    return undefined;
  }

  const embedder = createQueryEmbedder();

  if (!embedder) {
    return null;
  }

  const rewrite = hadithUsesIt ? await valueIfSettled(questionRewrite) : null;
  return startSharedQueryEmbedding([query, rewrite?.fusha ?? ""], embedder);
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
  // One embedding request serves both the Quran vector search and the hadith semantic search.
  const queryEmbedding = await startSearchQueryEmbedding(query, routes, questionRewrite);
  const quranVectorSearch = routes.includes("tafsir") ? startQuranVectorSearch(query, process.env, queryEmbedding) : undefined;
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
              queryEmbedding,
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
