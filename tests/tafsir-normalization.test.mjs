import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadTafsirNormalizer() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/tafsir-normalizer.ts");
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

test("normalizes search_quran_text results into Quran source records", () => {
  const { normalizeQuranSearchResult } = loadTafsirNormalizer();

  const record = normalizeQuranSearchResult(
    {
      surah: 2,
      ayah: 255,
      text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ",
      snippet: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ",
      score: -2.5,
    },
    0,
  );

  assert.equal(record.sourceKind, "quran");
  assert.equal(record.reference, "2:255");
  assert.equal(record.displayName, "Quran 2:255");
  assert.equal(record.arabicText, "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ");
  assert.equal(record.tafsirText, null);
  assert.equal(record.grade, null);
  assert.equal(record.sourceReference, "quran:2:255");
});

test("normalizes search_in_tafsir results into Tafsir source records", () => {
  const { normalizeTafsirSearchResult } = loadTafsirNormalizer();

  const record = normalizeTafsirSearchResult(
    {
      surah: 1,
      ayah: 1,
      tafsir_excerpt: "أي أبدأ بكل اسم لله تعالى",
      source_attribution: "التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف",
    },
    "moyassar",
    1,
  );

  assert.equal(record.sourceKind, "tafsir");
  assert.equal(record.reference, "1:1");
  assert.equal(record.displayName, "Tafsir 1:1");
  assert.equal(record.arabicText, "");
  assert.equal(record.tafsirText, "أي أبدأ بكل اسم لله تعالى");
  assert.equal(record.tafsirSource, "التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف");
  assert.equal(record.sourceReference, "tafsir:moyassar:1:1");
});

test("cleans HTML line breaks from tafsir text before display", () => {
  const { normalizeTafsirSearchResult } = loadTafsirNormalizer();

  const record = normalizeTafsirSearchResult(
    {
      surah: 55,
      ayah: 26,
      tafsir_excerpt: "<br> القول في تأويل قوله عز وجل: {كل من عليها فان}<br /> ويبقى وجه ربك",
      source_attribution: "تفسير الإمام الطبري",
    },
    "tabary",
    0,
  );

  assert.equal(record.tafsirText, "القول في تأويل قوله عز وجل: {كل من عليها فان}\nويبقى وجه ربك");
  assert.equal(record.snippet, "القول في تأويل قوله عز وجل: {كل من عليها فان}\nويبقى وجه ربك");
});

test("normalizes fetch_ayah and fetch_tafsir results together", () => {
  const { normalizeFetchedAyahWithTafsir } = loadTafsirNormalizer();

  const records = normalizeFetchedAyahWithTafsir(
    {
      surah: 112,
      ayah: 1,
      text: "قُلْ هُوَ اللَّهُ أَحَدٌ",
      word_count: 4,
    },
    {
      surah: 112,
      ayah: 1,
      tafsirs: [
        {
          source: "mukhtasar_en",
          attribution: "Concise Quran Commentary (English)",
          text: "Say, O Messenger: He is Allah, the One.",
        },
      ],
    },
  );

  assert.equal(records.length, 2);
  assert.equal(records[0].sourceKind, "quran");
  assert.equal(records[0].reference, "112:1");
  assert.equal(records[1].sourceKind, "tafsir");
  assert.equal(records[1].arabicText, "قُلْ هُوَ اللَّهُ أَحَدٌ");
  assert.equal(records[1].tafsirText, "Say, O Messenger: He is Allah, the One.");
  assert.equal(records[1].tafsirSource, "Concise Quran Commentary (English)");
});

test("normalizes fetched tafsir for a Quran search hit", () => {
  const { normalizeFetchedTafsirForAyah } = loadTafsirNormalizer();

  const records = normalizeFetchedTafsirForAyah(
    {
      surah: 55,
      ayah: 26,
      text: "كل من عليها فان",
      snippet: "<m>كل</m> <m>من</m> <m>عليها</m> <m>فان</m>",
      score: -17,
    },
    {
      surah: 55,
      ayah: 26,
      tafsirs: [
        {
          source: "moyassar",
          attribution: "التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف",
          text: "كل مَن على وجه الأرض مِن الخلق هالك.",
        },
      ],
    },
    2,
  );

  assert.equal(records.length, 1);
  assert.equal(records[0].sourceKind, "tafsir");
  assert.equal(records[0].reference, "55:26");
  assert.equal(records[0].arabicText, "كل من عليها فان");
  assert.equal(records[0].tafsirText, "كل مَن على وجه الأرض مِن الخلق هالك.");
  assert.equal(records[0].rank, 2);
});

test("unwraps Tafsir MCP structuredContent result arrays", () => {
  const { unwrapTafsirToolResults } = loadTafsirNormalizer();
  const rows = [{ surah: 55, ayah: 26, text: "كل من عليها فان" }];

  assert.deepEqual(Array.from(unwrapTafsirToolResults({ result: rows })), rows);
  assert.deepEqual(Array.from(unwrapTafsirToolResults(rows)), rows);
  assert.deepEqual(Array.from(unwrapTafsirToolResults({ result: "not an array" })), []);
});

test("plans Quran phrase searches without dropping Quranic stop words", () => {
  const { planTafsirSearchQueries } = loadTafsirNormalizer();

  assert.deepEqual(Array.from(planTafsirSearchQueries("تفسير آية كل من عليها فان", "arabic")), [
    "كل من عليها فان",
    "تفسير آية كل من عليها فان",
  ]);
});
