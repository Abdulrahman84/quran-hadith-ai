import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadQuotationMatch() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/quotation-match.ts");
  const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
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
    id: "hadith-1",
    sourceKind: "hadith",
    collection: "muslim",
    displayName: "Sahih Muslim",
    reference: "1",
    book: null,
    chapter: null,
    hadithNumber: "1",
    surahNumber: null,
    surahName: null,
    ayahNumber: null,
    verseKey: null,
    translationEdition: null,
    tafsirSource: null,
    arabicText: "قال رسول الله صلى الله عليه وسلم من غشنا فليس منا",
    englishText: "The Messenger of Allah said: Whoever deceives us is not one of us.",
    tafsirText: null,
    grade: null,
    sourceDataset: "fixture",
    sourceReference: "fixture:1",
    provenanceNotes: [],
    snippet: null,
    rank: 1,
    ...overrides,
  };
}

test("recognizes attributed hadith wording as a literal match", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const result = assessQuotationMatch(
    "حديث: من غشنا فليس منا",
    "arabic",
    [sourceRecord()],
  );

  assert.equal(result.state, "literal");
  assert.deepEqual(Array.from(result.matchedRecordIds), ["hadith-1"]);
  assert.deepEqual(Array.from(result.unmatchedCandidateTexts), []);
});

test("marks a changed attributed hadith as similar rather than literal", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const result = assessQuotationMatch(
    "حديث: من غشنا فهو منا",
    "arabic",
    [sourceRecord()],
  );

  assert.equal(result.state, "similar");
  assert.deepEqual(Array.from(result.matchedRecordIds), []);
  assert.deepEqual(Array.from(result.unmatchedCandidateTexts), ["من غشنا فهو منا"]);
});

test("removes verification grammar from an attributed quotation candidate", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const result = assessQuotationMatch(
    "هل حديث الصلاة عماد الدين صحيح؟",
    "arabic",
    [sourceRecord()],
  );

  assert.equal(result.state, "similar");
  assert.deepEqual(Array.from(result.unmatchedCandidateTexts), ["الصلاة عماد الدين"]);
});

test("normalizes Quranic marks, punctuation, and hamza variants for literal matching", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const result = assessQuotationMatch(
    "قال تعالى: لا يكلف الله نفسا إلا وسعها",
    "arabic",
    [
      sourceRecord({
        id: "quran-1",
        sourceKind: "quran",
        arabicText: "لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَاۚ",
        englishText: null,
      }),
    ],
  );

  assert.equal(result.state, "literal");
  assert.deepEqual(Array.from(result.matchedRecordIds), ["quran-1"]);
});

test("does not treat wording found only in tafsir commentary as literal Quran", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const result = assessQuotationMatch(
    "آية: الصلاة عماد الدين",
    "arabic",
    [
      sourceRecord({
        id: "tafsir-1",
        sourceKind: "tafsir",
        arabicText: "أقيموا الصلاة",
        englishText: null,
        tafsirText: "الصلاة عماد الدين في حياة المؤمن",
      }),
    ],
  );

  assert.equal(result.state, "similar");
});

test("keeps normal questions and short ambiguous wording out of negative matching", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const records = [sourceRecord()];

  assert.equal(
    assessQuotationMatch("ما الأحاديث التي تتحدث عن الرحمة بين الناس؟", "arabic", records).state,
    "normal",
  );
  assert.equal(
    assessQuotationMatch("هل هذا حديث صحيح؟", "arabic", records).state,
    "normal",
  );
});

test("requires every quoted candidate to match and ignores internal ellipses", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const records = [sourceRecord()];

  assert.equal(
    assessQuotationMatch('هل ورد في الحديث «من غشنا فليس منا» و«الصلاة عماد الدين»؟', "arabic", records).state,
    "similar",
  );
  assert.equal(
    assessQuotationMatch('هل ورد «من غشنا … منا»؟', "arabic", records).state,
    "normal",
  );
});

test("recognizes only long unmarked pasted statements as quotation candidates", () => {
  const { assessQuotationMatch } = loadQuotationMatch();
  const records = [sourceRecord()];
  const pasted =
    "هذا نص طويل يكتبه المستخدم على أنه رواية كاملة متداولة بين الناس وفيه كلمات كثيرة وتفاصيل متتابعة لكنها لا تظهر حرفيا في المصدر المسترجع هنا";
  const longQuestion =
    "كيف يمكنني أن أفهم هذا النص الطويل الذي يتحدث عن الرحمة والصلاة والأخلاق ويجمع موضوعات كثيرة في سؤال واحد يحتاج إلى شرح واضح؟";

  assert.equal(assessQuotationMatch(pasted, "arabic", records).state, "similar");
  assert.equal(assessQuotationMatch(longQuestion, "arabic", records).state, "normal");
});

test("does not promise similar sources when retrieval returned no records", () => {
  const { assessQuotationMatch } = loadQuotationMatch();

  assert.equal(
    assessQuotationMatch("حديث: الصلاة عماد الدين", "arabic", []).state,
    "normal",
  );
});
