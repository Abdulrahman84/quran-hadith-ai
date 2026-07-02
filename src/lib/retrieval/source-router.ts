import { searchHadithSources } from "./hadith-mcp";
import type { HadithCollectionSelection } from "./hadith-collections";
import { planSourceRouteDecision, type SourceRoute } from "./source-intent";
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

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي");
}

function tokenize(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function isQuranOnlyQuery(query: string, language: RetrievalLanguage) {
  const normalized = language === "arabic" ? normalizeArabic(query.toLowerCase()) : query.toLowerCase();
  const tokens = new Set(tokenize(normalized));
  const quranTerms =
    language === "arabic"
      ? ["قران", "القران", "اية", "الاية", "ايه", "الايه", "سوره", "السوره", "تفسير", "التفسير"]
      : ["quran", "ayah", "aya", "verse", "surah", "tafsir"];
  const hadithTerms = language === "arabic" ? ["حديث", "احاديث", "سنه", "السنه"] : ["hadith", "hadeeth", "sunnah"];
  const mentionsQuran = quranTerms.some((term) => tokens.has(term));
  const mentionsHadith = hadithTerms.some((term) => tokens.has(term));

  return mentionsQuran && !mentionsHadith;
}

function sourcePriority(record: SourceRecord, query: string, language: RetrievalLanguage) {
  if (isQuranOnlyQuery(query, language)) {
    return record.sourceKind === "hadith" ? 1 : 0;
  }

  return record.sourceKind === "hadith" ? 0 : 1;
}

export async function searchSources(
  query: string,
  language: RetrievalLanguage,
  options: { tafsirSource?: TafsirSourceSelection; hadithCollection?: HadithCollectionSelection } = {},
): Promise<RetrievalResponse> {
  const routeDecision = await planSourceRouteDecision(query);
  const routes = routeDecision.routes;

  if (routes.length === 0) {
    return {
      status: "error",
      query,
      retrievalQuery: query,
      sourceMode: "quran-tafsir-hadith",
      records: [],
      warnings: [
        {
          code: "source_tool_router_unavailable",
          message: routeDecision.warning || "The AI source-tool router did not choose an MCP tool.",
        },
      ],
      provenanceNotes: [
        "Source tool router: ollama.",
        ...(routeDecision.warning ? [`Source tool router error: ${routeDecision.warning}`] : []),
      ],
    };
  }

  const responses = await Promise.all(
    routes.map((route) =>
      route === "tafsir"
        ? searchTafsirSources(query, language, { tafsirSource: options.tafsirSource })
        : searchHadithSources(query, language, { collection: options.hadithCollection }),
    ),
  );
  const records = responses
    .flatMap((response) => response.records)
    .sort((left, right) => {
      const priorityDifference = sourcePriority(left, query, language) - sourcePriority(right, query, language);

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
