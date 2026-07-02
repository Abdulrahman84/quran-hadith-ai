import type { RetrievalLanguage, SourceRecord } from "./types";

export type HadithRerankCandidate = {
  record: SourceRecord;
  searchQueries: string[];
  bestSearchRank: number;
  firstSearchOrder: number;
};

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArabic(value: string) {
  return cleanWhitespace(
    value
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/\u0640/g, "")
      .replace(/[إأآٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه"),
  );
}

function normalizeForSearch(value: string, language: RetrievalLanguage) {
  const normalized = language === "arabic" ? normalizeArabic(value) : cleanWhitespace(value.toLowerCase());

  return normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokenize(value: string, language: RetrievalLanguage) {
  return normalizeForSearch(value, language)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !/^\d+$/.test(token));
}

function tokenOverlapScore(text: string, terms: string[], weight: number) {
  if (!text || terms.length === 0) {
    return 0;
  }

  const textWithBounds = ` ${text} `;
  return [...new Set(terms)].reduce((score, term) => (textWithBounds.includes(` ${term} `) ? score + weight : score), 0);
}

function stripArabicTrailingNotes(value: string) {
  return value
    .replace(/\s*قال ابو كريب[\s\S]*$/u, "")
    .replace(/\s*قال ابو عيسي[\s\S]*$/u, "")
    .replace(/\s*قال الترمذي[\s\S]*$/u, "")
    .replace(/\s*وفي الباب[\s\S]*$/u, "")
    .replace(/\s*قال\s*$/u, "")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lastWholePhraseIndex(text: string, phrases: string[]) {
  return phrases.reduce<number | undefined>((bestIndex, phrase) => {
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`, "gu");
    let phraseIndex: number | undefined;
    let match = pattern.exec(text);

    while (match) {
      phraseIndex = match.index + match[1].length;
      match = pattern.exec(text);
    }

    if (phraseIndex === undefined) {
      return bestIndex;
    }

    return bestIndex === undefined || phraseIndex > bestIndex ? phraseIndex : bestIndex;
  }, undefined);
}

function arabicMatn(value: string) {
  const text = normalizeArabic(value);
  const strongMarkers = ["قال رسول الله", "سمعت رسول الله", "ان رسول الله", "كان رسول الله", "يصف النبي", "عن النبي", "قال النبي", "ان النبي"];
  const markerIndex = lastWholePhraseIndex(text, strongMarkers);

  if (markerIndex !== undefined) {
    return stripArabicTrailingNotes(text.slice(markerIndex));
  }

  const fallbackMarkers = [" ثم قال ", " قال "];
  const fallbackMarkerIndex = lastWholePhraseIndex(text, fallbackMarkers.map((marker) => marker.trim()));

  return stripArabicTrailingNotes(fallbackMarkerIndex === undefined ? text : text.slice(fallbackMarkerIndex));
}

function englishMatn(value: string) {
  const text = cleanWhitespace(value.toLowerCase());
  const markers = ["messenger of allah", "allah's messenger", "the prophet", "reported that", "narrated that", "said,"];
  const markerIndex = markers
    .map((marker) => text.indexOf(marker))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return markerIndex === undefined ? text : text.slice(markerIndex);
}

export function hadithMatnForSearch(record: SourceRecord, language: RetrievalLanguage) {
  const text = language === "arabic" ? record.arabicText : record.englishText || record.arabicText;

  return language === "arabic" ? arabicMatn(text) : englishMatn(text);
}

function metadataText(record: SourceRecord, language: RetrievalLanguage) {
  return normalizeForSearch([record.displayName, record.book, record.chapter, record.reference].filter(Boolean).join(" "), language);
}

function phraseScore(text: string, phrase: string, language: RetrievalLanguage) {
  const terms = tokenize(phrase, language);

  if (terms.length === 0) {
    return 0;
  }

  const overlap = tokenOverlapScore(text, terms, 6);
  const allTermsMatch = terms.every((term) => ` ${text} `.includes(` ${term} `));

  return overlap + (allTermsMatch ? 16 : 0);
}

function prophetTraitScore(matn: string, query: string, searchQueries: string[], language: RetrievalLanguage) {
  if (language !== "arabic") {
    return 0;
  }

  const combinedQuery = normalizeForSearch([query, ...searchQueries].join(" "), language);
  const traitIntentTerms = ["صفه", "صفات", "خلق", "شمائل", "طويل", "قصير", "ربعه"];
  const hasTraitIntent = traitIntentTerms.some((term) => combinedQuery.includes(term));

  if (!hasTraitIntent) {
    return 0;
  }

  const prophetMentioned = ["رسول الله", "النبي", "محمد"].some((term) => matn.includes(term));
  const descriptionTerms = [
    "طويل",
    "قصير",
    "ربعه",
    "حسن",
    "جسم",
    "اسمر",
    "لون",
    "ازهر",
    "ابيض",
    "ادم",
    "جعد",
    "سبط",
    "شعر",
    "وجه",
    "وجها",
    "خلق",
    "خلقا",
    "كف",
    "ريحا",
  ];
  const matchedDescriptions = descriptionTerms.filter((term) => matn.includes(term)).length;
  let score = matchedDescriptions * 8;

  if (prophetMentioned && matchedDescriptions >= 2) {
    score += 28;
  }

  if (matn.includes("كان رسول الله") && matchedDescriptions >= 1) {
    score += 14;
  }

  if ((matn.includes("شريك") || matn.includes("يبيع")) && (matn.includes("نخل") || matn.includes("ربعه"))) {
    score -= 60;
  }

  return score;
}

function candidateScore(candidate: HadithRerankCandidate, query: string, language: RetrievalLanguage) {
  const matn = normalizeForSearch(hadithMatnForSearch(candidate.record, language), language);
  const metadata = metadataText(candidate.record, language);
  const queryTerms = tokenize(query, language);
  const queryScore = tokenOverlapScore(matn, queryTerms, 4) + tokenOverlapScore(metadata, queryTerms, 1.5);
  const searchQueryScore = candidate.searchQueries.reduce((score, searchQuery) => score + phraseScore(matn, searchQuery, language), 0);
  const traitScore = prophetTraitScore(matn, query, candidate.searchQueries, language);
  const orderScore = Math.max(0, 10 - candidate.firstSearchOrder) * 3;
  const rankScore = Math.max(0, 25 - candidate.bestSearchRank) * 0.25;
  const matnPenalty = matn.length < 24 ? -40 : 0;

  return queryScore + searchQueryScore + traitScore + orderScore + rankScore + matnPenalty;
}

export function rerankHadithRecords(candidates: HadithRerankCandidate[], query: string, language: RetrievalLanguage) {
  return [...candidates]
    .map((candidate) => ({
      candidate,
      score: candidateScore(candidate, query, language),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (left.candidate.firstSearchOrder !== right.candidate.firstSearchOrder) {
        return left.candidate.firstSearchOrder - right.candidate.firstSearchOrder;
      }

      return left.candidate.bestSearchRank - right.candidate.bestSearchRank;
    })
    .map(({ candidate }, index) => ({
      ...candidate.record,
      rank: index + 1,
    }));
}
