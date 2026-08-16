import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadPresentation() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/source-text-presentation.ts");
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} } };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports;
}

const { splitHadithTextForDisplay } = loadPresentation();

test("splits Arabic narration from matn without changing source characters", () => {
  const source = "حدثنا قتيبة عن عمر قالَ رَسُولُ الله ﷺ إنما الأعمال بالنيات";
  const result = splitHadithTextForDisplay(source);

  assert.equal(result.narration + result.matn, source);
  assert.match(result.narration, /^حدثنا قتيبة/u);
  assert.match(result.matn, /^قالَ رَسُولُ الله/u);
});

test("keeps a no-marker Hadith entirely as matn", () => {
  const source = "إنما الأعمال بالنيات";
  const result = splitHadithTextForDisplay(source);

  assert.equal(result.narration, null);
  assert.equal(result.matn, source);
});

test("does not split on a generic English narrator said marker", () => {
  const source = "John said, then the group continued travelling.";
  const result = splitHadithTextForDisplay(source);

  assert.equal(result.narration, null);
  assert.equal(result.matn, source);
});

test("source cards style canonical text, narration, and tafsir separately", () => {
  const component = fs.readFileSync(path.join(process.cwd(), "src/components/source-record-text.tsx"), "utf8");

  assert.match(component, /result\.narrationLabel/);
  assert.match(component, /text-\[var\(--color-green\)\]/);
  assert.match(component, /result\.tafsirLabel/);
  assert.match(component, /text-\[var\(--color-muted\)\]/);
});
