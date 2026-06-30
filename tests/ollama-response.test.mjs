import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadOllamaModule() {
  const filename = path.join(process.cwd(), "src/lib/llm/ollama.ts");
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
    AbortController,
    clearTimeout,
    console,
    exports: {},
    fetch,
    module: { exports: {} },
    process,
    require,
    setTimeout,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

function sourceRecord(overrides = {}) {
  return {
    id: "bukhari-1",
    sourceKind: "hadith",
    collection: "bukhari",
    displayName: "Sahih al-Bukhari",
    book: "Revelation",
    chapter: "How the Divine Revelation started",
    hadithNumber: "1",
    arabicText: "قال رسول الله صلى الله عليه وسلم إنما الأعمال بالنيات",
    englishText: "I heard Allah's Messenger saying, The reward of deeds depends upon the intentions.",
    grade: { value: "sahih", source: "source", sourceReference: "ref", provenanceNotes: [] },
    sourceDataset: "fixture",
    sourceReference: "bukhari:1",
    provenanceNotes: [],
    snippet: null,
    rank: 1,
    ...overrides,
  };
}

test("fallback answer addresses the asker directly in English", () => {
  const { fallbackGroundedSummary } = loadOllamaModule();

  const answer = fallbackGroundedSummary({
    question: "What hadith mention intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.match(answer.text, /^For your question, the retrieved records/);
  assert.doesNotMatch(answer.text, /user's question/i);
});

test("fallback answer addresses the asker directly in Arabic", () => {
  const { fallbackGroundedSummary } = loadOllamaModule();

  const answer = fallbackGroundedSummary({
    question: "ما حديث النية؟",
    language: "arabic",
    records: [sourceRecord()],
  });

  assert.match(answer.text, /^بالنسبة إلى سؤالك، تعرض السجلات المسترجعة/);
  assert.doesNotMatch(answer.text, /سؤال المستخدم/);
});

test("fallback Arabic summary omits narrator-chain openings", () => {
  const { fallbackGroundedSummary } = loadOllamaModule();

  const answer = fallbackGroundedSummary({
    question: "ما حديث النية؟",
    language: "arabic",
    records: [
      sourceRecord({
        arabicText:
          "حدثنا ابن أبي عمر، حدثنا سفيان بن عيينة، عن الزهري، عن سالم، عن أبيه قال: إنما الأعمال بالنيات",
      }),
    ],
  });

  assert.doesNotMatch(answer.text, /حدثنا|سفيان|الزهري/);
  assert.match(answer.text, /انما الاعمال بالنيات/);
});
