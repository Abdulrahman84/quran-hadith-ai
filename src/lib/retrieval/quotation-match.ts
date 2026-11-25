import { collapseWhitespace, normalizeArabic as normalizeArabicText } from "../text/arabic";
import type { QuotationMatch, RetrievalLanguage, SourceRecord } from "./types";

type QuoteCandidate = {
  text: string;
  sourceKind: "quran" | "hadith" | null;
};

const quotedTextPattern = /«([^»]+)»|“([^”]+)”|"([^"]+)"/gu;

const arabicQuestionOpeners = /^(?:هل|ما|ماذا|كيف|لماذا|من|اين|أين|متى|اشرح|فسر|فسّر|ابحث|اعرض|اعطني|أعطني|ارني|أرني|ما صحة)\b/u;
const englishQuestionOpeners = /^(?:is|are|does|do|did|what|which|who|where|when|why|how|explain|find|show|search|give|can|could|would)\b/i;

// Keeps ة: the source-kind patterns below spell words like "اية" with ة.
function normalizeArabic(value: string) {
  return normalizeArabicText(value, { foldTaMarbuta: false });
}

function normalizeLiteralText(value: string, useArabic: boolean) {
  const normalized = useArabic ? normalizeArabic(value) : value.toLowerCase();

  return collapseWhitespace(normalized.replace(/[^\p{L}\p{N}\s]/gu, " "));
}

function tokens(value: string, useArabic: boolean) {
  return normalizeLiteralText(value, useArabic).split(/\s+/).filter(Boolean);
}

function letterCount(value: string) {
  return [...value.matchAll(/\p{L}/gu)].length;
}

function hasArabic(value: string) {
  return /\p{Script=Arabic}/u.test(value);
}

function explicitSourceKind(value: string): QuoteCandidate["sourceKind"] {
  const normalized = normalizeArabic(value.toLowerCase());
  const mentionsQuran = /(?:القران|قران|الاية|اية|قال تعالي|قال الله|ورد في القران|نص الاية)/u.test(normalized);
  const mentionsHadith = /(?:الحديث|حديث|قال النبي|قال رسول الله|ورد في الحديث|نص الحديث)/u.test(normalized)
    || /\b(?:hadith|hadeeth|prophet|messenger)\b/i.test(value);
  const mentionsEnglishQuran = /\b(?:quran|ayah|aya|verse)\b/i.test(value);

  if ((mentionsQuran || mentionsEnglishQuran) && !mentionsHadith) {
    return "quran";
  }

  if (mentionsHadith && !mentionsQuran && !mentionsEnglishQuran) {
    return "hadith";
  }

  return null;
}

function quotedCandidates(question: string): QuoteCandidate[] {
  const sourceKind = explicitSourceKind(question);

  return [...question.matchAll(quotedTextPattern)]
    .map((match) => {
      return collapseWhitespace(match[1] || match[2] || match[3] || "")
        .replace(/^(?:(?:\.\.\.)|…)+|(?:(?:\.\.\.)|…)+$/gu, "")
        .trim();
    })
    .filter((text) => {
      if (/(?:\.\.\.)|…/u.test(text)) {
        return false;
      }

      const quoteTokens = tokens(text, hasArabic(text));

      return quoteTokens.length >= 2 || (quoteTokens.length === 1 && letterCount(text) >= 6);
    })
    .map((text) => ({ text, sourceKind }));
}

function textAfterMarker(question: string, markerIndex: number, markerLength: number) {
  const afterMarker = question.slice(markerIndex + markerLength).trim();
  const afterSeparator = afterMarker.match(/^[\s:：\-–—،,]*(.+)$/u)?.[1] || "";
  const afterFinalColon = question.match(/[:：]\s*([^:：]+)$/u)?.[1]?.trim();

  return collapseWhitespace(afterFinalColon || afterSeparator);
}

function stripVerificationSuffix(value: string) {
  return value
    .replace(/\s+(?:هل\s+)?(?:صحيح|صحيحة|ثابت|ثابتة|موثق|موثقة)\s*[?؟]?\s*$/u, "")
    .replace(/\s+(?:is\s+it\s+)?(?:authentic|correct|verified|reliable)\s*\?\s*$/i, "")
    .replace(/[?؟]\s*$/u, "")
    .trim();
}

/**
 * «حديث النية مع المصدر», "hadith of Jibril with its source": asking for the source, chain or grade
 * is part of the request, so it isn't counted as wording to match.
 */
function stripRequestSuffix(value: string) {
  return value
    .replace(/\s+(?:مع|و)\s*(?:ذكر\s+)?(?:ال)?(?:مصدر|مصادر|مرجع|سند|تخريج|شرح|دليل|درجة|رقم)\S*\s*$/u, "")
    .replace(/\s+with\s+(?:its\s+|the\s+|a\s+)?(?:source|sources|reference|references|chain|isnad|grade|grading|explanation)\s*$/i, "")
    .trim();
}

/** «حديث» inside «حديثيا» or «الحديثية» is part of an adjective, not a marker before quoted words. */
function continuesWord(question: string, marker: string, index: number) {
  return /\p{L}$/u.test(marker) && /^\p{L}/u.test(question.slice(index));
}

/**
 * «حديث عن الصلاة», "hadith about prayer": what follows the marker is the topic of a request,
 * not wording the user wants matched.
 */
function namesTopic(text: string) {
  const normalized = normalizeArabic(text.toLowerCase()).trim();

  return /^(?:عن|حول|بشان|بخصوص|في (?:موضوع|فضل|حكم|باب))(?:\s|$)/u.test(normalized)
    || /^(?:about|on|regarding|concerning)\b/i.test(normalized);
}

function attributedCandidate(question: string): QuoteCandidate | null {
  const patterns: Array<{ sourceKind: "quran" | "hadith"; pattern: RegExp }> = [
    {
      sourceKind: "quran",
      pattern: /(?:قال\s+(?:الله(?:\s+تعالى)?|تعالى)|ورد\s+في\s+(?:القرآن|القران)|نص\s+(?:الآية|الاية)|(?:الآية|الاية|آية|اية)\s*(?:تقول|يقول|نصها)?)/u,
    },
    {
      sourceKind: "hadith",
      pattern: /(?:قال\s+(?:رسول\s+الله|النبي)|ورد\s+في\s+(?:الحديث|حديث)|نص\s+(?:الحديث|حديث)|(?:الحديث|حديث)\s*(?:يقول|نصه|نصها)?)/u,
    },
    {
      sourceKind: "quran",
      pattern: /\b(?:the\s+quran\s+says|quran\s+verse|ayah|aya|verse)\b/i,
    },
    {
      sourceKind: "hadith",
      pattern: /\b(?:the\s+prophet\s+said|the\s+hadith\s+says|hadith|hadeeth)\b/i,
    },
  ];

  for (const { sourceKind, pattern } of patterns) {
    const match = [...question.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))]
      .find((candidate) => !continuesWord(question, candidate[0], (candidate.index ?? 0) + candidate[0].length));

    if (!match || match.index === undefined) {
      continue;
    }

    const text = stripRequestSuffix(stripVerificationSuffix(
      textAfterMarker(question, match.index, match[0].length),
    ));
    const candidateTokens = tokens(text, hasArabic(text));

    if (candidateTokens.length >= 3 && letterCount(text) >= 10 && !namesTopic(text)) {
      return { text, sourceKind };
    }
  }

  return null;
}

function unmarkedCandidate(question: string, language: RetrievalLanguage): QuoteCandidate | null {
  const trimmed = collapseWhitespace(question);
  const useArabic = hasArabic(trimmed) || language === "arabic";
  const candidateTokens = tokens(trimmed, useArabic);
  const openerPattern = useArabic ? arabicQuestionOpeners : englishQuestionOpeners;

  if (
    candidateTokens.length < 14
    || letterCount(trimmed) < 70
    || /[?؟]\s*$/u.test(trimmed)
    || openerPattern.test(normalizeLiteralText(trimmed, useArabic))
  ) {
    return null;
  }

  return {
    text: trimmed.replace(/^(?:\.\.\.|…)+|(?:\.\.\.|…)+$/gu, "").trim(),
    sourceKind: explicitSourceKind(trimmed),
  };
}

function quoteCandidates(question: string, language: RetrievalLanguage) {
  const quoted = quotedCandidates(question);

  if (quoted.length > 0) {
    return quoted;
  }

  const attributed = attributedCandidate(question);

  if (attributed) {
    return [attributed];
  }

  const unmarked = unmarkedCandidate(question, language);
  return unmarked ? [unmarked] : [];
}

function recordLiteralTexts(record: SourceRecord, sourceKind: QuoteCandidate["sourceKind"]) {
  if (sourceKind === "quran") {
    if (record.sourceKind !== "quran" && record.sourceKind !== "tafsir") {
      return [];
    }

    return [record.arabicText, record.englishText].filter((text): text is string => Boolean(text));
  }

  if (sourceKind === "hadith") {
    if (record.sourceKind !== "hadith") {
      return [];
    }

    return [record.arabicText, record.englishText].filter((text): text is string => Boolean(text));
  }

  if (record.sourceKind === "hadith" || record.sourceKind === "quran" || record.sourceKind === "tafsir") {
    return [record.arabicText, record.englishText].filter((text): text is string => Boolean(text));
  }

  return [];
}

function recordMatchesCandidate(record: SourceRecord, candidate: QuoteCandidate) {
  const useArabic = hasArabic(candidate.text);
  const normalizedCandidate = normalizeLiteralText(candidate.text, useArabic);

  if (!normalizedCandidate) {
    return false;
  }

  return recordLiteralTexts(record, candidate.sourceKind).some((text) => {
    const normalizedRecord = normalizeLiteralText(text, useArabic);

    return ` ${normalizedRecord} `.includes(` ${normalizedCandidate} `);
  });
}

export function assessQuotationMatch(
  question: string,
  language: RetrievalLanguage,
  records: SourceRecord[],
): QuotationMatch {
  const candidates = quoteCandidates(question, language);

  if (candidates.length === 0) {
    return { state: "normal", matchedRecordIds: [], unmatchedCandidateTexts: [] };
  }

  const matchedRecordIds = new Set<string>();
  const unmatchedCandidateTexts: string[] = [];
  const everyCandidateMatched = candidates.every((candidate) => {
    const matchingRecords = records.filter((record) => recordMatchesCandidate(record, candidate));
    matchingRecords.forEach((record) => matchedRecordIds.add(record.id));

    if (matchingRecords.length === 0) {
      unmatchedCandidateTexts.push(candidate.text);
    }

    return matchingRecords.length > 0;
  });

  if (everyCandidateMatched) {
    return { state: "literal", matchedRecordIds: [...matchedRecordIds], unmatchedCandidateTexts: [] };
  }

  if (records.length > 0) {
    return {
      state: "similar",
      matchedRecordIds: [...matchedRecordIds],
      unmatchedCandidateTexts,
    };
  }

  return { state: "normal", matchedRecordIds: [], unmatchedCandidateTexts };
}
