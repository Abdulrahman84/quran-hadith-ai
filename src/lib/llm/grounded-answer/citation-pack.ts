import type { RetrievalLanguage, SourceRecord } from "@/lib/retrieval/types";

import { contentExcerpt, getRecordText } from "./excerpts";
import { arabicRecordMetadata } from "./record-labels";
import type { CitationPackRecord, GenerateGroundedAnswerInput } from "./types";

export function buildCitationPack(records: CitationPackRecord[], language: RetrievalLanguage) {
  return records
    .map(({ record, citationNumber }) => {
      const citation = `[${citationNumber}]`;
      const text =
        record.sourceKind === "hadith"
          ? contentExcerpt(record, language)
          : getRecordText(record, language).trim();
      const metadata =
        language === "arabic"
          ? arabicRecordMetadata(record)
          : record.sourceKind === "hadith"
            ? [
                `${record.displayName} ${record.reference}`,
                record.book ? `book: ${record.book}` : null,
                record.chapter ? `chapter: ${record.chapter}` : null,
                record.grade?.value ? `grade: ${record.grade.value}` : "grade: unavailable",
                `source: ${record.sourceReference}`,
              ]
            : [
                `${record.displayName} ${record.reference}`,
                record.translationEdition ? `translation: ${record.translationEdition}` : null,
                record.tafsirSource ? `tafsir: ${record.tafsirSource}` : null,
                `source: ${record.sourceReference}`,
              ];
      const metadataText = metadata
        .filter(Boolean)
        .join("; ");

      return `${citation} ${metadataText}\n${text.slice(0, 450)}`;
    })
    .join("\n\n");
}

export function selectAnswerRecords(records: SourceRecord[], prioritizedRecordIds: string[] = []): CitationPackRecord[] {
  const selected = new Map<string, CitationPackRecord>();

  function add(record: SourceRecord, index: number, limit = 12) {
    if (selected.size >= limit) {
      return;
    }

    selected.set(record.id || `${record.sourceKind}:${record.sourceReference}:${index}`, {
      record,
      citationNumber: index + 1,
    });
  }

  const prioritizedIds = new Set(prioritizedRecordIds);
  records.forEach((record, index) => {
    if (prioritizedIds.has(record.id)) {
      add(record, index);
    }
  });
  records.forEach((record, index) => {
    if (record.sourceKind === "hadith") {
      add(record, index, 6);
    }
  });
  records.forEach((record, index) => {
    if (record.sourceKind === "quran") {
      add(record, index, 9);
    }
  });
  records.forEach((record, index) => {
    if (record.sourceKind === "tafsir") {
      add(record, index, 12);
    }
  });
  records.forEach((record, index) => {
    add(record, index);
  });

  return [...selected.values()].sort((left, right) => left.citationNumber - right.citationNumber);
}

export function citationNumbersInText(text: string) {
  return [...text.matchAll(/\[(\d+)\]/g)]
    .map((match) => Number.parseInt(match[1] || "", 10))
    .filter(Number.isInteger);
}

export function answerCitationNumbers(input: GenerateGroundedAnswerInput) {
  return new Set(
    selectAnswerRecords(input.records, input.quotationMatch?.matchedRecordIds)
      .map((item) => item.citationNumber),
  );
}
