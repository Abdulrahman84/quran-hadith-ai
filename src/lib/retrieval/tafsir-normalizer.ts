import type { SourceRecord } from "./types";
import type { RetrievalLanguage } from "./types";

export type QuranSearchResult = {
  surah: number;
  ayah: number;
  text: string;
  snippet: string | null;
  score: number | null;
};

export type TafsirSearchResult = {
  surah: number;
  ayah: number;
  tafsir_excerpt: string;
  source_attribution: string;
};

export type FetchedAyah = {
  surah: number;
  ayah: number;
  text: string;
  word_count?: number;
};

export type FetchedTafsir = {
  surah: number;
  ayah: number;
  tafsirs: Array<{
    source: string;
    attribution: string;
    text: string;
  }>;
};

function reference(surah: number, ayah: number) {
  return `${surah}:${ayah}`;
}

const arabicSurahNames = [
  "",
  "الفاتحة",
  "البقرة",
  "آل عمران",
  "النساء",
  "المائدة",
  "الأنعام",
  "الأعراف",
  "الأنفال",
  "التوبة",
  "يونس",
  "هود",
  "يوسف",
  "الرعد",
  "إبراهيم",
  "الحجر",
  "النحل",
  "الإسراء",
  "الكهف",
  "مريم",
  "طه",
  "الأنبياء",
  "الحج",
  "المؤمنون",
  "النور",
  "الفرقان",
  "الشعراء",
  "النمل",
  "القصص",
  "العنكبوت",
  "الروم",
  "لقمان",
  "السجدة",
  "الأحزاب",
  "سبأ",
  "فاطر",
  "يس",
  "الصافات",
  "ص",
  "الزمر",
  "غافر",
  "فصلت",
  "الشورى",
  "الزخرف",
  "الدخان",
  "الجاثية",
  "الأحقاف",
  "محمد",
  "الفتح",
  "الحجرات",
  "ق",
  "الذاريات",
  "الطور",
  "النجم",
  "القمر",
  "الرحمن",
  "الواقعة",
  "الحديد",
  "المجادلة",
  "الحشر",
  "الممتحنة",
  "الصف",
  "الجمعة",
  "المنافقون",
  "التغابن",
  "الطلاق",
  "التحريم",
  "الملك",
  "القلم",
  "الحاقة",
  "المعارج",
  "نوح",
  "الجن",
  "المزمل",
  "المدثر",
  "القيامة",
  "الإنسان",
  "المرسلات",
  "النبأ",
  "النازعات",
  "عبس",
  "التكوير",
  "الانفطار",
  "المطففين",
  "الانشقاق",
  "البروج",
  "الطارق",
  "الأعلى",
  "الغاشية",
  "الفجر",
  "البلد",
  "الشمس",
  "الليل",
  "الضحى",
  "الشرح",
  "التين",
  "العلق",
  "القدر",
  "البينة",
  "الزلزلة",
  "العاديات",
  "القارعة",
  "التكاثر",
  "العصر",
  "الهمزة",
  "الفيل",
  "قريش",
  "الماعون",
  "الكوثر",
  "الكافرون",
  "النصر",
  "المسد",
  "الإخلاص",
  "الفلق",
  "الناس",
];

function surahName(surah: number) {
  return arabicSurahNames[surah] ?? null;
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
    .replace(/[^\p{L}\p{N}:：\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function cleanTafsirText(value: string) {
  return value
    .replace(/&lt;br\s*\/?&gt;/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const tafsirArabicPromptWords = new Set([
  "تفسير",
  "تفسيرا",
  "تفسيراً",
  "ايه",
  "آية",
  "الايه",
  "الآية",
  "سوره",
  "سورة",
  "معني",
  "معنى",
  "اشرح",
  "شرح",
]);

const tafsirEnglishPromptWords = new Set([
  "tafsir",
  "interpretation",
  "meaning",
  "explain",
  "explanation",
  "ayah",
  "aya",
  "verse",
  "surah",
  "sura",
  "quran",
  "qur",
  "an",
]);

export function unwrapTafsirToolResults(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return [];
  }

  const candidate = payload as { result?: unknown };

  return Array.isArray(candidate.result) ? candidate.result : [];
}

export function planTafsirSearchQueries(query: string, language: RetrievalLanguage) {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const terms = tokenize(trimmed).filter((token) => {
    if (language === "arabic") {
      return !tafsirArabicPromptWords.has(token) && !tafsirArabicPromptWords.has(normalizeArabic(token));
    }

    return !tafsirEnglishPromptWords.has(token.toLowerCase());
  });
  const cleaned = terms.join(" ").trim();

  return [...new Set([cleaned, trimmed].filter(Boolean))];
}

function baseRecord(surah: number, ayah: number, rank: number | null): Omit<SourceRecord, "id" | "sourceKind" | "collection" | "displayName" | "sourceReference"> {
  const verseKey = reference(surah, ayah);

  return {
    reference: verseKey,
    book: null,
    chapter: null,
    hadithNumber: null,
    surahNumber: surah,
    surahName: surahName(surah),
    ayahNumber: ayah,
    verseKey,
    translationEdition: null,
    tafsirSource: null,
    arabicText: "",
    englishText: null,
    tafsirText: null,
    grade: null,
    sourceDataset: "tafsir-mcp",
    provenanceNotes: ["Retrieved from Tafsir MCP by Tafsir Center for Quranic Studies."],
    snippet: null,
    rank,
  };
}

export function normalizeQuranSearchResult(result: QuranSearchResult, index: number): SourceRecord {
  const verseKey = reference(result.surah, result.ayah);

  return {
    ...baseRecord(result.surah, result.ayah, index + 1),
    id: `quran:${verseKey}:${index + 1}`,
    sourceKind: "quran",
    collection: "quran",
    displayName: `Quran ${verseKey}`,
    arabicText: result.text,
    sourceReference: `quran:${verseKey}`,
    snippet: result.snippet,
  };
}

export function normalizeTafsirSearchResult(result: TafsirSearchResult, source: string, index: number): SourceRecord {
  const verseKey = reference(result.surah, result.ayah);
  const tafsirText = cleanTafsirText(result.tafsir_excerpt);

  return {
    ...baseRecord(result.surah, result.ayah, index + 1),
    id: `tafsir:${source}:${verseKey}:${index + 1}`,
    sourceKind: "tafsir",
    collection: source,
    displayName: `Tafsir ${verseKey}`,
    tafsirSource: result.source_attribution,
    tafsirText,
    sourceReference: `tafsir:${source}:${verseKey}`,
    provenanceNotes: [result.source_attribution, "Retrieved from Tafsir MCP by Tafsir Center for Quranic Studies."],
    snippet: tafsirText,
  };
}

export function normalizeFetchedAyahWithTafsir(ayah: FetchedAyah, tafsir: FetchedTafsir): SourceRecord[] {
  const verseKey = reference(ayah.surah, ayah.ayah);
  const quranRecord: SourceRecord = {
    ...baseRecord(ayah.surah, ayah.ayah, 1),
    id: `quran:${verseKey}:fetch`,
    sourceKind: "quran",
    collection: "quran",
    displayName: `Quran ${verseKey}`,
    arabicText: ayah.text,
    sourceReference: `quran:${verseKey}`,
  };
  const tafsirRecords = tafsir.tafsirs.map((entry, index) => {
    const tafsirText = cleanTafsirText(entry.text);

    return {
      ...baseRecord(tafsir.surah, tafsir.ayah, index + 2),
      id: `tafsir:${entry.source}:${verseKey}:fetch`,
      sourceKind: "tafsir" as const,
      collection: entry.source,
      displayName: `Tafsir ${verseKey}`,
      arabicText: ayah.text,
      tafsirSource: entry.attribution,
      tafsirText,
      sourceReference: `tafsir:${entry.source}:${verseKey}`,
      provenanceNotes: [entry.attribution, "Retrieved from Tafsir MCP by Tafsir Center for Quranic Studies."],
      snippet: tafsirText.slice(0, 240),
    };
  });

  return [quranRecord, ...tafsirRecords];
}

export function normalizeFetchedTafsirForAyah(ayah: QuranSearchResult | FetchedAyah, tafsir: FetchedTafsir, startRank = 1): SourceRecord[] {
  const verseKey = reference(ayah.surah, ayah.ayah);

  return tafsir.tafsirs.map((entry, index) => {
    const tafsirText = cleanTafsirText(entry.text);

    return {
      ...baseRecord(tafsir.surah, tafsir.ayah, startRank + index),
      id: `tafsir:${entry.source}:${verseKey}:search`,
      sourceKind: "tafsir" as const,
      collection: entry.source,
      displayName: `Tafsir ${verseKey}`,
      arabicText: ayah.text,
      tafsirSource: entry.attribution,
      tafsirText,
      sourceReference: `tafsir:${entry.source}:${verseKey}`,
      provenanceNotes: [entry.attribution, "Retrieved from Tafsir MCP by Tafsir Center for Quranic Studies."],
      snippet: tafsirText.slice(0, 240),
    };
  });
}
