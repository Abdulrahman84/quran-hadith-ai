import { normalizeArabic, tokenize } from "../text/arabic";

/** A well-known name for a verse, a run of verses or a short surah, resolved to verse keys. */
export type NamedQuranPassage = {
  name: string;
  /** In reading order. Fetched directly, like a verse named by reference. */
  verseKeys: string[];
  /**
   * False when the keys are only the opening of a long surah («سورة الكهف»): the search still runs
   * for the rest of the question, and the opening comes first.
   */
  complete: boolean;
};

type PassageEntry = {
  name: string;
  surah: number;
  firstAyah: number;
  lastAyah: number;
  /** Matched against the question normalized by arabicForm. */
  arabic: RegExp[];
  /** Matched against the question normalized by englishForm. */
  english: RegExp[];
};

type SurahEntry = PassageEntry & { lastSurah?: number; lastSurahAyah?: number };

// Patterns are written against the normalized forms below: Arabic with أإآ→ا, ى→ي, ة→ه and no
// diacritics; English lowercased, with "surah"/"ayah" spellings unified and articles («al-») dropped.
const ayahAr = "(?:^| )[وبفل]?(?:ال)?اي[هت]";
const surahAr = "(?:^| )[وبفل]?(?:ال)?سور[هت]";
const lastAr = "(?:^| )[وبفل]?(?:خواتيم|خواتم|خاتمه|ختام|اواخر|اخر)";
const firstAr = "(?:^| )[وبفل]?(?:اول|اوائل|فواتح|بدايه)";
const lastEn = "\\b(?:last|final|closing|concluding|end)";
const firstEn = "\\b(?:first|opening|beginning|start)";
const ofSurahEn = "(?: of)?(?: the)?(?: surah)?";
const ar = (pattern: string) => new RegExp(pattern);
const en = (pattern: string) => new RegExp(pattern);

/**
 * Names of single verses and verse runs. Checked before the surah names, so «خواتيم سورة البقرة»
 * is the last two verses, not the opening of al-Baqarah.
 */
const verseEntries: PassageEntry[] = [
  {
    name: "Ayat al-Kursi",
    surah: 2,
    firstAyah: 255,
    lastAyah: 255,
    arabic: [ar(`${ayahAr} ال?كو?رسي(?: |$)`)],
    english: [
      en("\\bayah(?: of)?(?: the)? (?:a[ln])?(?:k[ou]rs(?:i|y|ee|ie|iy)|throne)\\b"),
      en("\\b(?:a[ln])?(?:k[ou]rs(?:i|y|ee|ie|iy)|throne) ayah\\b"),
      en("\\ba{1,2}ya?t?[aeiu]?l?k[ou]rs(?:i|y|ee|ie|iy)\\b"),
    ],
  },
  {
    name: "the last two verses of al-Baqarah",
    surah: 2,
    firstAyah: 285,
    lastAyah: 286,
    arabic: [
      ar(`${lastAr}(?: (?:ال)?(?:ايتين|ايتان|ايات|ايه))?(?: من)?(?: (?:ال)?سور[هت])? البقره(?: |$)`),
      ar(`(?:^| )(?:ال)?(?:ايتين|ايتان) (?:الاخيرتين|الاخيرتان) من(?: (?:ال)?سور[هت])? البقره(?: |$)`),
    ],
    english: [en(`${lastEn}(?: two| 2)?(?: ayah)?${ofSurahEn} baq[ae]?rah?\\b`)],
  },
  {
    name: "Ayat al-Dayn",
    surah: 2,
    firstAyah: 282,
    lastAyah: 282,
    arabic: [ar(`${ayahAr} ال(?:دين|مداينه|مداينات)(?: |$)`)],
    english: [
      en("\\bayah(?: of)?(?: the)? (?:a[ln])?(?:dayn|dain|deyn|debts?|mudayana|mudaayana|mudayanah)\\b"),
      en("\\b(?:debts?|dayn|dain) ayah\\b"),
    ],
  },
  {
    name: "Ayat al-Nur",
    surah: 24,
    firstAyah: 35,
    lastAyah: 35,
    arabic: [ar(`${ayahAr} النور(?: |$)`)],
    english: [en("\\bayah(?: of)?(?: the)? (?:a[ln])?(?:nur|noor|light)\\b"), en("\\b(?:light|nur|noor) ayah\\b")],
  },
  {
    name: "Ayat al-Wudu",
    surah: 5,
    firstAyah: 6,
    lastAyah: 6,
    arabic: [ar(`${ayahAr} الوضوء(?: |$)`)],
    english: [
      en("\\bayah(?: of)?(?: the)? (?:a[ln])?(?:wudu|wudhu|wudoo|wuzu|ablution)\\b"),
      en("\\b(?:wudu|wudhu|wudoo|ablution) ayah\\b"),
    ],
  },
  {
    name: "the last verses of al-Hashr",
    surah: 59,
    firstAyah: 22,
    lastAyah: 24,
    arabic: [ar(`${lastAr}(?: (?:ال)?(?:ايات|ثلاث ايات))?(?: من)?(?: (?:ال)?سور[هت])? الحشر(?: |$)`)],
    english: [en(`${lastEn}(?: three| 3)?(?: ayah)?${ofSurahEn} hashr\\b`)],
  },
  {
    name: "the last ten verses of Al Imran",
    surah: 3,
    firstAyah: 190,
    lastAyah: 200,
    arabic: [ar(`${lastAr}(?: عشر)?(?: (?:ال)?ايات)?(?: من)?(?: (?:ال)?سور[هت])? ال عمران(?: |$)`)],
    english: [en(`${lastEn}(?: ten| 10)?(?: ayah)?${ofSurahEn} (?:aa?l(?: ?[ie])? )?[ie]mr?aa?n\\b`)],
  },
  {
    name: "the first ten verses of al-Kahf",
    surah: 18,
    firstAyah: 1,
    lastAyah: 10,
    arabic: [ar(`${firstAr}(?: عشر)?(?: (?:ال)?ايات)?(?: من)?(?: (?:ال)?سور[هت])? الكهف(?: |$)`)],
    english: [en(`${firstEn}(?: ten| 10)?(?: ayah)?${ofSurahEn} kah?f\\b`)],
  },
];

/** Short surahs, fetched whole. */
const shortSurahEntries: SurahEntry[] = [
  {
    name: "Surat al-Fatiha",
    surah: 1,
    firstAyah: 1,
    lastAyah: 7,
    // «الفاتحة» alone names the surah; it is not a common word on its own.
    arabic: [ar("(?:^| )[وبفل]?الفاتحه(?: |$)"), ar("(?:^| )[وبفل]?فاتحه الكتاب(?: |$)")],
    english: [en("\\b(?:a[ln])?fa{1,2}t[ie]h(?:a|ah|at|eh|e)\\b")],
  },
  {
    name: "Surat al-Ikhlas",
    surah: 112,
    firstAyah: 1,
    lastAyah: 4,
    // «الإخلاص» alone is sincerity, the concept, so the surah word is required.
    arabic: [ar(`${surahAr} (?:ال)?اخلاص(?: |$)`), ar(`${surahAr} قل هو الله احد(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?ikh?la{1,2}s\\b")],
  },
  {
    name: "al-Mu'awwidhatayn",
    surah: 113,
    firstAyah: 1,
    lastAyah: 5,
    lastSurah: 114,
    lastSurahAyah: 6,
    arabic: [ar("(?:^| )[وبفل]?(?:ال)?معوذت(?:ين|ان)(?: |$)")],
    english: [en("\\bmu ?a?w{1,2}[iy]?(?:dh|z|th|d)at[ae]?[iy]n\\b")],
  },
  {
    name: "Surat al-Falaq",
    surah: 113,
    firstAyah: 1,
    lastAyah: 5,
    arabic: [ar(`${surahAr} (?:ال)?فلق(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?falaq?\\b")],
  },
  {
    name: "Surat al-Nas",
    surah: 114,
    firstAyah: 1,
    lastAyah: 6,
    arabic: [ar(`${surahAr} (?:ال)?ناس(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?naa?s\\b")],
  },
  {
    name: "Surat al-Asr",
    surah: 103,
    firstAyah: 1,
    lastAyah: 3,
    arabic: [ar(`${surahAr} (?:ال)?عصر(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?asr\\b")],
  },
  {
    name: "Surat al-Kawthar",
    surah: 108,
    firstAyah: 1,
    lastAyah: 3,
    arabic: [ar(`${surahAr} (?:ال)?كوثر(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?ka[wu](?:th|s)ar\\b")],
  },
  {
    name: "Surat al-Kafirun",
    surah: 109,
    firstAyah: 1,
    lastAyah: 6,
    arabic: [ar(`${surahAr} (?:ال)?كافرون(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?ka{1,2}fir(?:un|oon|on|in|een)\\b")],
  },
  {
    name: "Surat al-Nasr",
    surah: 110,
    firstAyah: 1,
    lastAyah: 3,
    arabic: [ar(`${surahAr} (?:ال)?نصر(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?nas{1,2}r\\b")],
  },
  {
    name: "Surat al-Qadr",
    surah: 97,
    firstAyah: 1,
    lastAyah: 5,
    arabic: [ar(`${surahAr} (?:ال)?قدر(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?qadr\\b")],
  },
];

/**
 * Long surahs: only the opening is fetched, and only when the question names the surah itself,
 * not a verse in it («آية عن الصبر في سورة الكهف» is a search inside the surah).
 */
const SURAH_OPENING_AYAHS = 5;

const longSurahEntries: PassageEntry[] = [
  {
    name: "Surat al-Baqarah",
    surah: 2,
    arabic: [ar(`${surahAr} (?:ال)?بقره(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?baq[ae]?rah?\\b")],
  },
  {
    name: "Surat al-Kahf",
    surah: 18,
    arabic: [ar(`${surahAr} (?:ال)?كهف(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?kah?f\\b")],
  },
  {
    name: "Surat Ya-Sin",
    surah: 36,
    arabic: [ar(`${surahAr} يس(?: |$)`)],
    english: [en("\\bsurah ya{1,2} ?s(?:ee|i|ii)n\\b")],
  },
  {
    name: "Surat al-Mulk",
    surah: 67,
    arabic: [ar(`${surahAr} (?:ال)?ملك(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?mulk\\b")],
  },
  {
    name: "Surat al-Rahman",
    surah: 55,
    arabic: [ar(`${surahAr} (?:ال)?رحمن(?: |$)`)],
    english: [en("\\bsurah (?:a[ln])?ra(?:h|hh)?maa?n\\b")],
  },
].map((entry) => ({ ...entry, firstAyah: 1, lastAyah: SURAH_OPENING_AYAHS }));

/** A verse, a position or a number in the question points inside the surah, past its opening. */
const pointsInsideSurahAr = /(?:^| )[وبفل]?(?:ال)?(?:ايه|ايت|ايات|ايتين|ايتان|اخر|اواخر|خواتيم|خاتمه|اول|اوائل|فواتح|قصه)(?: |$)/;
const pointsInsideSurahEn = /\b(?:ayah|last|final|end|first|opening|beginning|story|stories)\b/;

const articles = new Set(["al", "el", "ul", "il", "an", "ar", "as", "ash", "ad", "adh", "at", "ath", "az"]);

function arabicForm(query: string) {
  return tokenize(normalizeArabic(query)).join(" ");
}

/** "Ayatul-Kursi", "Sūrat al-Fātiḥa": lowercased letters only, "surah"/"ayah" spelled one way, no articles. */
function englishForm(query: string) {
  return query
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => {
      if (/^s(?:u|oo|ou)ra[ht]?(?:ul|al|il|ut|u)?$/.test(token)) {
        return "surah";
      }

      if (/^(?:a{1,2}y(?:a|ah|aa|at|aat|et|ath)?(?:ul|al|il)?|verses?)$/.test(token)) {
        return "ayah";
      }

      return token;
    })
    .filter((token) => !articles.has(token))
    .join(" ");
}

function verseKeysOf(entry: SurahEntry) {
  const keys: string[] = [];

  for (let ayah = entry.firstAyah; ayah <= entry.lastAyah; ayah += 1) {
    keys.push(`${entry.surah}:${ayah}`);
  }

  for (let ayah = 1; entry.lastSurah && ayah <= (entry.lastSurahAyah ?? 0); ayah += 1) {
    keys.push(`${entry.lastSurah}:${ayah}`);
  }

  return keys;
}

function matches(entry: PassageEntry, arabic: string, english: string) {
  return entry.arabic.some((pattern) => pattern.test(arabic)) || entry.english.some((pattern) => pattern.test(english));
}

/**
 * The well-known passage the question names («آية الكرسي», "Ayat al-Kursi", "Surah al-Ikhlas"),
 * or null. Only the first match counts. A question with a verse reference (2:255) is left to
 * the reference.
 */
export function findNamedQuranPassage(query: string): NamedQuranPassage | null {
  if (/\d\s*[:：]\s*\d/.test(query)) {
    return null;
  }

  const arabic = ` ${arabicForm(query)} `;
  const english = ` ${englishForm(query)} `;
  const named = [...verseEntries, ...shortSurahEntries].find((entry) => matches(entry, arabic, english));

  if (named) {
    return { name: named.name, verseKeys: verseKeysOf(named), complete: true };
  }

  if (pointsInsideSurahAr.test(arabic) || pointsInsideSurahEn.test(english) || /\d/.test(query)) {
    return null;
  }

  const surah = longSurahEntries.find((entry) => matches(entry, arabic, english));
  return surah ? { name: surah.name, verseKeys: verseKeysOf(surah), complete: false } : null;
}
