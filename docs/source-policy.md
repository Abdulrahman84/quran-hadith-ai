# Source Policy

## Core Rule

The model may compose from retrieved records, but it is never the source of Quran text, tafsir text, hadith text, hadith grades, or provenance.

## Required Answer Shape

Every answer must carry:

- Retrieved source records.
- Citation labels visible to the user.
- Provenance metadata for each quoted or summarized record.
- Limitations when source coverage is incomplete.

## Hadith Rules

- Return grades only when a retrieved source attributes them.
- If no attributed grade is available, keep `grade: null` in the source record and explain the gap.
- Do not infer authenticity from collection name.

## Quran And Tafsir Rules

- Quran text and tafsir excerpts must come from the configured retrieval source.
- Translation edition and tafsir source must remain visible.
- The app must distinguish Quran text, translation, tafsir, and assistant summary.

## Model Rules

- The model receives only the retrieved citation pack and user question.
- The prompt must forbid unsupported claims and source invention.
- The UI must be able to show when the model could not answer from retrieved records.
