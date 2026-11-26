import { normalizeArabic, tokenize } from "../text/arabic";
import type { SourceRecord } from "./types";

const MIN_QUOTE_PHRASE_TOKENS = 3;
/** A three-word phrase with a typo matches too much by chance. */
const MIN_NEAR_PHRASE_TOKENS = 4;
/** Shorter words must match exactly: one letter changes «من» into «ان». */
const MIN_TYPO_TOKEN_LENGTH = 3;

function phraseTokens(value: string) {
  return tokenize(normalizeArabic(value.toLowerCase()));
}

/** One letter added, dropped or changed. */
function withinOneEdit(left: string, right: string) {
  if (left === right) {
    return true;
  }

  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }

  let common = 0;

  while (common < left.length && common < right.length && left[common] === right[common]) {
    common += 1;
  }

  if (left.length === right.length) {
    return left.slice(common + 1) === right.slice(common + 1);
  }

  return left.length > right.length ? left.slice(common + 1) === right.slice(common) : left.slice(common) === right.slice(common + 1);
}

function tokensMatch(typed: string, source: string) {
  return typed === source || (Math.min(typed.length, source.length) >= MIN_TYPO_TOKEN_LENGTH && withinOneEdit(typed, source));
}

/**
 * The typed phrase appears in the text with a few one-letter typos («ان مع العسر يسري» for
 * «إن مع العسر يسرا»): every word in a run matches, at most one in four with a single letter off.
 */
function containsNearPhrase(textTokens: string[], phrase: string[]) {
  const allowedTypos = Math.max(1, Math.floor(phrase.length / 4));

  for (let start = 0; start + phrase.length <= textTokens.length; start += 1) {
    let typos = 0;
    let matched = true;

    for (let offset = 0; offset < phrase.length && matched; offset += 1) {
      const source = textTokens[start + offset];

      if (source !== phrase[offset]) {
        typos += 1;
        matched = typos <= allowedTypos && tokensMatch(phrase[offset], source);
      }
    }

    if (matched) {
      return true;
    }
  }

  return false;
}

type QuoteMatch = "exact" | "near" | "none";

function quoteMatch(record: SourceRecord, phrase: string[] | null): QuoteMatch {
  if (!phrase) {
    return "none";
  }

  const textTokens = phraseTokens(record.arabicText);

  if (` ${textTokens.join(" ")} `.includes(` ${phrase.join(" ")} `)) {
    return "exact";
  }

  return phrase.length >= MIN_NEAR_PHRASE_TOKENS && containsNearPhrase(textTokens, phrase) ? "near" : "none";
}

/**
 * Records containing the typed text answer a quote lookup: verbatim matches first, then matches
 * with a typo. Within each, the Quran ranks ahead of hadith that cite the same words, since the
 * ayah is the original source of the phrase.
 */
function quoteTier(match: QuoteMatch, record: SourceRecord) {
  const hadith = record.sourceKind === "hadith" ? 1 : 0;

  if (match === "exact") {
    return hadith;
  }

  return match === "near" ? 2 + hadith : 4;
}

function sourcePriority(record: SourceRecord, quranFirst: boolean) {
  const hadith = record.sourceKind === "hadith";
  return quranFirst ? Number(hadith) : Number(!hadith);
}

/**
 * The order records are shown and cited in: quote matches first, then the source the question
 * asks for (hadith first unless the question is about the Quran), then each search's own rank.
 */
export function orderRecords(records: SourceRecord[], query: string, quranFirst: boolean) {
  const queryTokens = phraseTokens(query);
  const phrase = queryTokens.length >= MIN_QUOTE_PHRASE_TOKENS ? queryTokens : null;
  const tiers = new Map(records.map((record) => [record, quoteTier(quoteMatch(record, phrase), record)]));

  return [...records].sort((left, right) => {
    const quoteDifference = (tiers.get(left) ?? 4) - (tiers.get(right) ?? 4);

    if (quoteDifference !== 0) {
      return quoteDifference;
    }

    const priorityDifference = sourcePriority(left, quranFirst) - sourcePriority(right, quranFirst);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER);
  });
}
