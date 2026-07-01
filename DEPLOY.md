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

Ollama is required at runtime because the model chooses which MCP source tools to call. The model is not the source of Quran, tafsir, hadith, grades, or provenance; it is the tool router and answer-drafting layer.

Build it from this repository:

```bash
docker build \
  --build-arg HADITH_MCP_REPO=https://github.com/Abdulrahman84/hadith-mcp.git \
  --build-arg HADITH_MCP_REF=main \
  -t sanad-ai .
```

Run it:

```bash
docker run --rm -p 3000:3000 sanad-ai
```

The plain `docker run` form expects Ollama to be reachable through the container environment. Compose is easier for local use.

Then open:

```text
http://localhost:3000
```

### Compose

```bash
docker compose up --build
```

The default Compose file expects Ollama on the host machine, using `http://host.docker.internal:11434`.

Start Ollama on the host and pull a model:

```bash
ollama pull qwen2.5-coder:7b
```

Then run:

```bash
docker compose up --build
```

To run an open-weight model in Docker too, use the Ollama override:

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up --build
```

Then pull the model once:

```bash
docker compose -f docker-compose.yml -f docker-compose.ollama.yml exec ollama ollama pull qwen2.5-coder:7b
```

You can switch models by setting `OLLAMA_MODEL`:

```bash
OLLAMA_MODEL=llama3.1:8b docker compose -f docker-compose.yml -f docker-compose.ollama.yml up --build
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

OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5-coder:7b
MCP_TOOL_ROUTER_ENABLED=true
# Optional: MCP_TOOL_ROUTER_MODEL=qwen2.5-coder:7b
HADITH_QUERY_PLANNER_ENABLED=true
# Optional: HADITH_QUERY_PLANNER_MODEL=qwen2.5-coder:7b
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
