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
  assert.match(dockerfile, /ENV ANSWER_FALLBACK_MODELS=liquid\/lfm-2\.5-1\.2b-instruct:free/);
  assert.match(dockerfile, /ENV MCP_TOOL_ROUTER_MODEL=/);
  assert.doesNotMatch(dockerfile, /ENV OLLAMA_/);
  assert.match(compose, /OPENROUTER_API_KEY/);
  assert.match(compose, /ANSWER_FALLBACK_MODELS: \$\{ANSWER_FALLBACK_MODELS:-liquid\/lfm-2\.5-1\.2b-instruct:free\}/);
  assert.doesNotMatch(compose, /OLLAMA_/);
  assert.match(render, /runtime: docker/);
  assert.match(render, /plan: free/);
  assert.match(render, /OPENROUTER_API_KEY[\s\S]*sync: false/);
  assert.match(render, /PORT[\s\S]*value: 10000/);
});
