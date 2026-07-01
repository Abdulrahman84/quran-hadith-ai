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
- If Tafsir MCP is unavailable, the UI must show the retrieval warning and must not synthesize Quran or tafsir text.
- Tafsir MCP Quranic data attribution to Tafsir Center must remain visible in provenance or documentation.

## Model Rules

- The model receives only the retrieved citation pack and user question.
- The prompt must forbid unsupported claims and source invention.
- The UI must be able to show when the model could not answer from retrieved records.
- If retrieval returns no records, the model must not draft an answer.
- Query understanding may rewrite a user request into a source-search phrase, but it must not create source text,
  grades, or provenance.
