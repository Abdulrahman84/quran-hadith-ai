import type { QuotationMatch, RetrievalLanguage, SourceRecord } from "./types";

type QuoteCandidate = {
  text: string;
  sourceKind: "quran" | "hadith" | null;
};

const quotedTextPattern = /«([^»]+)»|“([^”]+)”|"([^"]+)"/gu;

const arabicQuestionOpeners = /^(?:هل|ما|ماذا|كيف|لماذا|من|اين|أين|متى|اشرح|فسر|فسّر|ابحث|اعرض|اعطني|أعطني|ارني|أرني|ما صحة)\b/u;
const englishQuestionOpeners = /^(?:is|are|does|do|did|what|which|who|where|when|why|how|explain|find|show|search|give|can|could|would)\b/i;

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArabic(value: string) {
  return value
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\u0640/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي");
}

function normalizeLiteralText(value: string, useArabic: boolean) {
  const normalized = useArabic ? normalizeArabic(value) : value.toLowerCase();

  return cleanWhitespace(normalized.replace(/[^\p{L}\p{N}\s]/gu, " "));
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
      return cleanWhitespace(match[1] || match[2] || match[3] || "")
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

  return cleanWhitespace(afterFinalColon || afterSeparator);
}

function stripVerificationSuffix(value: string) {
  return value
    .replace(/\s+(?:هل\s+)?(?:صحيح|صحيحة|ثابت|ثابتة|موثق|موثقة)\s*[?؟]?\s*$/u, "")
    .replace(/\s+(?:is\s+it\s+)?(?:authentic|correct|verified|reliable)\s*\?\s*$/i, "")
    .replace(/[?؟]\s*$/u, "")
    .trim();
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
    const match = pattern.exec(question);

    if (!match || match.index === undefined) {
      continue;
    }

    const text = stripVerificationSuffix(
      textAfterMarker(question, match.index, match[0].length),
    );
    const candidateTokens = tokens(text, hasArabic(text));

    if (candidateTokens.length >= 3 && letterCount(text) >= 10) {
      return { text, sourceKind };
    }
  }

  return null;
}

function unmarkedCandidate(question: string, language: RetrievalLanguage): QuoteCandidate | null {
  const trimmed = cleanWhitespace(question);
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
