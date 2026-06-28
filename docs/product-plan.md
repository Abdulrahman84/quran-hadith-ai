# Product Plan

## Objective

Build a public Quran, tafsir, and Sunnah assistant that answers from retrieved, cited source records.

The product app should orchestrate source systems rather than become a source itself:

- Tafsir MCP for Quran and tafsir retrieval.
- Hadith MCP for Sunnah retrieval.
- A pluggable open-source/open-weight or hosted model for answer composition.

## V0 Scope

- Next.js product shell.
- Clear source policy and product boundary.
- Static architecture and flow page.
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
2. Add mocked Tafsir MCP and Hadith MCP adapter interfaces.
3. Build a cited answer UI from mocked retrieved records.
4. Add model-provider abstraction, initially disabled behind fixtures.
5. Add evaluation fixtures for missing citations, missing grades, and unsupported claims.
