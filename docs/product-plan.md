# Product Plan

## Objective

Build a public Quran, tafsir, and Sunnah assistant that answers from retrieved, cited source records.

The product app should orchestrate source systems rather than become a source itself:

- Tafsir MCP for Quran and tafsir retrieval.
- Hadith MCP for Sunnah retrieval.
- A pluggable open-source/open-weight or hosted model for answer composition.

## V1 Scope

- Next.js product shell.
- Clear source policy and product boundary.
- Local Tafsir MCP and Hadith MCP retrieval through a server-side app route.
- Cited Quran, tafsir, and hadith source cards with grades and provenance when available.
- OpenRouter answer composition from retrieved source records only.
- No bundled Quran, tafsir, or hadith data.

## Future Architecture

```text
User question
  -> intent and source routing
  -> Tafsir MCP and/or Hadith MCP retrieval
  -> citation pack
  -> model drafting with strict retrieved context
  -> answer UI with cited passages and visible limitations
```

## Non-Goals

- No fatwa or legal-ruling workflow.
- No model-generated Quran text, hadith text, grades, or source claims.
- No hidden provenance.
- No merging source licenses into the app code license.

## First Implementation Milestones

1. Define the retrieval result contract shared by source adapters.
2. Connect the product app to local Hadith MCP over stdio.
3. Build a cited source-record UI from real Hadith MCP retrieval.
4. Add conservative query understanding so natural requests become useful source searches.
5. Add an OpenRouter composition layer that can only summarize retrieved records.
6. Add Tafsir MCP over local stdio for Quran and tafsir retrieval.
7. Keep the model boundary provider-specific until there is a product reason to add another provider.
