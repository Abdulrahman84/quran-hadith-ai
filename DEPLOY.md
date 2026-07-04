# Deploying Sanad AI

This app is the product shell. It talks to two source layers at runtime:

- Tafsir MCP for Quran and tafsir retrieval.
- Hadith MCP for hadith retrieval from a local SQLite database.

The app is not a static site because `/api/search` runs server-side MCP clients. Deploy it on a Node.js host or in Docker.

## Recommended Shape

Use one long-running Node.js/Docker service for `quran-hadith-ai`, with the built Hadith MCP repo and SQLite database available on the same filesystem.

Do not deploy this as a serverless/static-only app unless the retrieval layer is rewritten. Hadith MCP currently depends on:

- `node`
- the built `packages/hadith-mcp/dist/cli.js`
- `sqlite3`
- `data/generated/hadith-meeatif.sqlite`

Tafsir MCP currently depends on:

- `uvx`
- the `tafsir-mcp` package
- optional local `TAFSIR_DB_PATH` cache

## Docker

The included `Dockerfile` builds a single image that contains:

- this Next.js app
- a cloned and built `hadith-mcp`
- a generated `hadith-meeatif.sqlite`
- `sqlite3`
- Python and `uvx` for Tafsir MCP

OpenRouter is required at runtime because the model chooses which MCP source tools to call and drafts answers from retrieved records. The model is not the source of Quran, tafsir, hadith, grades, or provenance; it is the tool router and answer-drafting layer.

Build it from this repository:

```bash
docker build \
  --build-arg HADITH_MCP_REPO=https://github.com/Abdulrahman84/hadith-mcp.git \
  --build-arg HADITH_MCP_REF=main \
  -t sanad-ai .
```

Run it:

```bash
docker run --rm -p 3000:3000 \
  -e OPENROUTER_API_KEY=... \
  -e OPENROUTER_SITE_URL=https://your-domain.example \
  sanad-ai
```

You can also pass model overrides such as `OPENROUTER_MODEL`, `ANSWER_MODEL`, `MCP_TOOL_ROUTER_MODEL`, and their matching fallback lists.

Then open:

```text
http://localhost:3000
```

## Free Cloud Deploy on Render

This repo includes `render.yaml` for a free Render web service that builds the Dockerfile.

1. Open <https://dashboard.render.com/select-repo?type=blueprint>.
2. Connect this GitHub repository and select the `main` branch.
3. When Render prompts for `OPENROUTER_API_KEY`, paste the OpenRouter key.
4. Apply the Blueprint.

Render will create a public `onrender.com` URL for the service. The configured service name is `sanad-ai`, so the URL is expected to be similar to:

```text
https://sanad-ai.onrender.com
```

Free Render web services can spin down when idle, so the first request after inactivity can take about a minute.

### Compose

```bash
OPENROUTER_API_KEY=... docker compose up --build
```

The default Compose file passes OpenRouter configuration into the app container. For local smoke testing, set:

```bash
OPENROUTER_SITE_URL=http://localhost:3000
MCP_TOOL_ROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-thinking:free
OPENROUTER_API_KEY=...
docker compose up --build
```

The model is only the answer-drafting layer. Quran, tafsir, hadith text, grades, and provenance still come from the MCP retrieval sources.

The model acts as the source-tool router. It chooses from the approved MCP tools only:

- `tafsir`
- `hadith`
- both

The app validates the model's route plan before calling any MCP. If the model is unavailable or returns an invalid tool, the app does not call MCP tools and returns an explicit router error.

For Hadith MCP, the model also plans search phrases before retrieval. This is important because users ask by topic, while the current Hadith MCP search is lexical. The app asks the model for likely hadith-text phrases first, then uses the literal user wording only as a final fallback.

## VPS Without Docker

Clone both repos side by side:

```bash
mkdir -p /app
cd /app
git clone git@github.com:Abdulrahman84/hadith-mcp.git
git clone git@github.com:Abdulrahman84/quran-hadith-ai.git
```

Build Hadith MCP and its database:

```bash
cd /app/hadith-mcp
npm ci
npm run build
npm run build:meeatif-sqlite
```

Build the product app:

```bash
cd /app/quran-hadith-ai
npm ci
npm run build
```

Create `/app/quran-hadith-ai/.env.production.local`:

```env
HADITH_MCP_COMMAND=node
HADITH_MCP_CWD=/app/hadith-mcp
HADITH_MCP_CLI_PATH=/app/hadith-mcp/packages/hadith-mcp/dist/cli.js
HADITH_MCP_DB_PATH=/app/hadith-mcp/data/generated/hadith-meeatif.sqlite

TAFSIR_MCP_COMMAND=uvx
TAFSIR_MCP_ARGS=tafsir-mcp
# Optional: TAFSIR_DB_PATH=/var/lib/sanad-ai/tafsir/quran.db

OPENROUTER_API_KEY=...
OPENROUTER_MODEL=google/gemma-4-26b-a4b-it:free
OPENROUTER_SITE_URL=https://your-domain.example
OPENROUTER_APP_NAME=Sanad AI
LLM_TIMEOUT_MS=25000
ANSWER_MODEL=google/gemma-4-26b-a4b-it:free
ANSWER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-instruct:free
MCP_TOOL_ROUTER_ENABLED=true
MCP_TOOL_ROUTER_MODEL=liquid/lfm-2.5-1.2b-instruct:free
# Optional: MCP_TOOL_ROUTER_FALLBACK_MODELS=liquid/lfm-2.5-1.2b-thinking:free
# Optional: MCP_TOOL_ROUTER_TIMEOUT_MS=12000
HADITH_QUERY_PLANNER_ENABLED=true
# Optional: HADITH_QUERY_PLANNER_MODEL=google/gemma-4-26b-a4b-it:free
# Optional: HADITH_QUERY_PLANNER_FALLBACK_MODELS=
# Optional: HADITH_QUERY_PLANNER_TIMEOUT_MS=12000
```

Start it:

```bash
npm run start
```

Put nginx, Caddy, or another reverse proxy in front of port `3000` for TLS, request limits, and rate limiting.

## Data Notes

`hadith-meeatif.sqlite` is large and generated. Do not commit it to normal git. For production, use one of these:

- generate it during image build, as the included Dockerfile does
- generate it on the server during deploy
- upload it as a release artifact or mounted volume after confirming data-license policy
- use Git LFS only if you intentionally want the repo to carry that artifact

The source policy should remain visible to users: the app retrieves Quran, tafsir, and hadith records first, then drafts only from retrieved records.

## Preflight Checks

Run these before deploying a new build:

```bash
npm test
npm run typecheck
npm run build
```

For Hadith MCP:

```bash
cd /app/hadith-mcp
npm test
npm run typecheck
npm run build
test -f data/generated/hadith-meeatif.sqlite
```

Production `next build` fetches Google fonts through `next/font/google` at build time. The build environment needs outbound network access unless the app switches to local font files.

## Runtime Smoke Test

After start, verify the API with a hadith query:

```bash
curl -s http://localhost:3000/api/search \
  -H 'content-type: application/json' \
  -d '{"question":"Find hadith on intention with source","language":"english"}'
```

Expected result:

- HTTP `200`
- `records` contains hadith source records
- `provenanceNotes` mentions the SQLite database
