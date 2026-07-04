import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadProvider(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/llm/provider.ts");
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const sandbox = {
    AbortController,
    clearTimeout,
    exports: {},
    fetch,
    module: { exports: {} },
    process: { env: {} },
    require,
    setTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("completeLlmText sends OpenRouter chat completions", async () => {
  let requestedUrl = "";
  let requestedHeaders = {};
  let requestedBody = {};
  const { completeLlmText } = loadProvider({
    fetch: async (url, init) => {
      requestedUrl = url;
      requestedHeaders = init.headers;
      requestedBody = JSON.parse(init.body);

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"routes":["tafsir"]}' } }],
        }),
      };
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        OPENROUTER_MODEL: "free-model",
        OPENROUTER_SITE_URL: "http://localhost:3000",
        OPENROUTER_APP_NAME: "Sanad Test",
      },
    },
  });

  const result = await completeLlmText({
    task: "router",
    json: true,
    maxTokens: 80,
    temperature: 0,
    messages: [{ role: "user", content: "route this" }],
  });

  assert.equal(result.status, "ok");
  assert.equal(result.provider, "openrouter");
  assert.equal(requestedUrl, "https://openrouter.ai/api/v1/chat/completions");
  assert.equal(requestedHeaders.Authorization, "Bearer test-key");
  assert.equal(requestedHeaders["HTTP-Referer"], "http://localhost:3000");
  assert.equal(requestedHeaders["X-OpenRouter-Title"], "Sanad Test");
  assert.equal(requestedBody.model, "free-model");
  assert.deepEqual(requestedBody.response_format, { type: "json_object" });
});

test("completeLlmText does not use legacy provider env as fallback providers", async () => {
  const legacyHostedKey = "OPEN" + "AI_API_KEY";
  const legacyLocalEnabledKey = "OLL" + "AMA_ENABLED";
  const legacyLocalModelKey = "OLL" + "AMA_MODEL";
  const legacyLocalProvider = "oll" + "ama";
  const { completeLlmText } = loadProvider({
    fetch: async () => {
      throw new Error("fetch should not be called without OPENROUTER_API_KEY");
    },
    process: {
      env: {
        LLM_PROVIDER: legacyLocalProvider,
        [legacyHostedKey]: "old-hosted-key",
        [legacyLocalEnabledKey]: "true",
        [legacyLocalModelKey]: "old-local-model",
      },
    },
  });

  const result = await completeLlmText({
    task: "router",
    json: true,
    maxTokens: 80,
    temperature: 0,
    messages: [{ role: "user", content: "route this" }],
  });

  assert.equal(result.status, "disabled");
  assert.equal(result.provider, "openrouter");
  assert.match(result.error, /OpenRouter is not configured/);
});

test("completeLlmText retries router fallback models when the configured router model is unavailable", async () => {
  const requestedModels = [];
  const { completeLlmText } = loadProvider({
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      requestedModels.push(body.model);

      if (body.model === "router-primary") {
        return {
          ok: false,
          status: 429,
          json: async () => ({
            error: { message: "router-primary is temporarily rate-limited upstream." },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"routes":["tafsir"],"reason":"fallback"}' } }],
        }),
      };
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_MODEL: "router-primary",
        MCP_TOOL_ROUTER_FALLBACK_MODELS: "router-fallback",
      },
    },
  });

  const result = await completeLlmText({
    task: "router",
    json: true,
    maxTokens: 80,
    temperature: 0,
    messages: [{ role: "user", content: "route this" }],
  });

  assert.equal(result.status, "ok");
  assert.equal(result.model, "router-fallback");
  assert.deepEqual(requestedModels, ["router-primary", "router-fallback"]);
});
