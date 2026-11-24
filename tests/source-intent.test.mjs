import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { createTsRequire } from "./helpers/ts-require.mjs";


function loadSourceIntent(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/retrieval/source-intent.ts");
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
    exports: {},
    module: { exports: {} },
    process: { env: {} },
    require: (id) => {
      if (id === "../llm/provider") {
        return {
          completeLlmText: async (input) => {
            if (overrides.process?.env?.MCP_TOOL_ROUTER_ENABLED === "false" || !overrides.process?.env?.OPENROUTER_API_KEY) {
              return {
                status: "disabled",
                error: "OpenRouter is not configured for router.",
                provider: "openrouter",
                model: "google/gemma-4-26b-a4b-it:free",
              };
            }

            const response = await overrides.fetch("https://openrouter.test/api/v1/chat/completions", {
              body: JSON.stringify({
                model: overrides.process?.env?.MCP_TOOL_ROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
                messages: input.messages,
                response_format: input.json ? { type: "json_object" } : undefined,
              }),
            });
            const payload = await response.json();

            return {
              status: "ok",
              text: payload.choices?.[0]?.message?.content || "",
              provider: "openrouter",
              model: overrides.process?.env?.MCP_TOOL_ROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
            };
          },
        };
      }

      return createTsRequire(filename)(id);
    },
    setTimeout,
    clearTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("lets the AI router choose source tools from the approved MCP set", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);

      assert.equal(body.model, "router-model");
      assert.match(body.messages.at(-1).content, /patience/);

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"routes":["tafsir","hadith"],"reason":"The question asks for broad evidence."}',
              },
            },
          ],
        }),
      };
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
        MCP_TOOL_ROUTER_MODEL: "router-model",
      },
    },
  });

  const decision = await planSourceRouteDecision("What evidence is there about patience?");

  assert.equal(decision.planner, "llm");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.equal(decision.reason, "The question asks for broad evidence.");
  assert.equal(decision.warning, null);
});

test("adds both routes for broad Islamic topics when the model is too narrow", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["tafsir"],"reason":"The model chose Quran evidence."}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("ما المصادر عن الصبر؟");

  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
});

test("keeps explicitly Quran-only questions on the tafsir route", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["tafsir"],"reason":"The question asks for tafsir."}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("تفسير آية كل من عليها فان");

  assert.deepEqual(Array.from(decision.routes), ["tafsir"]);
});

test("falls back to both routes when the AI router returns invalid tools", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["web_search"],"reason":"unsupported"}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("What is said about intention?");

  assert.equal(decision.planner, "heuristic");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.match(decision.warning, /invalid route plan/);
});

test("falls back to keyword routing when the AI router is not configured", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    process: {
      env: {
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("What sources mention mercy?");

  assert.equal(decision.planner, "heuristic");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.match(decision.warning, /OpenRouter is not configured/i);
});

test("skips the AI router when the question names its source explicitly", async () => {
  let routerCalls = 0;
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => {
      routerCalls += 1;
      throw new Error("router should not be called");
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const hadithOnly = await planSourceRouteDecision("Find hadith about intention");
  const quranOnly = await planSourceRouteDecision("ما تفسير سورة الإخلاص");

  assert.equal(routerCalls, 0);
  assert.equal(hadithOnly.planner, "heuristic");
  assert.deepEqual(Array.from(hadithOnly.routes), ["hadith"]);
  assert.equal(hadithOnly.warning, null);
  assert.deepEqual(Array.from(quranOnly.routes), ["tafsir"]);
});

test("heuristic routing treats ta marbuta spellings the same", () => {
  const { heuristicSourceRoutes, isExplicitQuranOnlyRequest } = loadSourceIntent();

  assert.equal(isExplicitQuranOnlyRequest("اعرض سورة الكهف"), true);
  assert.equal(isExplicitQuranOnlyRequest("اعرض سوره الكهف"), true);
  assert.deepEqual(Array.from(heuristicSourceRoutes("ما هي الآية التي تتحدث عن الصبر")), ["tafsir"]);
  assert.deepEqual(Array.from(heuristicSourceRoutes("احاديث عن فضل سورة الكهف")), ["hadith"]);
  assert.deepEqual(Array.from(heuristicSourceRoutes("ما حكم الصدقة")), ["tafsir", "hadith"]);
});
