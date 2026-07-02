export type SourceRoute = "tafsir" | "hadith";

type SourceRoutePlan = {
  routes: SourceRoute[];
  planner: "ollama";
  reason: string | null;
  warning: string | null;
};

type OllamaRouteResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

const allowedRoutes = new Set<SourceRoute>(["tafsir", "hadith"]);
const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen3:30b";

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

function getOllamaRouterConfig() {
  const ollamaEnabled = process.env.OLLAMA_ENABLED?.trim() !== "false";
  const routerEnabled = process.env.MCP_TOOL_ROUTER_ENABLED?.trim() !== "false";
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || defaultOllamaBaseUrl;
  const model = process.env.MCP_TOOL_ROUTER_MODEL?.trim() || process.env.OLLAMA_MODEL?.trim() || defaultOllamaModel;
  const timeoutMs = Number.parseInt(process.env.MCP_TOOL_ROUTER_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || "12000", 10);

  return {
    enabled: ollamaEnabled && routerEnabled,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
  };
}

function routerUnavailablePlan(message: string): SourceRoutePlan {
  return {
    routes: [],
    planner: "ollama",
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

async function planSourceRoutesWithOllama(query: string): Promise<SourceRoutePlan | null> {
  const config = getOllamaRouterConfig();

  if (!config.enabled) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: routeSystemPrompt() },
          { role: "user", content: routeUserPrompt(query) },
        ],
        options: {
          temperature: 0,
          num_predict: 80,
        },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as OllamaRouteResponse;

    if (!response.ok || payload.error) {
      return routerUnavailablePlan(payload.error || `Ollama tool router returned HTTP ${response.status}.`);
    }

    const content = payload.message?.content || "";
    const normalized = normalizeModelRoutes(parseJsonObject(content));

    if (!normalized) {
      return routerUnavailablePlan("Ollama tool router returned an invalid route plan.");
    }

    return {
      routes: applyRouteSafetyNet(query, normalized.routes),
      planner: "ollama",
      reason: normalized.reason,
      warning: null,
    };
  } catch (error) {
    return routerUnavailablePlan(error instanceof Error ? error.message : "Ollama tool router request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function planSourceRouteDecision(query: string): Promise<SourceRoutePlan> {
  const modelPlan = await planSourceRoutesWithOllama(query);

  if (modelPlan) {
    return modelPlan;
  }

  return routerUnavailablePlan("AI source-tool router is disabled. Enable Ollama and MCP_TOOL_ROUTER_ENABLED to call MCP tools.");
}
