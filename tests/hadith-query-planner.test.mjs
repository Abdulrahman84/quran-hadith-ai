import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpileSource(filename) {
  return ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
}

function loadQueryPlannerModule() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/query-planner.ts");
  const sandbox = {
    exports: {},
    module: { exports: {} },
    require,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpileSource(filename), sandbox, { filename });

  return sandbox.module.exports;
}

function loadHadithQueryPlanner(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/retrieval/hadith-query-planner.ts");
  const sandbox = {
    AbortController,
    clearTimeout,
    exports: {},
    fetch,
    module: { exports: {} },
    process: { env: {} },
    require: (id) => {
      if (id === "./query-planner") {
        return loadQueryPlannerModule();
      }

      return require(id);
    },
    setTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpileSource(filename), sandbox, { filename });

  return sandbox.module.exports;
}

test("hadith query planner tries curated fallback phrases before AI phrases", async () => {
  const { planHadithRetrievalQueries } = loadHadithQueryPlanner({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: '{"queries":["ليس كمثله شيء"]}',
        },
      }),
    }),
    process: {
      env: {
        OLLAMA_ENABLED: "true",
        HADITH_QUERY_PLANNER_ENABLED: "true",
      },
    },
  });

  const plan = await planHadithRetrievalQueries("صفات سيدنا محمد", "arabic", "صفات سيدنا محمد");

  assert.deepEqual(Array.from(plan.queries.slice(0, 3)), ["ليس بالطويل", "ربعة من القوم", "كان رسول الله ربعة"]);
  assert.ok(plan.queries.indexOf("ليس كمثله شيء") > plan.queries.indexOf("صفات سيدنا محمد"));
});
