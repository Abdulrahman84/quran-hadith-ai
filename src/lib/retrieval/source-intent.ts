import { completeLlmText } from "../llm/provider";
import { matchingTokens, normalizeArabic } from "../text/arabic";

export type SourceRoute = "tafsir" | "hadith";

export type SourceRoutePlanner = "llm" | "heuristic";

type SourceRoutePlan = {
  routes: SourceRoute[];
  planner: SourceRoutePlanner;
  reason: string | null;
  warning: string | null;
};

const allowedRoutes = new Set<SourceRoute>(["tafsir", "hadith"]);

function uniqueRoutes(routes: SourceRoute[]) {
  return [...new Set(routes)];
}

function hasAnyToken(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value));
}

// Bare «ايه» is left out: in Egyptian Arabic it means "what" («النبي قال ايه عن الغضب؟»), and it
// normalizes to the same letters as «آية». The verse is still recognized from «آية», «اية», «آيه»,
// «الآية/الايه» and «آيات», see mentionsVerseWord.
// «القرآن» alone is left out too: it is often the topic, not the source («ثواب قراءة القرآن» is
// answered by hadith). Phrases that name it as the source are matched in mentionsQuranAsSource.
const quranSourceTerms = ["الايه", "ايات", "الايات", "تفسير", "التفسير", "tafsir", "ayah", "verse"];

/** The Quran named as where to look («في القرآن», «القرآن يقول», "in the Quran"), not as a topic. */
function mentionsQuranAsSource(query: string) {
  const normalized = ` ${matchingTokens(query).join(" ")} `;
  return (
    /(في|من|بالقران|ايات) القران /.test(normalized) ||
    / القران (عن|يقول|بيقول|بيحكي|يحكي|قال|ذكر) /.test(normalized) ||
    /\b(in|from) the quran\b|\bquran (on|about|say|says|said)\b|\bquranic verse/.test(query.toLowerCase())
  );
}

/** «آية» spelled so it can't be the Egyptian «ايه» (what): with madda, or ending in taa marbuta. */
function mentionsVerseWord(query: string) {
  return /(^|[^\p{L}])(آية|آيه|اية|آيتين|آيتان)(?=$|[^\p{L}])/u.test(query.replace(/[\u064B-\u0652\u0670]/g, ""));
}

function hasQuranSourceTerm(query: string, tokens: Set<string>, terms: string[]) {
  return hasAnyToken(tokens, terms) || mentionsVerseWord(query) || mentionsQuranAsSource(query);
}
// Surah names are allowed in hadith-only requests (e.g. hadith about the virtues of a surah).
const quranOnlySourceTerms = [...quranSourceTerms, "سوره", "السوره", "surah"];
const hadithSourceTerms = ["حديث", "احاديث", "السنه", "سنه", "hadith", "hadeeth", "sunnah"];

export function isExplicitQuranOnlyRequest(query: string) {
  const tokens = new Set(matchingTokens(query));
  const mentionsQuranOnlySource =
    hasQuranSourceTerm(query, tokens, quranOnlySourceTerms);

  return mentionsQuranOnlySource && !hasAnyToken(tokens, hadithSourceTerms);
}

export function isExplicitHadithOnlyRequest(query: string) {
  const tokens = new Set(matchingTokens(query));

  return hasAnyToken(tokens, hadithSourceTerms) && !hasQuranSourceTerm(query, tokens, quranSourceTerms);
}

function looksLikeOpenEndedIslamicTopic(query: string) {
  const normalized = normalizeArabic(query.toLowerCase());
  const tokens = new Set(matchingTokens(query));
  const islamicTerms = [
    "الله",
    "النبي",
    "رسول",
    "الرسول",
    "محمد",
    "صلاه",
    "الصلاه",
    "صيام",
    "الصيام",
    "زكاه",
    "الزكاه",
    "صبر",
    "الصبر",
    "رحمه",
    "الرحمه",
    "اخلاق",
    "خلق",
    "صفات",
    "شمائل",
    "ايمان",
    "الايمان",
    "تقوي",
    "الجنه",
    "النار",
    "prophet",
    "messenger",
    "muhammad",
    "allah",
    "prayer",
    "fasting",
    "patience",
    "mercy",
    "character",
    "manners",
    "faith",
    "paradise",
  ];

  return hasAnyToken(tokens, islamicTerms) || normalized.includes("سيدنا محمد");
}

function applyRouteSafetyNet(query: string, routes: SourceRoute[]) {
  if (isExplicitQuranOnlyRequest(query) || isExplicitHadithOnlyRequest(query) || !looksLikeOpenEndedIslamicTopic(query)) {
    return routes;
  }

  return uniqueRoutes([...routes, "tafsir", "hadith"]);
}

/**
 * Deterministic routing from explicit source keywords. Used when the request already
 * names its source, and as the fallback when the model router is unavailable.
 */
export function heuristicSourceRoutes(query: string): SourceRoute[] {
  if (isExplicitQuranOnlyRequest(query)) {
    return ["tafsir"];
  }

  if (isExplicitHadithOnlyRequest(query)) {
    return ["hadith"];
  }

  return ["tafsir", "hadith"];
}

function heuristicPlan(query: string, warning: string | null): SourceRoutePlan {
  return {
    routes: heuristicSourceRoutes(query),
    planner: "heuristic",
    reason: warning ? "Model router unavailable; used explicit source keywords." : "The question names its source explicitly.",
    warning,
  };
}

function parseJsonObject(value: string) {
  const stripped = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const objectMatch = stripped.match(/\{[\s\S]*\}/);

  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]) as unknown;
  } catch {
    return null;
  }
}

function normalizeModelRoutes(value: unknown): { routes: SourceRoute[]; reason: string | null } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as { routes?: unknown; reason?: unknown };

  if (!Array.isArray(candidate.routes)) {
    return null;
  }

  const routes = uniqueRoutes(candidate.routes.filter((route): route is SourceRoute => allowedRoutes.has(route as SourceRoute)));

  if (routes.length === 0) {
    return null;
  }

  return {
    routes,
    reason: typeof candidate.reason === "string" && candidate.reason.trim() ? candidate.reason.trim().slice(0, 240) : null,
  };
}

function routeSystemPrompt() {
  return [
    "You are the source-tool router for سند AI.",
    "Choose which retrieval tools should be called before any answer is written.",
    "Available tools:",
    "- tafsir: Quran text, ayah lookup, translation, and tafsir.",
    "- hadith: hadith text, collection references, source-attributed grades, and hadith metadata.",
    "Critical rule: if the user asks about a general Islamic topic or concept, routes MUST be [\"tafsir\",\"hadith\"].",
    "A single route is allowed only when the user explicitly limits the source to Quran/tafsir/ayah or explicitly limits the source to hadith.",
    "Return only compact JSON with this exact shape:",
    "{\"routes\":[\"tafsir\"],\"reason\":\"short reason\"}",
    "The routes array must contain only string values, never objects.",
    "Examples:",
    "{\"routes\":[\"tafsir\"],\"reason\":\"The question asks for ayah tafsir.\"}",
    "{\"routes\":[\"hadith\"],\"reason\":\"The question asks for hadith records.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks for broad source evidence.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks about an Islamic topic without limiting the source.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks about patience as a general Islamic topic.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks about prayer as a general Islamic topic.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks about the Prophet's traits, character, description, Sunnah, sayings, or actions and should include hadith too.\"}",
    "{\"routes\":[\"tafsir\",\"hadith\"],\"reason\":\"The question asks for Quranic and Prophetic evidence together.\"}",
    "Allowed routes are only \"tafsir\" and \"hadith\".",
    "Use only tafsir when the user clearly asks only for Quran, ayah lookup, translation, or tafsir.",
    "Use only hadith when the user clearly asks only for hadith records, hadith validation, or hadith grading.",
    "Use both routes for open-ended Islamic subjects unless the user explicitly limits the source. Do not return only tafsir for an open-ended topic.",
    "Open-ended subjects include worship, prayer, fasting, mercy, patience, character, rulings, stories, belief, paradise, hellfire, family, ethics, and descriptions of people.",
    "Questions about Prophet Muhammad, his صفات, أخلاق, شمائل, سنة, sayings, actions, appearance, character, or biography must include hadith; use both unless the user asks for hadith only.",
    "Do not answer the religious question. Do not invent tools.",
  ].join("\n");
}

function routeUserPrompt(query: string) {
  return `Question:\n${query}\n\nChoose source tools now.`;
}

async function planSourceRoutesWithLlm(query: string): Promise<SourceRoutePlan> {
  const completion = await completeLlmText({
    task: "router",
    json: true,
    maxTokens: 80,
    temperature: 0,
    messages: [
      { role: "system", content: routeSystemPrompt() },
      { role: "user", content: routeUserPrompt(query) },
    ],
  });

  if (completion.status !== "ok") {
    return heuristicPlan(query, completion.error);
  }

  const normalized = normalizeModelRoutes(parseJsonObject(completion.text));

  if (!normalized) {
    return heuristicPlan(query, `${completion.provider} source-tool router returned an invalid route plan.`);
  }

  return {
    routes: applyRouteSafetyNet(query, normalized.routes),
    planner: "llm",
    reason: normalized.reason,
    warning: null,
  };
}

export async function planSourceRouteDecision(query: string): Promise<SourceRoutePlan> {
  if (isExplicitQuranOnlyRequest(query) || isExplicitHadithOnlyRequest(query)) {
    return heuristicPlan(query, null);
  }

  return planSourceRoutesWithLlm(query);
}
