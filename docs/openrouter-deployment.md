# OpenRouter Deployment

This app runs the web server and source MCP processes on your host, while model calls go to OpenRouter.

## Required Secrets

Set these in `.env.local` for local development or in your hosting provider's secret manager:

```bash
OPENROUTER_API_KEY=...
OPENROUTER_MANAGEMENT_KEY=...
OPENROUTER_MODEL=google/gemini-3.5-flash-lite
OPENROUTER_SITE_URL=https://your-domain.example
OPENROUTER_APP_NAME=Sanad AI
LLM_TIMEOUT_MS=25000
ANSWER_MODEL=google/gemini-3.5-flash-lite
ANSWER_FALLBACK_MODELS=mistralai/mistral-small-2603
MCP_TOOL_ROUTER_ENABLED=true
MCP_TOOL_ROUTER_MODEL=google/gemini-3.5-flash-lite
MCP_TOOL_ROUTER_FALLBACK_MODELS=mistralai/mistral-small-2603
HADITH_QUERY_PLANNER_ENABLED=true
HADITH_QUERY_PLANNER_MODEL=google/gemini-3.5-flash-lite
HADITH_QUERY_PLANNER_FALLBACK_MODELS=mistralai/mistral-small-2603
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

### Hybrid hadith search (optional)

`HADITH_SEARCH_MODE=hybrid` adds one `semantic_search_hadith` call per hadith search. Hadith MCP runs it on the user's
question and merges full-text and embedding-similarity results on its side. The app then fuses that list with the
reranked lexical results using reciprocal rank fusion (k=60). It needs a Hadith MCP build that has the tool, the
embedding index from `npm run build:embeddings` in that repo, and the same embedding model to embed queries:

```bash
HADITH_SEARCH_MODE=hybrid
HADITH_MCP_EMBEDDINGS_PATH=/opt/hadith-mcp/data/generated/hadith-embeddings.sqlite
# Production (render.yaml): embed queries with bge-m3 through OpenRouter.
EMBEDDINGS_PROVIDER=openai
EMBEDDINGS_BASE_URL=https://openrouter.ai/api/v1
EMBEDDINGS_MODEL=baai/bge-m3
EMBEDDINGS_INDEX_MODEL=bge-m3   # the name the index was built under with Ollama
EMBEDDINGS_TIMEOUT_MS=8000
# EMBEDDINGS_API_KEY defaults to OPENROUTER_API_KEY for an openrouter.ai base URL only.
# Local development with Ollama instead:
# OLLAMA_URL=http://127.0.0.1:11434
# EMBEDDINGS_MODEL=bge-m3
```

OpenRouter's `baai/bge-m3` returns the same vectors as Ollama's `bge-m3` (cosine similarity 0.99999 on sample texts),
so the index built locally with Ollama works with OpenRouter query embeddings. A query is about 20 tokens at
$0.01 per million tokens.

**The index in the Docker image.** The image builds the hadith database itself, but the 157 MB embedding index is
downloaded during the build, so a deploy doesn't wait about 20 minutes for it to be embedded again. The `hadith`
stage reads three build args:

- `HADITH_EMBEDDINGS_URL`: where to download the index. It defaults to the `embeddings-bge-m3-v1` release asset of
  `hadith-mcp`. Set it to empty to skip the download; hybrid search then falls back to full-text.
- `HADITH_EMBEDDINGS_SHA256`: the file's checksum. It's required when the URL is set, and a mismatch fails the build.
- `HADITH_EMBEDDINGS_INDEX_MODEL` (default `bge-m3`).

After the download, the build runs `build-embeddings.js --check`. If more than 1% of the freshly built hadith
database has no current vector, the build fails, and Render keeps the previous deploy. That catches a stale index
after the hadith data changes. To refresh the index, rebuild it with `npm run build:embeddings` in `hadith-mcp`,
upload it as a new release asset, and update the URL and checksum.

Qwen3-Embedding-8B (`EMBEDDINGS_QUERY_PREFIX`, `EMBEDDINGS_DIMENSIONS=1024`, `EMBEDDINGS_PROVIDER_ORDER`) scored a
little higher than bge-m3 when the hadith server was queried directly. But through OpenRouter its query embeddings
regularly took more than 8 seconds (November 2026), so searches fell back to full-text, and it scored lower in the
full app. bge-m3 stays the default until that changes.

The index adds about 140 MB of memory to the Hadith MCP process. That is a large part of a 512 MB free instance, so
watch memory after enabling hybrid search.

The app only passes these variables to the Hadith MCP process in hybrid mode. If the tool, index or embedding provider
is unavailable, search falls back to lexical results and adds a provenance note, so the flag is safe to turn on early.
On the 58-question benchmark (`eval/`), hybrid raised recall@5 from 77.6% to 87.9% overall, and from 77.8% to 94.4%
on hadith questions. The gains are biggest on paraphrased, topical and English questions about Arabic-only wording.

### Hybrid Quran search (optional)

Quran and tafsir come from the third-party Tafsir MCP, which only offers keyword search, so the vector side lives in
the app. `QURAN_SEARCH_MODE=hybrid` loads an embedding index with one vector per ayah (6,236 vectors, 25.6 MB) and,
for every question that goes to the Quran, finds the ayahs nearest to the user's question by cosine similarity.
That list is fused with the Tafsir MCP keyword results by reciprocal rank fusion (k=60), the keyword list first so
it wins ties. Dialect and Arabizi questions still benefit from the Fusha rewrite, because the keyword search
searches it.

- Each ayah's vector embeds the ayah text followed by its Al-Muyassar tafsir, so a topical or English question has
  modern wording to match, not only Quranic phrasing.
- The embedding search can add up to 5 ayahs that the keyword search missed. The app fetches each through Tafsir MCP
  (`fetch_ayah` and `fetch_tafsir`), so every record still comes from the MCP. It never removes a keyword match.
- A verse named by reference (`2:255`) is fetched directly, as before, without vector results.
- Verbatim quotes still rank first: the source router's quote ordering runs after fusion.
- The question is embedded once the router sends it to the Quran, while the keyword search runs. The keyword
  search waits for it until 2 s after it started (`QURAN_VECTOR_WAIT_MS`) and then goes on without it. On a small
  production instance the keyword search usually takes longer than the embedding, so it rarely waits; locally a
  fast keyword search waits for the embedding, usually 0.4 to 0.9 s. Hadith-only questions make no extra call.

```bash
QURAN_SEARCH_MODE=hybrid
QURAN_EMBEDDINGS_PATH=/opt/quran-index/quran-embeddings-bge-m3.bin
# QURAN_VECTOR_WAIT_MS=2000
# Uses the same EMBEDDINGS_* settings as hybrid hadith search (bge-m3, OpenRouter in production).
```

Query embeddings use the same `EMBEDDINGS_*` settings, model and index model name as hadith. The hadith query
embedding is made inside the Hadith MCP process and isn't returned, so the app embeds the question once more for
the Quran index: one more bge-m3 call of about 20 tokens. Only the question is embedded, not its rewrite, because
OpenRouter serves parallel bge-m3 calls more slowly (about 0.5 s alone, 1 to 2 s with three others in flight), and
that also slows the hadith search's own embedding calls. If the index file, the embedding API or the model name is
missing or wrong, or the embedding misses the wait, Quran search stays keyword-only and adds a provenance note.

**Building the index.** `node scripts/quran-embeddings.mjs build` reads `~/.cache/tafsir-mcp/quran.db` (or
`TAFSIR_DB_PATH`), embeds every ayah with local Ollama `bge-m3` (about 3 minutes on a laptop) and writes
`quran-embeddings-bge-m3.bin` next to the database. The file header records the model, the text recipe, the
database checksum and a hash of every embedded text. `node scripts/quran-embeddings.mjs check` recomputes that hash
from a `quran.db` and fails if the ayahs or their text differ.

**The index in the Docker image.** The `quran-index` stage downloads the index from the `quran-embeddings-bge-m3-v1`
release of this repository and verifies its checksum (`QURAN_EMBEDDINGS_URL`, `QURAN_EMBEDDINGS_SHA256`). The
runner stage then runs `quran-embeddings.mjs check` against the bundled `quran.db`, so a Tafsir MCP data change
fails the build instead of serving a stale index. Set `QURAN_EMBEDDINGS_URL` to empty to skip the index; Quran
search then stays keyword-only. To refresh it, rebuild the index, upload it as a new release asset, and update the
URL and checksum. The Quranic text and Al-Muyassar tafsir in it are from the Tafsir Center for Quranic Studies,
licensed CC BY 4.0, and the release notes carry that attribution.

The index adds about 26 MB to the web app's memory. The scan over all ayahs takes a few milliseconds per question.

On the 24 Quran questions of the benchmark (`eval/`, three runs of each mode, one question at a time, hybrid hadith
search on in both), hybrid Quran search raised recall@5 from 84.7% to 93.1% and MRR from 0.787 to 0.876. Recall@1 went
from 76.4% to 81.9%. The gains are on English and paraphrased questions whose wording the Arabic keyword search can't
match ("there is no compulsion in religion", "which verse made fasting obligatory"). Exact quotes stayed at 28 of 30
in both modes; the one miss is a misspelled quote that the router sometimes sends to hadith first. Mean latency for
those questions rose from 1.8 s to 2.3 s, mostly the wait for the embedding when the keyword search finishes first.

## Rate Limits and Caching

`/api/search` and `/api/check` limit each client IP, using the first `X-Forwarded-For` hop, then `X-Real-IP`.
Over the limit they return HTTP 429 with a `Retry-After` header and the warning code `rate_limited`.

```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=10
RATE_LIMIT_PER_DAY=200
# Optional cost backstop: total model-backed requests per day for the whole instance.
GLOBAL_DAILY_REQUEST_CAP=
SEARCH_CACHE_TTL_MS=21600000
SEARCH_CACHE_MAX_ENTRIES=500
```

Answers that completed with a ready grounded answer are cached by normalized question, language and source filters.
A cache hit still counts against the client's limit but not against `GLOBAL_DAILY_REQUEST_CAP`, and it is still
recorded in the dashboard. Set `SEARCH_CACHE_TTL_MS=0` to turn caching off.

Limits and cache live in server memory, so they reset on restart and each instance keeps its own counts.

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
