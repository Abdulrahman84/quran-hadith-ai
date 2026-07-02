import { completeLlmText } from "../llm/provider";
import { planHadithSearchQueries } from "./query-planner";
import type { RetrievalLanguage } from "./types";

type HadithQueryPlan = {
  queries: string[];
  planner: "llm" | "fallback";
  warning: string | null;
};

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

async function planWithLlm(query: string, language: RetrievalLanguage): Promise<HadithQueryPlan> {
  const completion = await completeLlmText({
    task: "hadith-query-planner",
    json: true,
    maxTokens: 120,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt(language) },
      { role: "user", content: `Question:\n${query}\n\nPlan Hadith MCP search phrases now.` },
    ],
  });

  if (completion.status !== "ok") {
    return {
      queries: [],
      planner: "fallback",
      warning: completion.error,
    };
  }

  const queries = normalizeQueries(parseJsonObject(completion.text), language);

  if (queries.length === 0) {
    return {
      queries: [],
      planner: "fallback",
      warning: `${completion.provider} hadith query planner returned no valid search phrases.`,
    };
  }

  return {
    queries,
    planner: "llm",
    warning: null,
  };
}

export async function planHadithRetrievalQueries(
  query: string,
  language: RetrievalLanguage,
  plannedQuery: string,
): Promise<HadithQueryPlan> {
  const fallbackQueries = planHadithSearchQueries(query, language, plannedQuery);
  const aiPlan = await planWithLlm(query, language);

  return {
    queries: [...new Set([...fallbackQueries, ...aiPlan.queries])],
    planner: aiPlan.planner,
    warning: aiPlan.warning,
  };
}
