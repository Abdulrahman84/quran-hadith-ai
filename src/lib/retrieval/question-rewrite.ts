import { completeLlmText } from "../llm/provider";
import type { RetrievalLanguage } from "./types";

/**
 * Users write the way they speak: Egyptian, Levantine, Gulf, Iraqi or Maghrebi Arabic, Arabizi,
 * typos, half-remembered quotes. Tafsir search and the hadith embedding search work on the
 * words they are given, so a short Modern Standard Arabic rewrite of the question is searched
 * as well. It runs alongside the routing model call, so it adds no waiting in the usual case.
 */
export type QuestionRewrite = {
  /** The question as a short Fusha search phrase, or null when it adds nothing or failed. */
  fusha: string | null;
  warning: string | null;
};

const MAX_REWRITE_CHARS = 120;

function parseFusha(text: string) {
  const stripped = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const match = stripped.match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    const value = (JSON.parse(match[0]) as { fusha?: unknown }).fusha;
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : null;
  } catch {
    return null;
  }
}

function comparable(value: string) {
  return value
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const systemPrompt = [
  "You turn a user's question about Islam into a short search phrase in Modern Standard Arabic (فصحى).",
  "The question may be in any Arabic dialect (Egyptian, Levantine, Gulf, Iraqi, Maghrebi), in Arabizi (Arabic in Latin letters and digits, e.g. 3 = ع, 2 = ء/ق, 7 = ح), mixed with English, or misspelled.",
  "Rules:",
  "- If the question is already correct standard Arabic, or is a correctly written quote of a verse or hadith, return it exactly as given.",
  "- Keep the meaning only. Don't answer, explain or add topics the user didn't ask about.",
  "- Use the standard Islamic terms a book would use (e.g. Egyptian «مراتي» → «الزوجة», «عيالي» → «الأولاد», Gulf «ودي» → «أريد», Maghrebi «بزاف» → «كثير», Iraqi «شلون» → «كيف»).",
  "- Write only the core topic, 2 to 6 words, the way a book index would name it (e.g. «آداب الطعام», «حقوق الزوجة», «كفارة اليمين»).",
  "- Leave out filler such as آيات، القرآن الكريم، أحاديث، الرسول، النبي، في الإسلام، حكم، ماذا قال، فضل ما. The search already covers the Quran and hadith.",
  "- If the user quotes or half-remembers a verse or hadith, write its correct standard wording instead of a topic.",
  "- Arabic letters only.",
  'Return only JSON: {"fusha": "..."}',
].join("\n");

export async function rewriteQuestionForSearch(query: string, language: RetrievalLanguage): Promise<QuestionRewrite> {
  // English questions already go through English tafsir and translations; this is for Arabic users.
  // Verse references such as 2:255 are looked up exactly; a rewrite would only get in the way.
  if (language !== "arabic" || !query.trim() || /\d+\s*[:：]\s*\d+/.test(query)) {
    return { fusha: null, warning: null };
  }

  const completion = await completeLlmText({
    task: "hadith-query-planner",
    json: true,
    maxTokens: 80,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Question:\n${query}` },
    ],
  });

  if (completion.status !== "ok") {
    return { fusha: null, warning: completion.error };
  }

  const fusha = parseFusha(completion.text);

  if (!fusha || fusha.length > MAX_REWRITE_CHARS || /[A-Za-z]/.test(fusha) || !/[؀-ۿ]/.test(fusha)) {
    return { fusha: null, warning: "The question rewrite returned no usable Arabic phrase." };
  }

  return { fusha: comparable(fusha) === comparable(query) ? null : fusha, warning: null };
}

/** How long searches wait for the rewrite, counted from when it starts (alongside routing). */
export const QUESTION_REWRITE_WAIT_MS = 2500;

function rewriteWaitMs() {
  const value = Number.parseInt(process.env.QUESTION_REWRITE_WAIT_MS ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : QUESTION_REWRITE_WAIT_MS;
}

/**
 * Starts the rewrite without letting an unused rejection go unhandled. A slow model call (it
 * occasionally takes 10 s or more) never holds up the search: after the wait the search goes on
 * with the user's own words.
 */
export function startQuestionRewrite(query: string, language: RetrievalLanguage): Promise<QuestionRewrite> {
  const rewrite = rewriteQuestionForSearch(query, language).catch((error: unknown) => ({
    fusha: null,
    warning: error instanceof Error ? error.message : "The question rewrite failed.",
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<QuestionRewrite>((resolve) => {
    timer = setTimeout(() => resolve({ fusha: null, warning: "The question rewrite took too long." }), rewriteWaitMs());
  });

  return Promise.race([rewrite, timeout]).finally(() => clearTimeout(timer));
}
