import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadQueryPlanner() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/query-planner.ts");
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
    exports: {},
    module: { exports: {} },
    require,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("Arabic query planning preserves Quranic connector words", () => {
  const { planRetrievalQuery } = loadQueryPlanner();

  assert.equal(planRetrievalQuery("تفسير آية كل من عليها فان", "arabic").retrievalQuery, "كل من عليها فان");
});

test("English query planning does not strip normal prepositions", () => {
  const { planRetrievalQuery } = loadQueryPlanner();

  assert.equal(planRetrievalQuery("find hadith about mercy for children", "english").retrievalQuery, "about mercy for children");
});

test("Arabic hadith planning expands Prophet trait questions before raw tokens", () => {
  const { planHadithSearchQueries } = loadQueryPlanner();

  assert.deepEqual(Array.from(planHadithSearchQueries("صفات سيدنا محمد", "arabic")), [
    "خلق رسول الله",
    "كان رسول الله",
    "كان النبي",
    "صفة النبي",
    "صفات سيدنا محمد",
  ]);
});
