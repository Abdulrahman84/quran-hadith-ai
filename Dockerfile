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
ARG HADITH_MCP_REF=main

WORKDIR /opt

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git sqlite3 \
  && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "$HADITH_MCP_REF" "$HADITH_MCP_REPO" /opt/hadith-mcp

WORKDIR /opt/hadith-mcp
RUN npm ci
RUN npm run build
RUN npm run build:meeatif-sqlite
RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM node:22-bookworm-slim AS runner

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

ENV TAFSIR_MCP_COMMAND=uvx
ENV TAFSIR_MCP_ARGS=tafsir-mcp

ENV OPENROUTER_MODEL=google/gemini-3.1-flash-lite
ENV OPENROUTER_APP_NAME="Sanad AI"
ENV ANSWER_FALLBACK_MODELS=mistralai/mistral-small-2603
ENV MCP_TOOL_ROUTER_ENABLED=true
ENV MCP_TOOL_ROUTER_MODEL=google/gemini-3.1-flash-lite
ENV MCP_TOOL_ROUTER_FALLBACK_MODELS=mistralai/mistral-small-2603
ENV HADITH_QUERY_PLANNER_ENABLED=true
ENV HADITH_QUERY_PLANNER_MODEL=google/gemini-3.1-flash-lite

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates sqlite3 python3 python3-pip python3-venv \
  && python3 -m pip install --break-system-packages --no-cache-dir uv \
  && rm -rf /var/lib/apt/lists/*

COPY --from=app /app/package.json /app/package-lock.json ./
COPY --from=app /app/node_modules ./node_modules
COPY --from=app /app/.next ./.next
COPY --from=app /app/public ./public
COPY --from=app /app/next.config.ts ./next.config.ts

COPY --from=hadith /opt/hadith-mcp /opt/hadith-mcp

EXPOSE 3000

CMD ["npm", "run", "start"]
