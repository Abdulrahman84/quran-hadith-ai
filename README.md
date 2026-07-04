# quran-hadith-ai

`quran-hadith-ai` is the separate product app for Sanad AI, a citation-first Islamic source assistant.

The app is intentionally separate from `hadith-mcp`. Its job is to orchestrate source layers such as Tafsir MCP and Hadith MCP, retrieve cited records, and let a pluggable language model draft answers only from those retrieved records.

## Product Rules

- Quran, tafsir, and hadith text must come from source retrieval, not model memory.
- Hadith grades must remain source-attributed.
- Missing provenance, missing translation, or missing grade data must be visible to users.
- The app must not issue fatwas, replace scholars, or generate unsupported religious interpretation.
- OpenRouter is the only model provider; source MCPs are the source of truth.

## Local Development

Build the local Hadith MCP first:

```bash
cd /Users/abdulrahman/Projects/hadith-mcp
npm install
npm run build
npm run build:meeatif-sqlite
```

The Quran and tafsir source layer uses the open-source [`tafsircenter/tafsir-mcp`](https://github.com/tafsircenter/tafsir-mcp)
server through local stdio:

```bash
uvx tafsir-mcp
```

On first run it may download its Quran database and cache it under `~/.cache/tafsir-mcp/`. Set `TAFSIR_DB_PATH`
in `.env.local` only if you want to point it at a specific local `quran.db`.

Copy `.env.example` to `.env.local` if your local paths differ. Set `OPENROUTER_API_KEY` before searching; the default test
model is OpenRouter's free `google/gemma-4-26b-a4b-it:free` route:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
ANSWER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-thinking:free
HADITH_QUERY_PLANNER_FALLBACK_MODELS=
```

```bash
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Current Status

This repository contains a Next.js product shell, planning docs, server-side local Tafsir and Hadith MCP retrieval
paths, and an OpenRouter answer layer. The model receives only retrieved source records and is not used as a
source of Quran text, tafsir text, hadith text, grades, or provenance. Tafsir MCP code is MIT licensed; its Quranic data
requires Tafsir Center attribution under CC BY 4.0.

See [docs/product-plan.md](docs/product-plan.md) and [docs/source-policy.md](docs/source-policy.md).
For API-model deployment, see [docs/openrouter-deployment.md](docs/openrouter-deployment.md).
