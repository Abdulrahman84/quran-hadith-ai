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
- Local Hadith MCP retrieval through a server-side app route.
- Cited hadith source cards with grades and provenance when available.
- No production answer generation.
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
4. Add Tafsir MCP once the local source server exists.
5. Add model-provider abstraction only after retrieval coverage and citations are stable.
