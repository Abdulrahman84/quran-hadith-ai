import type { RetrievalLanguage } from "@/lib/retrieval/types";

import { normalizeArabic, stripArabicDiacritics } from "../../text/arabic";
import { citationNumbersInText } from "./citation-pack";
import { isClosingSourceInvitation } from "./guardrails";

/**
 * Exhortation and reassurance: lines no source states, whatever citation the model attaches
 * («…لنا جميعا بضرورة…», «…بكل اطمئنان»). A cited lesson, a brief du'a or «بارك الله فيك» are
 * part of the shaykh's voice and stay.
 * Matched on normalized Arabic (no diacritics, plain alif, ة as ه).
 */
const arabicFillerPattern = new RegExp(
  [
    "لنا جميعا",
    "علينا جميعا",
    "بكل اطمئنان",
    "بكل طمانينه",
    "مطمئن(?:ا|ين)? ",
    "فلن(?:حرص|تذكر|جعل|جتهد)",
    "لن(?:حرص|تذكر|جعل|جتهد) ",
    "حري بنا",
    "جدير بنا",
    "يجدر بنا",
    "ينبغي لنا",
    "علينا ان",
  ].join("|"),
  "u",
);

const englishFillerPattern =
  /\b(?:reminder for (?:us )?all|for all of us|let us|let's|we should all|we must all|we all need|rest assured|with confidence|peace of mind)\b/i;

function isFillerSentence(sentence: string, language: RetrievalLanguage) {
  if (language === "arabic") {
    return arabicFillerPattern.test(` ${normalizeArabic(sentence)} `);
  }

  return englishFillerPattern.test(sentence);
}

/** The answer has to stand on its own, so an uncited pointer to "the sources below" is filler too. */
function isSourcePointer(sentence: string, language: RetrievalLanguage) {
  return citationNumbersInText(sentence).length === 0 && isClosingSourceInvitation(sentence, language);
}

function paragraphSentences(paragraph: string) {
  return paragraph.split(/(?<=[.!؟?])\s+/u).filter((sentence) => sentence.trim());
}

/**
 * Drops exhortation, reassurance and "see the sources below" sentences from a finished answer,
 * keeping its paragraphs. Sourced sentences, including a short closing lesson, are kept.
 */
export function removeFillerSentences(text: string, language: RetrievalLanguage) {
  return text
    .split(/(\n\s*\n)/u)
    .map((part) => {
      if (/^\n\s*\n$/u.test(part)) {
        return part;
      }

      return part
        .split("\n")
        .map((line) => paragraphSentences(line)
          .filter((sentence) => {
            const plain = stripArabicDiacritics(sentence.trim());
            return !isFillerSentence(plain, language) && !isSourcePointer(plain, language);
          })
          .join(" "))
        .filter((line) => line.trim())
        .join("\n");
    })
    .join("")
    .replace(/(\n\s*\n)(?:\s*\n)+/gu, "$1")
    .trim();
}
