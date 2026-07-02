import { completeLlmText } from "../llm/provider";

export type SourceRoute = "tafsir" | "hadith";

type SourceRoutePlan = {
  routes: SourceRoute[];
  planner: "llm";
  reason: string | null;
  warning: string | null;
};

const allowedRoutes = new Set<SourceRoute>(["tafsir", "hadith"]);

function uniqueRoutes(routes: SourceRoute[]) {
  return [...new Set(routes)];
}

function normalizeArabic(value: string) {
  return value
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function tokenize(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

function hasAnyToken(tokens: Set<string>, values: string[]) {
  return values.some((value) => tokens.has(value));
}

function isExplicitQuranOnlyRequest(query: string) {
  const normalized = normalizeArabic(query.toLowerCase());
  const tokens = new Set(tokenize(normalized));
  const mentionsQuranOnlySource =
    hasAnyToken(tokens, ["قران", "القران", "ايه", "الايه", "آيه", "الآيه", "سوره", "السوره", "تفسير", "التفسير", "tafsir", "ayah", "verse", "quran", "surah"]) ||
    normalized.includes("في القران");
  const mentionsHadithSource = hasAnyToken(tokens, ["حديث", "احاديث", "السنه", "سنه", "hadith", "hadeeth", "sunnah"]);

  return mentionsQuranOnlySource && !mentionsHadithSource;
}

function isExplicitHadithOnlyRequest(query: string) {
  const normalized = normalizeArabic(query.toLowerCase());
  const tokens = new Set(tokenize(normalized));
  const mentionsHadithSource = hasAnyToken(tokens, ["حديث", "احاديث", "السنه", "سنه", "hadith", "hadeeth", "sunnah"]);
  const mentionsQuranSource = hasAnyToken(tokens, ["قران", "القران", "ايه", "الايه", "آيه", "الآيه", "تفسير", "التفسير", "tafsir", "ayah", "verse", "quran"]);

  return mentionsHadithSource && !mentionsQuranSource;
}

function looksLikeOpenEndedIslamicTopic(query: string) {
  const normalized = normalizeArabic(query.toLowerCase());
  const tokens = new Set(tokenize(normalized));
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

function routerUnavailablePlan(message: string): SourceRoutePlan {
  return {
    routes: [],
    planner: "llm",
    reason: null,
    warning: message,
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
    return routerUnavailablePlan(completion.error);
  }

  const normalized = normalizeModelRoutes(parseJsonObject(completion.text));

  if (!normalized) {
    return routerUnavailablePlan(`${completion.provider} source-tool router returned an invalid route plan.`);
  }

  return {
    routes: applyRouteSafetyNet(query, normalized.routes),
    planner: "llm",
    reason: normalized.reason,
    warning: null,
  };
}

export async function planSourceRouteDecision(query: string): Promise<SourceRoutePlan> {
  return planSourceRoutesWithLlm(query);
}
