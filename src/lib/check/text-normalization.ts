export function hasArabicText(value: string) {
  return /\p{Script=Arabic}/u.test(value);
}

export function normalizeCheckText(value: string) {
  const useArabic = hasArabicText(value);
  const normalized = useArabic
    ? value
        .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
        .replace(/\u0640/g, "")
        .replace(/[إأآٱ]/g, "ا")
        .replace(/ى/g, "ي")
    : value.toLowerCase();

  return normalized
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkTokens(value: string) {
  return normalizeCheckText(value).split(/\s+/).filter(Boolean);
}
