import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTafsirSources() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/tafsir-sources.ts");
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

test("resolves all Tafsir MCP sources", () => {
  const { resolveTafsirSources } = loadTafsirSources();

  assert.deepEqual(Array.from(resolveTafsirSources("all")), [
    "tabary",
    "katheer",
    "baghawy",
    "saadi",
    "moyassar",
    "mukhtasar_ar",
    "mukhtasar_en",
  ]);
});

test("accepts only known Tafsir MCP source selections", () => {
  const { isTafsirSourceSelection, resolveTafsirSources } = loadTafsirSources();

  assert.equal(isTafsirSourceSelection("katheer"), true);
  assert.equal(isTafsirSourceSelection("not-a-source"), false);
  assert.deepEqual(Array.from(resolveTafsirSources("katheer")), ["katheer"]);
});
