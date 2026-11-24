import type { RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

import { collapseWhitespace, normalizeArabic, stripArabicDiacritics } from "../../text/arabic";

export function getRecordText(record: SourceRecord, language: RetrievalLanguage) {
  if (record.sourceKind === "tafsir") {
    if (language === "arabic") {
      return [record.arabicText, record.tafsirText].filter(Boolean).join("\n");
    }

    return [record.englishText, record.tafsirText].filter(Boolean).join("\n");
  }

  if (language === "arabic") {
    return record.arabicText;
  }

  return record.englishText || "";
}

export function cleanArabicForExcerpt(value: string) {
  return collapseWhitespace(stripArabicDiacritics(value));
}

// Keeps ة because the quote guardrail's caveat patterns spell words like "العبارة" with ة.
export function normalizeArabicForMatching(value: string) {
  return collapseWhitespace(normalizeArabic(value, { foldTaMarbuta: false }));
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findLastArabicPhraseIndex(text: string, phrases: string[]) {
  const normalizedText = normalizeArabicForMatching(text);

  return phrases
    .map((phrase) => {
      const normalizedPhrase = normalizeArabicForMatching(phrase);
      const pattern = new RegExp(`(^|[\\s،,؛:])(${escapeRegExp(normalizedPhrase)})(?=$|[\\s،,؛:.])`, "gu");
      let found: number | undefined;
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(normalizedText)) !== null) {
        found = match.index + (match[1]?.length || 0);
      }

      return found;
    })
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => b - a)[0];
}

export function stripArabicNarratorOpening(value: string) {
  const text = collapseWhitespace(value);
  const narratorOpening = /^(?:حدثنا|حدثني|أخبرنا|اخبرنا|أنبأنا|انبانا|أنبا|انبا|سمعت)(?:\s|،|,)/;

  if (!narratorOpening.test(text)) {
    return text;
  }

  const matnMarkersToKeep = ["قال رسول الله", "قال النبي", "سمعت رسول الله", "عن النبي", "إن رسول الله", "أن رسول الله", "إن النبي", "أن النبي", "كان رسول الله"];
  const markerIndex = findLastArabicPhraseIndex(text, matnMarkersToKeep);

  if (markerIndex !== undefined && markerIndex > 0) {
    return text.slice(markerIndex).trim();
  }

  const genericSpeechMarkers = Array.from(text.matchAll(/\sقال\s*[:،,]\s*/g));
  const finalSpeechMarker = genericSpeechMarkers.at(-1);

  if (finalSpeechMarker?.index !== undefined) {
    return text.slice(finalSpeechMarker.index + finalSpeechMarker[0].length).trim();
  }

  return text;
}

export function stripArabicHadithTrailingNotes(value: string) {
  const trailingMarkers = ["قال أبو كريب", "قال أبو عيسى", "قال الترمذي", "وفي الباب"];
  const markerIndex = trailingMarkers
    .map((marker) => findLastArabicPhraseIndex(value, [marker]))
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b)[0];
  const text = markerIndex === undefined ? value : value.slice(0, markerIndex);

  return text.replace(/\s*قال\s*$/u, "").trim();
}

export function excerptArabicText(value: string) {
  const text = stripArabicHadithTrailingNotes(stripArabicNarratorOpening(cleanArabicForExcerpt(value)));
  const strongMarkers = ["قال رسول الله", "سمعت رسول الله", "إن رسول الله", "أن رسول الله", "كان رسول الله", "يصف النبي", "عن النبي", "قال النبي"];
  const strongMarkerIndex = findLastArabicPhraseIndex(text, strongMarkers);

  if (strongMarkerIndex !== undefined) {
    return stripArabicHadithTrailingNotes(text.slice(strongMarkerIndex)).slice(0, 260);
  }

  const fallbackMarkers = [" ثم قال ", " قال "];
  const fallbackMarkerIndex = fallbackMarkers
    .map((marker) => text.lastIndexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => b - a)[0];
  const excerpt = fallbackMarkerIndex === undefined ? text : text.slice(fallbackMarkerIndex);

  return stripArabicHadithTrailingNotes(excerpt).slice(0, 260);
}

export function excerptEnglishText(value: string) {
  const text = collapseWhitespace(value);
  const markers = ["saying,", "said,", "reported that", "narrated that", "the Prophet"];
  const markerIndex = markers
    .map((marker) => text.toLowerCase().indexOf(marker))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  const excerpt = markerIndex === undefined ? text : text.slice(markerIndex);

  return excerpt.slice(0, 230);
}

export function contentExcerpt(record: SourceRecord, language: RetrievalLanguage) {
  const text = getRecordText(record, language);

  if (!text.trim()) {
    return language === "arabic" ? "لا يتوفر نص بهذا اللسان في هذا السجل" : "No text is available in this language for this record";
  }

  if (record.sourceKind !== "hadith") {
    return collapseWhitespace(text).slice(0, language === "arabic" ? 260 : 230);
  }

  return language === "arabic" ? excerptArabicText(text) : excerptEnglishText(text);
}
