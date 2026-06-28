# quran-hadith-ai

`quran-hadith-ai` is the separate product app for Sanad AI, a citation-first Islamic source assistant.

The app is intentionally separate from `hadith-mcp`. Its job is to orchestrate source layers such as Tafsir MCP and Hadith MCP, retrieve cited records, and let a pluggable language model draft answers only from those retrieved records.

## Product Rules

- Quran, tafsir, and hadith text must come from source retrieval, not model memory.
- Hadith grades must remain source-attributed.
- Missing provenance, missing translation, or missing grade data must be visible to users.
- The app must not issue fatwas, replace scholars, or generate unsupported religious interpretation.
- The model provider should be replaceable; source MCPs are the source of truth.

## Local Development

Build the local Hadith MCP first:

```bash
cd /Users/abdulrahman/Projects/hadith-mcp
npm install
npm run build
npm run build:meeatif-sqlite
```

Copy `.env.example` to `.env.local` if your local paths differ.

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Current Status

This repository contains a Next.js product shell, planning docs, and a server-side local Hadith MCP retrieval path. It
does not yet connect to Tafsir MCP or any model provider.

See [docs/product-plan.md](docs/product-plan.md) and [docs/source-policy.md](docs/source-policy.md).
