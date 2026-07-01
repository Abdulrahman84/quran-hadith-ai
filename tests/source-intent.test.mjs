import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSourceIntent() {
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
    exports: {},
    module: { exports: {} },
    require,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("routes tafsir and ayah questions to Tafsir MCP only", () => {
  const { planSourceRoutes } = loadSourceIntent();

  assert.deepEqual(Array.from(planSourceRoutes("What is the tafsir of ayah 2:255?")), ["tafsir"]);
  assert.deepEqual(Array.from(planSourceRoutes("ما تفسير آية الكرسي؟")), ["tafsir"]);
});

test("routes hadith and sunnah questions to Hadith MCP only", () => {
  const { planSourceRoutes } = loadSourceIntent();

  assert.deepEqual(Array.from(planSourceRoutes("Find hadith about intention")), ["hadith"]);
  assert.deepEqual(Array.from(planSourceRoutes("ابحث عن حديث النية")), ["hadith"]);
});

test("routes broad source questions to Tafsir and Hadith MCPs", () => {
  const { planSourceRoutes } = loadSourceIntent();

  assert.deepEqual(Array.from(planSourceRoutes("What sources mention mercy?")), ["tafsir", "hadith"]);
  assert.deepEqual(Array.from(planSourceRoutes("ما المصادر التي تذكر الرحمة؟")), ["tafsir", "hadith"]);
});
