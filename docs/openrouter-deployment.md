# OpenRouter Deployment

This app runs the web server and source MCP processes on your host, while model calls go to OpenRouter.

## Required Secrets

Set these in `.env.local` for local development or in your hosting provider's secret manager:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MANAGEMENT_KEY=...
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_SITE_URL=https://your-domain.example
OPENROUTER_APP_NAME=Sanad AI
LLM_TIMEOUT_MS=25000
ANSWER_MODEL=google/gemma-4-26b-a4b-it:free
ANSWER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_ENABLED=true
MCP_TOOL_ROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-thinking:free
HADITH_QUERY_PLANNER_ENABLED=true
HADITH_QUERY_PLANNER_MODEL=google/gemma-4-26b-a4b-it:free
HADITH_QUERY_PLANNER_FALLBACK_MODELS=
NTFY_TOPIC=use-a-long-random-private-topic
NTFY_BASE_URL=https://ntfy.sh
NTFY_ACCESS_TOKEN=
OPENROUTER_LOW_CREDIT_USD=1
OPENROUTER_CREDIT_CHECK_INTERVAL_MS=900000
CREDIT_ALERT_TIMEOUT_MS=4000
```

The same OpenRouter model is used for routing, hadith query planning, and grounded answer drafting unless you override
`MCP_TOOL_ROUTER_MODEL`, `HADITH_QUERY_PLANNER_MODEL`, or `ANSWER_MODEL`. If a configured model is temporarily
rate-limited or unavailable, the matching fallback list is tried from left to right:
`MCP_TOOL_ROUTER_FALLBACK_MODELS`, `HADITH_QUERY_PLANNER_FALLBACK_MODELS`, or `ANSWER_FALLBACK_MODELS`.

## Source MCPs

The source retrieval layer still needs:

- Hadith MCP built locally and pointed at `HADITH_MCP_CLI_PATH`.
- The hadith SQLite dataset at `HADITH_MCP_DB_PATH`.
- Tafsir MCP available through `TAFSIR_MCP_COMMAND` and optional `TAFSIR_DB_PATH`.

Only the web app should be public. Keep database files and MCP processes private to the host.

## Mobile Credit Alerts

Install the ntfy app on iOS or Android, subscribe to the exact value configured in `NTFY_TOPIC`, and allow phone
notifications. Public `ntfy.sh` topics can be read or published by anyone who guesses the topic name, so use a long,
random value or reserve a private topic and configure its token in `NTFY_ACCESS_TOKEN`.

An OpenRouter HTTP 402 response triggers an urgent notification using only the normal inference key. Add a separate
`OPENROUTER_MANAGEMENT_KEY` to also check the account balance during app traffic and warn when it reaches
`OPENROUTER_LOW_CREDIT_USD`. The management key is sent only to OpenRouter's official credits endpoint and cannot be
used for model inference.

Checks are opportunistic and run no more than once per configured interval while the app receives traffic. They are
not a background schedule: if another application spends the balance while Sanad AI is idle, the alert arrives on the
next Sanad AI request. Deploys, restarts, or multiple server instances can also cause an occasional duplicate alert.

## Smoke Test

After deploying, run a search for an open-ended topic such as `صفات سيدنا محمد`. The response should include:

- `tafsir` and `hadith` source records when both are relevant.
- Source-attributed references and grades where available.
- No answer if OpenRouter is not configured.
