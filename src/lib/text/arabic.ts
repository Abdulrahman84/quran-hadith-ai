// Harakat, Quranic annotation marks (Uthmani script), and superscript alef.
const arabicDiacritics = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const tatweel = /ـ/g;

export type ArabicNormalizationOptions = {
  /**
   * Fold ة into ه so "سورة" and "سوره" match. Disable only where the caller
   * matches the result against hand-written patterns that spell ة explicitly.
   */
  foldTaMarbuta?: boolean;
};

export function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** Removes diacritics and tatweel but keeps letter shapes, for display excerpts. */
export function stripArabicDiacritics(value: string) {
  return value.replace(arabicDiacritics, "").replace(tatweel, "");
}

/** Canonical Arabic form used for matching user text against source text. */
export function normalizeArabic(value: string, options: ArabicNormalizationOptions = {}) {
  const { foldTaMarbuta = true } = options;
  const normalized = stripArabicDiacritics(value)
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي");

  return foldTaMarbuta ? normalized.replace(/ة/g, "ه") : normalized;
}

function escapeForCharacterClass(value: string) {
  return value.replace(/[\\\]^-]/g, "\\$&");
}

export type TokenizeOptions = {
  /** Extra characters to keep inside tokens, e.g. ":" for verse keys like 2:255. */
  keep?: string;
};

/** Splits on anything that is not a letter, number, or an explicitly kept character. */
export function tokenize(value: string, options: TokenizeOptions = {}) {
  const keep = options.keep ? escapeForCharacterClass(options.keep) : "";
  const separator = new RegExp(`[^\\p{L}\\p{N}${keep}\\s]`, "gu");

  return value
    .replace(separator, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/** Normalizes then tokenizes; lowercases so mixed Arabic/English queries compare cleanly. */
export function matchingTokens(value: string) {
  return tokenize(normalizeArabic(value.toLowerCase()));
}
