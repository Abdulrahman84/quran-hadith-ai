import { normalizeCheckText } from "./text-normalization";

const vagueArabicPrompts = [
  /^من قال (?:هذا|هذه|ذلك)$/u,
  /^هل (?:هذا|هذه) (?:حديث|ايه|اية)$/u,
  /^هل ورد (?:هذا|هذه)$/u,
  /^ما صحه (?:هذا|هذه|الحديث)$/u,
];

const vagueEnglishPrompts = [
  /^who said (?:this|that)$/i,
  /^is this (?:a )?(?:hadith|hadeeth|ayah|verse)$/i,
  /^is this authentic$/i,
  /^where is this from$/i,
];

export function isVagueCheckPrompt(value: string) {
  const normalized = normalizeCheckText(value);

  return vagueArabicPrompts.some((pattern) => pattern.test(normalized))
    || vagueEnglishPrompts.some((pattern) => pattern.test(normalized));
}
