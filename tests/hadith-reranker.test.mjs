import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadHadithReranker() {
  const filename = path.join(process.cwd(), "src/lib/retrieval/hadith-reranker.ts");
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

function hadithRecord(overrides = {}) {
  return {
    id: "hadith:1",
    sourceKind: "hadith",
    collection: "sahih_muslim",
    displayName: "Sahih Muslim",
    reference: "43:124",
    book: null,
    chapter: null,
    hadithNumber: "43:124",
    surahNumber: null,
    surahName: null,
    ayahNumber: null,
    verseKey: null,
    translationEdition: null,
    tafsirSource: null,
    arabicText: "",
    englishText: null,
    tafsirText: null,
    grade: null,
    sourceDataset: "test",
    sourceReference: "test",
    provenanceNotes: [],
    snippet: null,
    rank: null,
    ...overrides,
  };
}

test("hadith reranker prefers matn matches over earlier noisy search hits", () => {
  const { rerankHadithRecords } = loadHadithReranker();
  const records = rerankHadithRecords(
    [
      {
        record: hadithRecord({
          id: "bad",
          hadithNumber: "bad",
          reference: "bad",
          arabicText: "حدثنا فلان قال حدثنا فلان عن صفة زمزم ومائها.",
        }),
        searchQueries: ["صفة رسول الله"],
        bestSearchRank: 1,
        firstSearchOrder: 0,
      },
      {
        record: hadithRecord({
          id: "property",
          hadithNumber: "property",
          reference: "property",
          arabicText: "حدثنا فلان قال رسول الله صلى الله عليه وسلم من كان له شريك في ربعة أو نخل فليس له أن يبيع.",
        }),
        searchQueries: ["ربعة من القوم"],
        bestSearchRank: 2,
        firstSearchOrder: 1,
      },
      {
        record: hadithRecord({
          id: "good",
          hadithNumber: "good",
          reference: "good",
          arabicText: "حدثنا فلان قال كان رسول الله صلى الله عليه وسلم ليس بالطويل ولا بالقصير.",
        }),
        searchQueries: ["ليس بالطويل"],
        bestSearchRank: 8,
        firstSearchOrder: 4,
      },
    ],
    "صفات سيدنا محمد",
    "arabic",
  );

  assert.equal(records[0].id, "good");
  assert.equal(records[0].rank, 1);
});

test("hadith matn extraction strips chain prefixes and common trailing grade notes", () => {
  const { hadithMatnForSearch } = loadHadithReranker();
  const matn = hadithMatnForSearch(
    hadithRecord({
      arabicText:
        "حدثنا قتيبة قال حدثنا جعفر عن الربيع قالت كان رسول الله صلى الله عليه وسلم ربعة قال ابو عيسي هذا حديث حسن صحيح.",
    }),
    "arabic",
  );

  assert.match(matn, /^كان رسول الله/u);
  assert.doesNotMatch(matn, /حدثنا قتيبة/u);
  assert.doesNotMatch(matn, /ابو عيسي/u);
});
