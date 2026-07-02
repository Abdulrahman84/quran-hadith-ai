import { planHadithSearchQueries } from "./query-planner";
import type { RetrievalLanguage } from "./types";

type HadithQueryPlan = {
  queries: string[];
  planner: "ollama" | "fallback";
  warning: string | null;
};

type OllamaQueryResponse = {
  message?: {
    content?: string;
  };
  error?: string;
};

const defaultOllamaBaseUrl = "http://127.0.0.1:11434";
const defaultOllamaModel = "qwen3:30b";

function getHadithQueryPlannerConfig() {
  const ollamaEnabled = process.env.OLLAMA_ENABLED?.trim() !== "false";
  const plannerEnabled = process.env.HADITH_QUERY_PLANNER_ENABLED?.trim() !== "false";
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || defaultOllamaBaseUrl;
  const model =
    process.env.HADITH_QUERY_PLANNER_MODEL?.trim() ||
    process.env.MCP_TOOL_ROUTER_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    defaultOllamaModel;
  const timeoutMs = Number.parseInt(process.env.HADITH_QUERY_PLANNER_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS || "12000", 10);

  return {
    enabled: ollamaEnabled && plannerEnabled,
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
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

function normalizeQueries(value: unknown, language: RetrievalLanguage) {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const candidate = value as { queries?: unknown };

  if (!Array.isArray(candidate.queries)) {
    return [];
  }

  return candidate.queries
    .filter((query): query is string => typeof query === "string")
    .map((query) => query.replace(/\s+/g, " ").trim())
    .filter((query) => query.length >= 2 && query.length <= 80)
    .filter((query) => (language === "arabic" ? !/[A-Za-z]/.test(query) : true))
    .slice(0, 5);
}

function systemPrompt(language: RetrievalLanguage) {
  if (language === "arabic") {
    return [
      "أنت مخطط بحث لأداة Hadith MCP.",
      "حوّل سؤال المستخدم إلى عبارات بحث عربية قصيرة يحتمل أن تظهر في نصوص الحديث.",
      "لا تكرر ألفاظ السؤال فقط؛ ابحث بالمعنى والعبارات النبوية أو الألفاظ المشهورة في المتن.",
      "أعد JSON فقط بهذا الشكل: {\"queries\":[\"عبارة\", \"عبارة\"]}.",
      "اجعل العبارات عربية فقط، من كلمتين إلى خمس كلمات غالبا.",
      "أمثلة:",
      "{\"queries\":[\"خلق رسول الله\",\"كان رسول الله\",\"كان النبي\",\"صفة النبي\"]} لسؤال: صفات سيدنا محمد",
      "{\"queries\":[\"الصبر عند الصدمة الأولى\",\"ومن يتصبر يصبره الله\",\"عجبا لأمر المؤمن\",\"الصابر\"]} لسؤال: الصبر",
      "{\"queries\":[\"الراحمون يرحمهم الرحمن\",\"من لا يرحم لا يرحم\",\"ارحموا من في الأرض\"]} لسؤال: الرحمة",
      "لا تجب عن السؤال، ولا تخترع أحاديث، ولا تذكر مصادر.",
    ].join("\n");
  }

  return [
    "You are a search planner for Hadith MCP.",
    "Rewrite the user's question into short hadith search phrases likely to appear in hadith text.",
    "Do not merely repeat the user's wording; search by meaning and known matn-style phrases.",
    "Return JSON only with this shape: {\"queries\":[\"phrase\", \"phrase\"]}.",
    "Use two to five word phrases when possible.",
    "Examples:",
    "{\"queries\":[\"character of the Prophet\",\"Messenger of Allah was\",\"the Prophet was\"]} for: traits of Prophet Muhammad",
    "{\"queries\":[\"patience at the first shock\",\"whoever seeks patience\",\"wondrous is the affair\"]} for: patience",
    "{\"queries\":[\"those who are merciful\",\"whoever does not show mercy\",\"show mercy to those\"]} for: mercy",
    "Do not answer the question, invent hadith, or cite sources.",
  ].join("\n");
}

async function planWithOllama(query: string, language: RetrievalLanguage): Promise<HadithQueryPlan | null> {
  const config = getHadithQueryPlannerConfig();

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
          { role: "system", content: systemPrompt(language) },
          { role: "user", content: `Question:\n${query}\n\nPlan Hadith MCP search phrases now.` },
        ],
        options: {
          temperature: 0,
          num_predict: 120,
        },
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as OllamaQueryResponse;

    if (!response.ok || payload.error) {
      return {
        queries: [],
        planner: "fallback",
        warning: payload.error || `Ollama hadith query planner returned HTTP ${response.status}.`,
      };
    }

    const queries = normalizeQueries(parseJsonObject(payload.message?.content || ""), language);

    if (queries.length === 0) {
      return {
        queries: [],
        planner: "fallback",
        warning: "Ollama hadith query planner returned no valid search phrases.",
      };
    }

    return {
      queries,
      planner: "ollama",
      warning: null,
    };
  } catch (error) {
    return {
      queries: [],
      planner: "fallback",
      warning: error instanceof Error ? error.message : "Ollama hadith query planner request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function planHadithRetrievalQueries(
  query: string,
  language: RetrievalLanguage,
  plannedQuery: string,
): Promise<HadithQueryPlan> {
  const fallbackQueries = planHadithSearchQueries(query, language, plannedQuery);
  const aiPlan = await planWithOllama(query, language);

  if (!aiPlan) {
    return {
      queries: fallbackQueries,
      planner: "fallback",
      warning: null,
    };
  }

  return {
    queries: [...new Set([...fallbackQueries, ...aiPlan.queries])],
    planner: aiPlan.planner,
    warning: aiPlan.warning,
  };
}
