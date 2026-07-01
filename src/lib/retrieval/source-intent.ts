export type SourceRoute = "tafsir" | "hadith";

const hadithTerms = [
  "hadith",
  "hadeeth",
  "sunnah",
  "prophet said",
  "حديث",
  "احاديث",
  "أحاديث",
  "السنة",
  "سنة",
  "قال رسول",
  "قال النبي",
];

const tafsirTerms = [
  "quran",
  "qur'an",
  "ayah",
  "aya",
  "surah",
  "verse",
  "tafsir",
  "translation",
  "قرآن",
  "القرآن",
  "آية",
  "اية",
  "سورة",
  "تفسير",
  "ترجمة",
];

function includesAnyTerm(query: string, terms: string[]) {
  const normalized = query.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
}

export function planSourceRoutes(query: string): SourceRoute[] {
  const wantsHadith = includesAnyTerm(query, hadithTerms);
  const wantsTafsir = includesAnyTerm(query, tafsirTerms);

  if (wantsHadith && !wantsTafsir) {
    return ["hadith"];
  }

  if (wantsTafsir && !wantsHadith) {
    return ["tafsir"];
  }

  return ["tafsir", "hadith"];
}
