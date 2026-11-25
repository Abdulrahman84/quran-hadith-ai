import { searchHadithSources, startHadithQueryPlan } from "./hadith-mcp";
import { startQuestionRewrite } from "./question-rewrite";
import type { HadithCollectionSelection } from "./hadith-collections";
import { normalizeArabic, tokenize } from "../text/arabic";
import { isExplicitQuranOnlyRequest, planSourceRouteDecision, type SourceRoute } from "./source-intent";
import { searchTafsirSources } from "./tafsir-mcp";
import type { TafsirSourceSelection } from "./tafsir-sources";
import type { RetrievalLanguage, RetrievalResponse, RetrievalStatus, SourceMode, SourceRecord } from "./types";

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

const MIN_QUOTE_PHRASE_TOKENS = 3;

function phraseTokens(value: string) {
  return tokenize(normalizeArabic(value.toLowerCase()));
}

// The whole question as a normalized phrase, when it is long enough to be a quote rather than a keyword.
function phraseForQuoteLookup(query: string) {
  const tokens = phraseTokens(query);
  return tokens.length >= MIN_QUOTE_PHRASE_TOKENS ? ` ${tokens.join(" ")} ` : null;
}

// Records that contain the typed text verbatim answer a quote lookup. The Quran ranks ahead of
// hadith that cite the same words, since the ayah is the original source of the phrase.
function quoteTier(record: SourceRecord, phrase: string | null) {
  if (!phrase || !` ${phraseTokens(record.arabicText).join(" ")} `.includes(phrase)) {
    return 2;
  }

  return record.sourceKind === "hadith" ? 1 : 0;
}

function sourcePriority(record: SourceRecord, quranOnly: boolean) {
  if (quranOnly) {
    return record.sourceKind === "hadith" ? 1 : 0;
  }

  return record.sourceKind === "hadith" ? 0 : 1;
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
  onProgress?.(0, routes.length, routes);

  let completedRoutes = 0;
  const responses = await Promise.all(
    routes.map(async (route) => {
      const response =
        route === "tafsir"
          ? await searchTafsirSources(query, language, { tafsirSource: options.tafsirSource, questionRewrite })
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
  const quotedPhrase = phraseForQuoteLookup(query);
  const records = allRecords
    .sort((left, right) => {
      const quoteDifference = quoteTier(left, quotedPhrase) - quoteTier(right, quotedPhrase);

      if (quoteDifference !== 0) {
        return quoteDifference;
      }

      const priorityDifference = sourcePriority(left, quranOnly) - sourcePriority(right, quranOnly);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
    });

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
