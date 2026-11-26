# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS app

WORKDIR /app
ARG NEXT_PUBLIC_CONVEX_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS hadith

ARG HADITH_MCP_REPO=https://github.com/Abdulrahman84/hadith-mcp.git
# A commit, not a branch: a branch name keeps the cached clone after the branch moves, so builds
# could ship an old Hadith MCP. Bump it to deploy a newer one.
ARG HADITH_MCP_REF=37f823d576ccf31951593ea573b30aa9cb2c6d5d
# Prebuilt embedding index for semantic_search_hadith (see docs/openrouter-deployment.md).
# Leave the URL empty to skip it; hybrid search then falls back to full-text search.
ARG HADITH_EMBEDDINGS_URL=https://github.com/Abdulrahman84/hadith-mcp/releases/download/embeddings-bge-m3-v1/hadith-embeddings-bge-m3.sqlite
ARG HADITH_EMBEDDINGS_SHA256=f8a5cec476bccd38068491a6bf5259c8bbd217ba97965d5b009bd774417b3a36
ARG HADITH_EMBEDDINGS_INDEX_MODEL=bge-m3

WORKDIR /opt

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git sqlite3 \
  && rm -rf /var/lib/apt/lists/*

RUN git init -q /opt/hadith-mcp \
  && git -C /opt/hadith-mcp fetch -q --depth 1 "$HADITH_MCP_REPO" "$HADITH_MCP_REF" \
  && git -C /opt/hadith-mcp checkout -q FETCH_HEAD

WORKDIR /opt/hadith-mcp
RUN npm ci
RUN npm run build
RUN npm run build:meeatif-sqlite
# Download the index, verify its checksum, then check it covers the database built above.
RUN if [ -n "$HADITH_EMBEDDINGS_URL" ]; then \
    test -n "$HADITH_EMBEDDINGS_SHA256" \
    && curl -fsSL --retry 3 -o data/generated/hadith-embeddings.sqlite "$HADITH_EMBEDDINGS_URL" \
    && echo "$HADITH_EMBEDDINGS_SHA256  data/generated/hadith-embeddings.sqlite" | sha256sum -c - \
    && EMBEDDINGS_INDEX_MODEL="$HADITH_EMBEDDINGS_INDEX_MODEL" node packages/hadith-mcp/dist/build-embeddings.js --check \
      --db data/generated/hadith-meeatif.sqlite --out data/generated/hadith-embeddings.sqlite; \
  fi
RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM python:3.12-slim-bookworm AS tafsir

ARG TAFSIR_MCP_VERSION=1.0.0
ARG TAFSIR_PYTHON_MCP_VERSION=1.28.1
ARG TAFSIR_DB_SHA256=10e61f615ab5e6a3440e8ecc8ba1dc2273d12cd9048752760fe53a44d191cc27

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/tafsir-mcp
RUN /opt/tafsir-mcp/bin/pip install --no-cache-dir \
  "mcp[cli]==$TAFSIR_PYTHON_MCP_VERSION" \
  "tafsir-mcp==$TAFSIR_MCP_VERSION"
RUN /opt/tafsir-mcp/bin/python -c "from tafsir.data_loader import get_db_path; print(get_db_path())"
RUN cd /root/.cache/tafsir-mcp \
  && echo "$TAFSIR_DB_SHA256  quran.db" | sha256sum -c - \
  && test "$(sqlite3 quran.db 'PRAGMA quick_check;')" = "ok"
RUN mkdir -p /opt/tafsir-data \
  && cp /root/.cache/tafsir-mcp/quran.db /opt/tafsir-data/quran.db \
  && test "$(sqlite3 /opt/tafsir-data/quran.db 'PRAGMA journal_mode=DELETE;')" = "delete" \
  && test "$(sqlite3 /opt/tafsir-data/quran.db 'PRAGMA quick_check;')" = "ok"

FROM node:22-bookworm-slim AS quran-index

# Prebuilt Quran embedding index for hybrid Quran search (see docs/openrouter-deployment.md).
# Leave the URL empty to skip it; Quran search then stays keyword-only.
ARG QURAN_EMBEDDINGS_URL=https://github.com/Abdulrahman84/quran-hadith-ai/releases/download/quran-embeddings-bge-m3-v1/quran-embeddings-bge-m3.bin
ARG QURAN_EMBEDDINGS_SHA256=a4963fcb6104874b2893f916cfb91dc061ff6b5750f8523bd31a0db68ceb77d0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/quran-index \
  && if [ -n "$QURAN_EMBEDDINGS_URL" ]; then \
    test -n "$QURAN_EMBEDDINGS_SHA256" \
    && curl -fsSL --retry 3 -o /opt/quran-index/quran-embeddings-bge-m3.bin "$QURAN_EMBEDDINGS_URL" \
    && echo "$QURAN_EMBEDDINGS_SHA256  /opt/quran-index/quran-embeddings-bge-m3.bin" | sha256sum -c -; \
  fi

FROM python:3.12-slim-bookworm AS runner

WORKDIR /app

ARG NEXT_PUBLIC_CONVEX_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENV HADITH_MCP_COMMAND=node
ENV HADITH_MCP_CWD=/opt/hadith-mcp
ENV HADITH_MCP_CLI_PATH=/opt/hadith-mcp/packages/hadith-mcp/dist/cli.js
ENV HADITH_MCP_DB_PATH=/opt/hadith-mcp/data/generated/hadith-meeatif.sqlite
ENV HADITH_MCP_EMBEDDINGS_PATH=/opt/hadith-mcp/data/generated/hadith-embeddings.sqlite
# Hybrid hadith search defaults, also set in render.yaml. The embeddings key falls back to
# OPENROUTER_API_KEY for the OpenRouter base URL.
ENV HADITH_SEARCH_MODE=hybrid
ENV EMBEDDINGS_PROVIDER=openai
ENV EMBEDDINGS_BASE_URL=https://openrouter.ai/api/v1
ENV EMBEDDINGS_MODEL=baai/bge-m3
ENV EMBEDDINGS_INDEX_MODEL=bge-m3
ENV EMBEDDINGS_TIMEOUT_MS=8000

ENV TAFSIR_MCP_COMMAND=/opt/tafsir-mcp/bin/python
ENV TAFSIR_MCP_ARGS="-m tafsir.server"
ENV TAFSIR_DB_PATH=/opt/tafsir-data/quran.db
# Hybrid Quran search: the index above, queried with the same EMBEDDINGS_* settings as hadith.
ENV QURAN_SEARCH_MODE=hybrid
ENV QURAN_EMBEDDINGS_PATH=/opt/quran-index/quran-embeddings-bge-m3.bin

ENV OPENROUTER_MODEL=google/gemini-3.5-flash-lite
ENV OPENROUTER_APP_NAME="Sanad AI"
ENV ANSWER_FALLBACK_MODELS=mistralai/mistral-small-2603
ENV MCP_TOOL_ROUTER_ENABLED=true
ENV MCP_TOOL_ROUTER_MODEL=google/gemini-3.5-flash-lite
ENV MCP_TOOL_ROUTER_FALLBACK_MODELS=mistralai/mistral-small-2603
ENV HADITH_QUERY_PLANNER_ENABLED=true
ENV HADITH_QUERY_PLANNER_MODEL=google/gemini-3.5-flash-lite

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates libstdc++6 sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=app /usr/local/bin/node /usr/local/bin/node
COPY --from=app /app/package.json /app/package-lock.json ./
COPY --from=app /app/node_modules ./node_modules
COPY --from=app /app/.next ./.next
COPY --from=app /app/public ./public
COPY --from=app /app/next.config.ts ./next.config.ts
COPY --from=app /app/scripts/smoke-tafsir-mcp.mjs ./scripts/smoke-tafsir-mcp.mjs
COPY --from=app /app/scripts/quran-embeddings.mjs ./scripts/quran-embeddings.mjs

COPY --from=hadith /opt/hadith-mcp /opt/hadith-mcp
COPY --from=tafsir /opt/tafsir-mcp /opt/tafsir-mcp
COPY --from=tafsir /opt/tafsir-data /opt/tafsir-data
COPY --from=quran-index /opt/quran-index /opt/quran-index

RUN node --version
RUN test "$(sqlite3 "$TAFSIR_DB_PATH" 'PRAGMA quick_check;')" = "ok"
RUN node scripts/smoke-tafsir-mcp.mjs
# The downloaded index must match this quran.db (same ayahs, same embedded text) and EMBEDDINGS_INDEX_MODEL.
RUN if [ -f "$QURAN_EMBEDDINGS_PATH" ]; then \
    node scripts/quran-embeddings.mjs check --db "$TAFSIR_DB_PATH" --index "$QURAN_EMBEDDINGS_PATH"; \
  fi

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
