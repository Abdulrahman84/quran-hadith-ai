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
