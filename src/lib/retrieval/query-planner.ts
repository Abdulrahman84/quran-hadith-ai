import type { RetrievalLanguage } from "./hadith-mcp";

type PlannedQuery = {
  retrievalQuery: string;
  changed: boolean;
};

const arabicStopWords = new Set([
  "ابحث",
  "اعرض",
  "اعطني",
  "أعطني",
  "ارني",
  "أرني",
  "هات",
  "اوجد",
  "أوجد",
  "اذكر",
  "دليل",
  "دليلا",
  "دليلاً",
  "حديث",
  "حديثا",
  "حديثاً",
  "حديثي",
  "حديثيا",
  "حديثياً",
  "احاديث",
  "أحاديث",
  "رواية",
  "روايات",
  "عن",
  "حول",
  "في",
  "على",
  "من",
  "مع",
  "المصدر",
  "مصدر",
  "بالمصدر",
  "لنا",
  "لي",
  "ما",
  "هو",
  "هي",
  "هل",
  "الذي",
  "التي",
  "هذا",
  "هذه",
  "شيء",
  "شيئا",
]);

const englishStopWords = new Set([
  "show",
  "find",
  "search",
  "give",
  "bring",
  "display",
  "hadith",
  "hadeeth",
  "evidence",
  "source",
  "sources",
  "about",
  "around",
  "on",
  "for",
  "with",
  "the",
  "a",
  "an",
  "me",
  "please",
]);

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
    .map((token) => token.trim())
    .filter(Boolean);
}

function isArabicStopWord(token: string) {
  return arabicStopWords.has(token) || arabicStopWords.has(normalizeArabic(token));
}

function planArabicQuery(query: string): PlannedQuery {
  const terms = tokenize(query).filter((token) => {
    const normalized = normalizeArabic(token);
    return normalized.length > 1 && !isArabicStopWord(token);
  });
  const compact = terms.slice(-4).join(" ").trim();
  const retrievalQuery = compact || query.trim();

  return {
    retrievalQuery,
    changed: retrievalQuery !== query.trim(),
  };
}

function planEnglishQuery(query: string): PlannedQuery {
  const terms = tokenize(query.toLowerCase()).filter((token) => token.length > 1 && !englishStopWords.has(token));
  const compact = terms.slice(-5).join(" ").trim();
  const retrievalQuery = compact || query.trim();

  return {
    retrievalQuery,
    changed: retrievalQuery !== query.trim(),
  };
}

export function planRetrievalQuery(query: string, language: RetrievalLanguage): PlannedQuery {
  if (language === "arabic") {
    return planArabicQuery(query);
  }

  return planEnglishQuery(query);
}

export function splitFallbackQueries(query: string, language: RetrievalLanguage) {
  const tokens = tokenize(query);
  const terms =
    language === "arabic"
      ? tokens.filter((token) => normalizeArabic(token).length > 1 && !isArabicStopWord(token))
      : tokens.filter((token) => token.length > 1 && !englishStopWords.has(token.toLowerCase()));

  return [...new Set(terms)].slice(-5).reverse();
}
