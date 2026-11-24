import type { RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

import { collapseWhitespace, normalizeArabic, stripArabicDiacritics, tokenize } from "../../text/arabic";
import { answerCitationNumbers, citationNumbersInText } from "./citation-pack";
import { contentExcerpt, getRecordText, normalizeArabicForMatching } from "./excerpts";
import type { GenerateGroundedAnswerInput } from "./types";

export function passesGroundingGuardrails(text: string, language: RetrievalLanguage) {
  return /\[\d+\]/.test(text) && passesFormatGuardrail(text, language);
}

// Checks that hold for any prefix of an answer, so a streamed draft can be
// withdrawn as soon as it breaks one.
export function passesFormatGuardrail(text: string, language: RetrievalLanguage) {
  if (language === "arabic" && /[A-Za-z]/.test(text)) {
    return false;
  }

  if (language === "arabic" && /(?:^|\s)(?:حدثنا|حدثني|أخبرنا|اخبرنا|أنبأنا|انبانا|سمعت)(?:\s|،|,)/.test(text)) {
    return false;
  }

  const riskyArabicTerms = [
    "حرام",
    "حلال",
    "واجب",
    "فرض",
    "يجوز",
    "لا يجوز",
    "ينبغي على المسلم",
    "يجب عليك",
    "عليك أن",
    "افعل",
    "لا تفعل",
    "اترك",
  ];
  const riskyEnglishTerms = [
    "permissible",
    "impermissible",
    "obligatory",
    "forbidden",
    "must",
    "must not",
    "you should",
    "you need to",
  ];
  const riskyTerms = language === "arabic" ? riskyArabicTerms : riskyEnglishTerms;

  return !riskyTerms.some((term) => text.toLowerCase().includes(term.toLowerCase()));
}

export function tokenizeForGrounding(value: string, language: RetrievalLanguage) {
  const normalized = language === "arabic" ? normalizeArabic(value) : value.toLowerCase();

  return tokenize(normalized).filter((token) => token.length > 2 && !/^\d+$/.test(token));
}

export function groundingRecordText(record: SourceRecord, language: RetrievalLanguage) {
  return record.sourceKind === "hadith" ? contentExcerpt(record, language) : getRecordText(record, language);
}

export function passesValidCitationGuardrail(text: string, input: GenerateGroundedAnswerInput) {
  const citationNumbers = citationNumbersInText(text);
  const validCitationNumbers = answerCitationNumbers(input);

  return (
    citationNumbers.length > 0
    && citationNumbers.every((citationNumber) => validCitationNumbers.has(citationNumber))
  );
}

export const safeUncitedAnswerSentences = {
  arabic: new Set([
    "ولفهم الصورة كاملة، يمكن مراجعة سياق الإحالات المرفقة.",
    "وإذا كانت المسألة تتعلق بحالة شخصية، يمكن عرض الإحالات على عالم مؤهل.",
    "وللتحقق من اللفظ والسياق الكامل، راجع نصوص المصادر الأصلية أدناه.",
    "ويمكنك مراجعة المصادر أدناه للتأكد من النص الكامل وسياقه.",
    "أما اللفظ الكامل وتفاصيل السياق فتجدها في المصادر الأصلية أدناه.",
  ]),
  english: new Set([
    "For fuller context, the cited passages can be reviewed in their surrounding sections.",
    "If this concerns a personal situation, the citations can be taken to a qualified scholar.",
    "To verify the exact wording and full context, review the original source texts below.",
    "You can check the sources below for the complete text and its context.",
    "The original sources below provide the full wording and surrounding context.",
  ]),
} satisfies Record<RetrievalLanguage, Set<string>>;

export function isSafeUncitedAnswerSentence(segment: string, language: RetrievalLanguage) {
  if (safeUncitedAnswerSentences[language].has(segment)) {
    return true;
  }

  if (language === "arabic") {
    return /^(?:و)?يمكن مراجعة سياق (?:هذه )?(?:الأحاديث|النصوص|الإحالات)(?: في المصادر المذكورة)?(?: لمزيد من (?:التأمل|الفهم) في معانيها)?\.$/u.test(
      segment,
    );
  }

  return /^(?:For fuller context, )?(?:you can )?review the (?:cited )?(?:passages|sources|citations)(?: in their surrounding (?:context|sections))?\.$/i.test(
    segment,
  );
}

// The prompt asks the model to vary its closing pointer to the source cards, so it is
// recognized by shape (short, last, names the sources below) instead of exact wording.
export const closingInvitationPatterns = {
  arabic: /(?:المصادر|النصوص)[^.!؟]*أدناه|أدناه[^.!؟]*(?:المصادر|النصوص)/u,
  english: /\b(?:sources?|source texts?|passages)\b[^.!?]*\bbelow\b|\bbelow\b[^.!?]*\bsources?\b/i,
};

export const MAX_CLOSING_INVITATION_WORDS = 22;

export function isClosingSourceInvitation(segment: string, language: RetrievalLanguage) {
  const plain = stripArabicDiacritics(segment);
  return plain.split(/\s+/).length <= MAX_CLOSING_INVITATION_WORDS && closingInvitationPatterns[language].test(plain);
}

export function answerSegments(text: string) {
  return text
    // A line break that does not end a sentence or start a list item is wrapping, not a boundary.
    .replace(/([^\s.!؟:])\n+(?!\s*(?:[-•*]|\d+[.)]))/gu, "$1 ")
    // "؛" joins clauses of one sentence, so it is not a boundary either.
    .split(/(?<=[.!؟])\s+|\n+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function passesCitationCoverageGuardrail(text: string, input: GenerateGroundedAnswerInput) {
  const segments = answerSegments(text);
  const uncitedSubstantiveSegments = segments.filter((segment, index) => {
    const isLast = index === segments.length - 1;

    return citationNumbersInText(segment).length === 0
      && !isSafeUncitedAnswerSentence(segment, input.language)
      && !(isLast && isClosingSourceInvitation(segment, input.language));
  });

  return uncitedSubstantiveSegments.length <= 1;
}

export function sentenceAroundRange(text: string, startOffset: number, endOffset: number) {
  const boundaryCharacters = [".", "!", "?", "؟", "؛", "\n"];
  const start = Math.max(...boundaryCharacters.map((character) => text.lastIndexOf(character, startOffset - 1))) + 1;
  const followingBoundaries = boundaryCharacters
    .map((character) => text.indexOf(character, endOffset))
    .filter((index) => index >= 0);
  const end = followingBoundaries.length > 0 ? Math.min(...followingBoundaries) + 1 : text.length;

  return text.slice(start, end).trim();
}

export function isCaveatedQuestionQuotation(
  sentence: string,
  quotedText: string,
  input: GenerateGroundedAnswerInput,
) {
  if (input.quotationMatch?.state !== "similar") {
    return false;
  }

  const normalizedQuote = input.language === "arabic"
    ? normalizeArabicForMatching(quotedText)
    : collapseWhitespace(quotedText).toLowerCase();
  const isUnmatchedCandidate = input.quotationMatch.unmatchedCandidateTexts.some((candidateText) => {
    const normalizedCandidate = input.language === "arabic"
      ? normalizeArabicForMatching(candidateText)
      : collapseWhitespace(candidateText).toLowerCase();

    return normalizedCandidate === normalizedQuote;
  });

  if (!normalizedQuote || !isUnmatchedCandidate) {
    return false;
  }

  if (input.language === "arabic") {
    const normalizedSentence = normalizeArabicForMatching(sentence)
      .replace(/["«»“”]/gu, "");
    const quoteIndex = normalizedSentence.indexOf(normalizedQuote);
    const localContext = normalizedSentence.slice(
      Math.max(0, quoteIndex - 140),
      quoteIndex + normalizedQuote.length + 140,
    );
    const afterQuote = normalizedSentence.slice(quoteIndex + normalizedQuote.length);
    const hasVerificationTarget = /(?:اللفظ|لفظ|العبارة|عبارة|الصياغة|صياغة|النص|نص|الصحة|صحة|النسبة|نسبة)/u.test(localContext);
    const hasNegativeVerification = /(?:لا|لم)\s+(?:تثبت|يثبت|تؤكد|يؤكد|تتضمن|يتضمن|ترد|يرد|توجد|يوجد|تظهر|يظهر|نجد|نعثر)|(?:ليس|ليست|غير)\s+(?:ثابت|ثابتة|صحيح|صحيحة|موثق|موثقة|موجود|موجودة)|لا\s+تكفي[\s\S]{0,80}لاثبات/u.test(
      localContext,
    );
    const reversesToPositiveAttribution = /(?:لكن|بل|غير ان|مع ذلك)(?:\s+\S+){0,10}\s+(?:صحيح|صحيحة|ثابت|ثابتة|موثق|موثقة|حديث\s+صحيح|اية\s+صحيحة|ورد\s+عن|منسوب\s+الى|من\s+القران)/u.test(
      afterQuote,
    );

    return hasVerificationTarget && hasNegativeVerification && !reversesToPositiveAttribution;
  }

  const normalizedSentence = collapseWhitespace(sentence).toLowerCase()
    .replace(/["«»“”]/gu, "");
  const quoteIndex = normalizedSentence.indexOf(normalizedQuote);
  const localContext = normalizedSentence.slice(
    Math.max(0, quoteIndex - 160),
    quoteIndex + normalizedQuote.length + 160,
  );
  const afterQuote = normalizedSentence.slice(quoteIndex + normalizedQuote.length);
  const hasVerificationTarget = /\b(?:wording|phrase|quotation|quote|text|authenticity|attribution)\b/i.test(
    localContext,
  );
  const hasNegativeVerification = /\b(?:cannot|can't|could not|couldn't|does not|doesn't|did not|is not|isn't|was not|wasn't)\s+(?:verify|authenticate|establish|support|confirm|find|match)|\b(?:could not be found|couldn't be found|cannot be verified|can't be verified|not established|not verified|not authenticated|not supported|not found|no exact match|unverified|unsupported|insufficient to establish)\b/i.test(
    localContext,
  );
  const reversesToPositiveAttribution = /\b(?:but|however|yet)\b(?:\s+\S+){0,10}\s+(?:authentic|authenticated|verified|established|correctly attributed|quran says|hadith says|is (?:quran|a hadith))/i.test(
    afterQuote,
  );

  return hasVerificationTarget && hasNegativeVerification && !reversesToPositiveAttribution;
}

export function passesDirectQuoteGuardrail(text: string, input: GenerateGroundedAnswerInput) {
  const quotePattern = /«([^»]+)»|“([^”]+)”|"([^"]+)"/gu;

  return [...text.matchAll(quotePattern)].every((match) => {
    const quotedText = collapseWhitespace(match[1] || match[2] || match[3] || "");
    const quoteStart = match.index || 0;
    const sentence = sentenceAroundRange(text, quoteStart, quoteStart + match[0].length);
    const citationNumbers = citationNumbersInText(sentence);
    const hasQuranCitation = citationNumbers.some((citationNumber) => {
      return input.records[citationNumber - 1]?.sourceKind === "quran";
    });

    if (isCaveatedQuestionQuotation(sentence, quotedText, input)) {
      return true;
    }

    if (
      tokenizeForGrounding(quotedText, input.language).length < 3
      && !hasQuranCitation
    ) {
      return true;
    }

    return citationNumbers.some((citationNumber) => {
      const record = input.records[citationNumber - 1];

      if (!record) {
        return false;
      }

      if (
        record.sourceKind === "hadith"
        && tokenizeForGrounding(quotedText, input.language).length > 12
      ) {
        return false;
      }

      const recordText = groundingRecordText(record, input.language);

      if (input.language === "arabic") {
        return normalizeArabicForMatching(recordText).includes(
          normalizeArabicForMatching(quotedText),
        );
      }

      return collapseWhitespace(recordText).toLowerCase().includes(
        quotedText.toLowerCase(),
      );
    });
  });
}

export function answerGuardFailure(text: string, input: GenerateGroundedAnswerInput) {
  const checks = [
    ["format", passesGroundingGuardrails(text, input.language)],
    ["citations", passesValidCitationGuardrail(text, input)],
    ["quotes", passesDirectQuoteGuardrail(text, input)],
    ["citation_coverage", passesCitationCoverageGuardrail(text, input)],
  ] as const;

  return checks.find(([, passed]) => !passed)?.[0] || null;
}

export function draftGuardFailure(text: string, input: GenerateGroundedAnswerInput) {
  if (!passesFormatGuardrail(text, input.language)) {
    return "format";
  }

  const validCitationNumbers = answerCitationNumbers(input);
  const hasInvalidCitation = citationNumbersInText(text).some((citationNumber) => !validCitationNumbers.has(citationNumber));

  return hasInvalidCitation ? "citations" : null;
}
