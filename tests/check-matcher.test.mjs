import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function transpile(relativePath) {
  const filename = path.join(process.cwd(), relativePath);

  return ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
}

function loadModule(source, requireOverride = () => ({})) {
  const sandbox = { exports: {}, module: { exports: {} }, require: requireOverride };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(source, sandbox);
  return sandbox.module.exports;
}

const normalization = loadModule(transpile("src/lib/check/text-normalization.ts"));
const inputValidation = loadModule(
  transpile("src/lib/check/input-validation.ts"),
  (id) => (id === "./text-normalization" ? normalization : {}),
);
const { classifyCheckRecords } = loadModule(
  transpile("src/lib/check/matcher.ts"),
  (id) => {
    if (id === "./text-normalization") {
      return normalization;
    }

    return id === "./input-validation" ? inputValidation : {};
  },
);

function record(overrides = {}) {
  return {
    id: "quran:2:286",
    sourceKind: "quran",
    collection: "quran",
    displayName: "Quran",
    reference: "2:286",
    book: null,
    chapter: null,
    hadithNumber: null,
    surahNumber: 2,
    surahName: "Al-Baqarah",
    ayahNumber: 286,
    verseKey: "2:286",
    translationEdition: null,
    tafsirSource: null,
    arabicText: "لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَاۚ",
    englishText: "Allah does not require of any soul more than what it can afford.",
    tafsirText: null,
    grade: null,
    sourceDataset: "fixture",
    sourceReference: "fixture:2:286",
    provenanceNotes: [],
    snippet: null,
    rank: 1,
    ...overrides,
  };
}

test("classifies normalized Quran wording as an exact match", () => {
  const result = classifyCheckRecords("لا يكلف الله نفسا الا وسعها", "ayah", [record()]);

  assert.equal(result.outcome, "exact");
  assert.equal(result.accepted[0].record.id, "quran:2:286");
});

test("does not call a short ambiguous fragment an exact match", () => {
  const result = classifyCheckRecords("قال الملأ", "ayah", [
    record({ arabicText: "قال الملأ من قوم فرعون إن هذا لساحر عليم" }),
  ]);

  assert.notEqual(result.outcome, "exact");
});

test("does not classify a vague question as exact source wording", () => {
  const result = classifyCheckRecords("من قال هذا", "hadith", [
    record({ id: "hadith:question", sourceKind: "hadith", arabicText: "فسأل الرجل من قال هذا الكلام" }),
  ]);

  assert.notEqual(result.outcome, "exact");
});

test("classifies strong lexical overlap as similar without claiming exact wording", () => {
  const result = classifyCheckRecords("الله لا يكلف النفس فوق وسعها", "ayah", [record()]);

  assert.equal(result.outcome, "similar");
});

test("does not treat unrelated retrieved records as similar", () => {
  const result = classifyCheckRecords("إن مع العسر يسرا", "ayah", [record()]);

  assert.equal(result.outcome, "not_found");
  assert.equal(result.accepted.length, 0);
});

test("never matches ayah checks against tafsir commentary", () => {
  const result = classifyCheckRecords("إن مع العسر يسرا", "ayah", [
    record({
      id: "tafsir:94:6",
      sourceKind: "tafsir",
      arabicText: "إن مع العسر يسرا",
      tafsirText: "Commentary",
    }),
  ]);

  assert.equal(result.outcome, "not_found");
});

test("accepts only AI-judged source IDs as semantic similar candidates", () => {
  const candidate = record({ id: "hadith:1", sourceKind: "hadith", arabicText: "الراحمون يرحمهم الرحمن" });
  const result = classifyCheckRecords("عامل الناس برحمة", "hadith", [candidate], new Set(["hadith:1"]));

  assert.equal(result.outcome, "similar");
  assert.equal(result.accepted[0].record.id, "hadith:1");
});
