type HadithDisplayParts = {
  narration: string | null;
  matn: string;
};

const arabicMarksPattern = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/u;

function searchableShadow(value: string) {
  let shadow = "";
  const originalOffsets: number[] = [];
  let originalOffset = 0;

  for (const character of value) {
    if (!arabicMarksPattern.test(character)) {
      const normalized = character.replace(/[إأآٱ]/u, "ا").replace(/ى/u, "ي").toLowerCase();
      shadow += normalized;
      originalOffsets.push(...Array.from({ length: normalized.length }, () => originalOffset));
    }

    originalOffset += character.length;
  }

  return { shadow, originalOffsets };
}

function firstMarkerIndex(value: string) {
  const { shadow, originalOffsets } = searchableShadow(value);
  const markers = [
    "قال رسول الله",
    "سمعت رسول الله",
    "ان رسول الله",
    "كان رسول الله",
    "قال النبي",
    "ان النبي",
    "عن النبي",
    "the messenger of allah said",
    "messenger of allah said",
    "allah's messenger said",
    "allah’s messenger said",
    "the prophet said",
    "the prophet (ﷺ) said",
  ];
  const indexes = markers
    .map((marker) => shadow.indexOf(marker))
    .filter((index) => index >= 0);

  if (indexes.length === 0) {
    return null;
  }

  return originalOffsets[Math.min(...indexes)] ?? null;
}

export function splitHadithTextForDisplay(value: string): HadithDisplayParts {
  const markerIndex = firstMarkerIndex(value);

  if (markerIndex === null || markerIndex === 0 || !value.slice(0, markerIndex).trim()) {
    return { narration: null, matn: value };
  }

  return {
    narration: value.slice(0, markerIndex),
    matn: value.slice(markerIndex),
  };
}
