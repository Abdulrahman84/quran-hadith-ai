import type { RetrievalLanguage } from "./types";

type PlannedQuery = {
  retrievalQuery: string;
  changed: boolean;
};

const arabicPromptTerms = new Set([
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
  "تفسير",
  "تفسيرا",
  "تفسيراً",
  "آية",
  "ايه",
  "الآية",
  "الايه",
  "رواية",
  "روايات",
  "المصدر",
  "مصدر",
  "بالمصدر",
]);

const englishPromptTerms = new Set([
  "show",
  "find",
  "search",
  "give",
  "bring",
  "display",
  "hadith",
  "hadeeth",
  "tafsir",
  "ayah",
  "aya",
  "verse",
  "quran",
  "evidence",
  "source",
  "sources",
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

function isArabicPromptTerm(token: string) {
  return arabicPromptTerms.has(token) || arabicPromptTerms.has(normalizeArabic(token));
}

function planArabicQuery(query: string): PlannedQuery {
  const terms = tokenize(query).filter((token) => {
    const normalized = normalizeArabic(token);
    return normalized.length > 1 && !isArabicPromptTerm(token);
  });
  const compact = terms.slice(-4).join(" ").trim();
  const retrievalQuery = compact || query.trim();

  return {
    retrievalQuery,
    changed: retrievalQuery !== query.trim(),
  };
}

function planEnglishQuery(query: string): PlannedQuery {
  const terms = tokenize(query.toLowerCase()).filter((token) => token.length > 1 && !englishPromptTerms.has(token));
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

export function planHadithSearchQueries(query: string, language: RetrievalLanguage, plannedQuery = planRetrievalQuery(query, language).retrievalQuery) {
  const normalizedQuery = language === "arabic" ? normalizeArabic(query) : query.toLowerCase();
  const planned = plannedQuery.trim();
  const expansions: string[] = [];

  if (language === "arabic") {
    const tokens = new Set(tokenize(normalizedQuery));
    const asksAboutProphet =
      tokens.has("محمد") || tokens.has("النبي") || tokens.has("رسول") || tokens.has("الرسول") || normalizedQuery.includes("سيدنا محمد");
    const asksAboutTraits = ["صفات", "صفه", "اخلاق", "خلق", "شمائل", "وصف", "هيئه"].some((term) => tokens.has(term));

    if (asksAboutProphet && asksAboutTraits) {
      expansions.push("خلق رسول الله", "كان رسول الله", "كان النبي", "صفة النبي");
    }
  } else {
    const asksAboutProphet = /\b(?:prophet|messenger|muhammad)\b/.test(normalizedQuery);
    const asksAboutTraits = /\b(?:trait|traits|character|description|appearance|manners|qualities)\b/.test(normalizedQuery);

    if (asksAboutProphet && asksAboutTraits) {
      expansions.push("character of the prophet", "messenger of allah character", "description of the prophet");
    }
  }

  return [...new Set([...expansions, planned].filter(Boolean))];
}

export function splitFallbackQueries(query: string, language: RetrievalLanguage) {
  const tokens = tokenize(query);
  const terms =
    language === "arabic"
      ? tokens.filter((token) => normalizeArabic(token).length > 1 && !isArabicPromptTerm(token))
      : tokens.filter((token) => token.length > 1 && !englishPromptTerms.has(token.toLowerCase()));

  return [...new Set(terms)].slice(-5).reverse();
}
