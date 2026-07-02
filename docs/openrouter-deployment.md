# OpenRouter Deployment

This app runs the web server and source MCP processes on your host, while model calls go to OpenRouter.

## Required Secrets

Set these in `.env.local` for local development or in your hosting provider's secret manager:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_SITE_URL=https://your-domain.example
OPENROUTER_APP_NAME=Sanad AI
LLM_TIMEOUT_MS=25000
MCP_TOOL_ROUTER_ENABLED=true
HADITH_QUERY_PLANNER_ENABLED=true
```

The same OpenRouter model is used for routing, hadith query planning, and grounded answer drafting unless you override
`MCP_TOOL_ROUTER_MODEL`, `HADITH_QUERY_PLANNER_MODEL`, or `ANSWER_MODEL`.

## Source MCPs

The source retrieval layer still needs:

- Hadith MCP built locally and pointed at `HADITH_MCP_CLI_PATH`.
- The hadith SQLite dataset at `HADITH_MCP_DB_PATH`.
- Tafsir MCP available through `TAFSIR_MCP_COMMAND` and optional `TAFSIR_DB_PATH`.

Only the web app should be public. Keep database files and MCP processes private to the host.

## Smoke Test

After deploying, run a search for an open-ended topic such as `صفات سيدنا محمد`. The response should include:

- `tafsir` and `hadith` source records when both are relevant.
- Source-attributed references and grades where available.
- No answer if OpenRouter is not configured.
