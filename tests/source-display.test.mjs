import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadSourceDisplay() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/source-display.ts");
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

function sourceRecord(overrides = {}) {
  return {
    collection: "quran",
    sourceKind: "quran",
    displayName: "Quran 55:26",
    reference: "55:26",
    surahName: "الرحمن",
    tafsirSource: null,
    grade: null,
    ...overrides,
  };
}

test("formats Quran and tafsir titles in Arabic UI", () => {
  const { formatSourceRecordTitle } = loadSourceDisplay();

  assert.equal(formatSourceRecordTitle(sourceRecord(), "ar"), "القرآن - سورة الرحمن 55:26");
  assert.equal(
    formatSourceRecordTitle(sourceRecord({ collection: "moyassar", sourceKind: "tafsir", displayName: "Tafsir 55:26" }), "ar"),
    "التفسير الميسر - سورة الرحمن 55:26",
  );
});

test("preserves Quran and tafsir titles in English UI", () => {
  const { formatSourceRecordTitle } = loadSourceDisplay();

  assert.equal(formatSourceRecordTitle(sourceRecord(), "en"), "Quran 55:26");
  assert.equal(formatSourceRecordTitle(sourceRecord({ sourceKind: "tafsir", displayName: "Tafsir 55:26" }), "en"), "Tafsir 55:26");
});

test("formats common romanized hadith grades in Arabic UI", () => {
  const { formatHadithGrade } = loadSourceDisplay();

  assert.equal(formatHadithGrade("SAHIH LI GHAIRIHI", "ar"), "صحيح لغيره");
  assert.equal(formatHadithGrade("hasan", "ar"), "حسن");
  assert.equal(formatHadithGrade("Abu Eisa said: This Hadith is Hasan Sahih", "ar"), "حسن صحيح");
  assert.equal(formatHadithGrade("daif", "ar"), "ضعيف");
});

test("preserves hadith grades in English UI and unknown Arabic grades", () => {
  const { formatHadithGrade } = loadSourceDisplay();

  assert.equal(formatHadithGrade("SAHIH LI GHAIRIHI", "en"), "SAHIH LI GHAIRIHI");
  assert.equal(formatHadithGrade("gharib", "ar"), "gharib");
});
