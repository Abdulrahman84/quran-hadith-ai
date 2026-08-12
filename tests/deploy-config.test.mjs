import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function read(filename) {
  return fs.readFileSync(path.join(process.cwd(), filename), "utf8");
}

test("Docker runtime config exposes OpenRouter env instead of legacy Ollama routing", () => {
  const dockerfile = read("Dockerfile");
  const compose = read("docker-compose.yml");
  const render = read("render.yaml");

  assert.match(dockerfile, /ENV OPENROUTER_MODEL=/);
  assert.match(dockerfile, /ENV OPENROUTER_APP_NAME="Sanad AI"/);
  assert.match(dockerfile, /ENV OPENROUTER_MODEL=google\/gemini-3\.5-flash-lite/);
  assert.match(dockerfile, /ENV ANSWER_FALLBACK_MODELS=mistralai\/mistral-small-2603/);
  assert.match(dockerfile, /ENV MCP_TOOL_ROUTER_MODEL=/);
  assert.doesNotMatch(dockerfile, /ENV OLLAMA_/);
  assert.match(compose, /OPENROUTER_API_KEY/);
  assert.match(compose, /OPENROUTER_MANAGEMENT_KEY/);
  assert.match(compose, /NTFY_TOPIC/);
  assert.match(compose, /ANSWER_FALLBACK_MODELS: \$\{ANSWER_FALLBACK_MODELS:-mistralai\/mistral-small-2603\}/);
  assert.match(render, /OPENROUTER_MODEL[\s\S]*google\/gemini-3\.5-flash-lite/);
  assert.doesNotMatch(compose, /OLLAMA_/);
  assert.match(render, /runtime: docker/);
  assert.match(render, /plan: free/);
  assert.match(render, /OPENROUTER_API_KEY[\s\S]*sync: false/);
  assert.match(render, /OPENROUTER_MANAGEMENT_KEY[\s\S]*sync: false/);
  assert.match(render, /NTFY_TOPIC[\s\S]*sync: false/);
  assert.match(render, /PORT[\s\S]*value: 10000/);
});

test("Docker image bundles a pinned and verified Tafsir MCP runtime", () => {
  const dockerfile = read("Dockerfile");
  const smokeTest = read("scripts/smoke-tafsir-mcp.mjs");

  assert.match(dockerfile, /FROM python:3\.12-slim-bookworm AS tafsir/);
  assert.match(dockerfile, /TAFSIR_MCP_VERSION=1\.0\.0/);
  assert.match(dockerfile, /TAFSIR_PYTHON_MCP_VERSION=1\.28\.1/);
  assert.match(dockerfile, /"mcp\[cli\]==\$TAFSIR_PYTHON_MCP_VERSION"/);
  assert.match(dockerfile, /TAFSIR_DB_SHA256=10e61f615ab5e6a3440e8ecc8ba1dc2273d12cd9048752760fe53a44d191cc27/);
  assert.match(dockerfile, /TAFSIR_MCP_COMMAND=\/opt\/tafsir-mcp\/bin\/python/);
  assert.match(dockerfile, /TAFSIR_DB_PATH=\/opt\/tafsir-data\/quran\.db/);
  assert.doesNotMatch(dockerfile, /TAFSIR_MCP_COMMAND=uvx/);
  assert.match(dockerfile, /PRAGMA journal_mode=DELETE/);
  assert.match(dockerfile, /PRAGMA quick_check/);
  assert.match(dockerfile, /RUN node scripts\/smoke-tafsir-mcp\.mjs/);
  assert.match(smokeTest, /client\.listTools\(\)/);
  assert.match(smokeTest, /name: "fetch_ayah"/);
});
