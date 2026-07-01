import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

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
    require,
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
          message: {
            content: '{"routes":["tafsir","hadith"],"reason":"The question asks for broad evidence."}',
          },
        }),
      };
    },
    process: {
      env: {
        OLLAMA_ENABLED: "true",
        MCP_TOOL_ROUTER_ENABLED: "true",
        MCP_TOOL_ROUTER_MODEL: "router-model",
      },
    },
  });

  const decision = await planSourceRouteDecision("What evidence is there about patience?");

  assert.equal(decision.planner, "ollama");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.equal(decision.reason, "The question asks for broad evidence.");
  assert.equal(decision.warning, null);
});

test("does not call MCP tools when the AI router returns invalid tools", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: '{"routes":["web_search"],"reason":"unsupported"}',
        },
      }),
    }),
    process: {
      env: {
        OLLAMA_ENABLED: "true",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("Find hadith about intention");

  assert.equal(decision.planner, "ollama");
  assert.deepEqual(Array.from(decision.routes), []);
  assert.match(decision.warning, /invalid route plan/);
});

test("requires the AI router to be enabled before source tools are selected", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    process: {
      env: {
        OLLAMA_ENABLED: "false",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("What sources mention mercy?");

  assert.equal(decision.planner, "ollama");
  assert.deepEqual(Array.from(decision.routes), []);
  assert.match(decision.warning, /router is disabled/i);
});
