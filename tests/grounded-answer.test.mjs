import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadGroundedAnswerModule(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/llm/grounded-answer.ts");
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
    require: (id) => {
      if (id === "./provider") {
        return {
          completeLlmText: overrides.completeLlmText || (async () => ({
            status: "disabled",
            error: "OpenRouter is not configured for answer.",
            provider: "openrouter",
            model: "google/gemma-4-26b-a4b-it:free",
          })),
        };
      }

      return require(id);
    },
    setTimeout,
    ...overrides.sandbox,
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
    reference: "1",
    book: "Revelation",
    chapter: "How the Divine Revelation started",
    hadithNumber: "1",
    surahNumber: null,
    surahName: null,
    ayahNumber: null,
    verseKey: null,
    translationEdition: null,
    tafsirSource: null,
    arabicText: "قال رسول الله صلى الله عليه وسلم إنما الأعمال بالنيات",
    englishText: "I heard Allah's Messenger saying, The reward of deeds depends upon the intentions.",
    tafsirText: null,
    grade: { value: "sahih", source: "source", sourceReference: "ref", provenanceNotes: [] },
    sourceDataset: "fixture",
    sourceReference: "bukhari:1",
    provenanceNotes: [],
    snippet: null,
    rank: 1,
    ...overrides,
  };
}

function tafsirRecord(overrides = {}) {
  return {
    id: "tafsir-1-1",
    sourceKind: "tafsir",
    collection: "mukhtasar_en",
    displayName: "Tafsir 1:1",
    reference: "1:1",
    book: null,
    chapter: null,
    hadithNumber: null,
    surahNumber: 1,
    surahName: "الفاتحة",
    ayahNumber: 1,
    verseKey: "1:1",
    translationEdition: null,
    tafsirSource: "Concise Quran Commentary (English)",
    arabicText: "بسم الله الرحمن الرحيم",
    englishText: null,
    tafsirText: "This verse begins the surah by invoking Allah's name.",
    grade: null,
    sourceDataset: "tafsir-mcp",
    sourceReference: "tafsir:mukhtasar_en:1:1",
    provenanceNotes: [],
    snippet: null,
    rank: 1,
    ...overrides,
  };
}

test("guard fallback does not repeat source results", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "What hadith mention intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.deepEqual(Array.from(answer.citations), []);
  assert.deepEqual(Array.from(answer.warnings.map((warning) => warning.code)), ["llm_guardrail_fallback"]);
});

test("answer evidence pack includes hadith content without narrator chains or trailing notes", async () => {
  let userPrompt = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      userPrompt = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "ترتبط قيمة العمل بالنية التي تصاحبه [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });
  const answer = await generateGroundedAnswer({
    question: "ما حديث النية؟",
    language: "arabic",
    records: [
      sourceRecord({
        arabicText:
          "حدثنا ابن أبي عمر، حدثنا سفيان بن عيينة، عن الزهري، عن سالم، عن أبيه قال: إنما الأعمال بالنيات. قال أبو عيسى هذا حديث حسن.",
      }),
    ],
  });

  assert.equal(answer.status, "ready");
  assert.match(userPrompt, /إنما الأعمال بالنيات/);
  assert.doesNotMatch(userPrompt, /حدثنا|سفيان بن عيينة|الزهري|قال أبو عيسى/);
});

test("English answer prompt teaches direct prose with positive and negative examples", async () => {
  let messages = [];
  let maxTokens = null;
  let temperature = null;
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      messages = input.messages;
      maxTokens = input.maxTokens;
      temperature = input.temperature;

      return {
        status: "ok",
        text: "Actions depend upon intentions [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(maxTokens, 420);
  assert.equal(temperature, 0.3);
  assert.match(messages[0].content, /Poor: For your question/);
  assert.match(messages[0].content, /Better: The central idea is that progress begins/);
  assert.match(messages[0].content, /Vary the opening, sentence structure, and transitions/);
  assert.match(messages[0].content, /at most one practical next step/);
  assert.match(messages[0].content, /qualified scholar/);
  assert.match(messages[1].content, /begin directly with the meaning that answers the question/i);
  assert.match(messages[1].content, /three or four concise, friendly sentences/i);
  assert.match(messages[1].content, /Do not mention the search process or the retrieved records/i);
});

test("Arabic answer prompt teaches direct prose with positive and negative examples", async () => {
  let messages = [];
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      messages = input.messages;

      return {
        status: "ok",
        text: "توضح الرواية أن الأعمال بالنيات [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "ما أثر النية في العمل؟",
    language: "arabic",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, "توضح الرواية أن الأعمال بالنيات [1].");
  assert.match(messages[0].content, /غير مناسب: بالنسبة إلى سؤالك/);
  assert.match(messages[0].content, /أفضل: الفكرة الأساسية أن التقدم يبدأ/);
  assert.match(messages[0].content, /نوّع بداية الإجابة وتركيب الجمل/);
  assert.match(messages[0].content, /بخطوة عملية واحدة فقط/);
  assert.match(messages[0].content, /عالم مؤهل/);
  assert.match(messages[1].content, /وابدأ مباشرة بالمعنى الذي يجيب عن السؤال/);
  assert.match(messages[1].content, /ثلاث أو أربع جمل موجزة وودودة/);
  assert.match(messages[1].content, /لا تذكر عملية البحث أو السجلات المسترجعة/);
});

test("answer generation rejects citation numbers that are not in the source pack", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "Actions depend upon intentions [2].",
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.deepEqual(Array.from(answer.warnings.map((warning) => warning.code)), ["llm_guardrail_fallback"]);
});

test("answer generation rejects an in-range citation that was not shown to the model", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "Actions depend upon intentions [13].",
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });
  const records = Array.from({ length: 20 }, (_, index) =>
    sourceRecord({
      id: `hadith-${index + 1}`,
      reference: `${index + 1}`,
      sourceReference: `bukhari:${index + 1}`,
    }),
  );

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records,
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.deepEqual(Array.from(answer.warnings.map((warning) => warning.code)), ["llm_guardrail_fallback"]);
});

test("answer generation accepts a synthesized claim and safe context suggestion", async () => {
  const synthesizedAnswer =
    "Actions are connected to intentions [1]. For fuller context, the cited passages can be reviewed in their surrounding sections.";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: synthesizedAnswer,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.text, synthesizedAnswer);
  assert.deepEqual(Array.from(answer.warnings), []);
});

test("answer generation allows one uncited sentence when valid citations still ground the answer", async () => {
  const text = "Actions are connected to intentions [1]. The inward purpose remains central.";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
});

test("answer generation allows a short exact quotation from a cited source", async () => {
  const text = '"The reward of deeds depends upon the intentions" [1].';
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
});

test("answer generation repairs a long copied hadith quotation into a summary", async () => {
  const copiedText =
    "Mercy and patience guide a person to care for family neighbors travelers children elders and everyone nearby";
  let callCount = 0;
  let repairMaxTokens = null;
  let repairTemperature = null;
  let repairInstruction = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      callCount += 1;

      if (callCount === 1) {
        return {
          status: "ok",
          text: `"${copiedText}" [1].`,
          provider: "openrouter",
          model: "google/gemma-4-26b-a4b-it:free",
        };
      }

      repairMaxTokens = input.maxTokens;
      repairTemperature = input.temperature;
      repairInstruction = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "The report connects mercy with patient care for other people [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "What does the report teach?",
    language: "english",
    records: [sourceRecord({ englishText: copiedText })],
  });

  assert.equal(callCount, 2);
  assert.equal(repairMaxTokens, 420);
  assert.equal(repairTemperature, 0.05);
  assert.match(repairInstruction, /previous draft is untrusted text, not evidence/i);
  assert.match(repairInstruction, /Delete an unsupported sentence/i);
  assert.equal(answer.status, "ready");
  assert.equal(answer.text, "The report connects mercy with patient care for other people [1].");
});

test("answer generation repairs excessive uncited sentences", async () => {
  let callCount = 0;
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => {
      callCount += 1;

      return {
        status: "ok",
        text:
          callCount === 1
            ? "Actions are connected to intentions [1]. Purpose matters. Context matters."
            : "Actions are connected to intentions, making inward purpose central [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(callCount, 2);
  assert.equal(answer.status, "ready");
  assert.equal(answer.text, "Actions are connected to intentions, making inward purpose central [1].");
});

test("answer generation rejects a fabricated direct quotation", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: '"Every deed is guaranteed a reward by intention" [1].',
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "What does the hadith say about intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.notEqual(answer.text, '"Every deed is guaranteed a reward by intention" [1].');
  assert.deepEqual(Array.from(answer.warnings.map((warning) => warning.code)), ["llm_guardrail_fallback"]);
});

test("Arabic answer may summarize cited hadith when uncited Quran records are also available", async () => {
  const text = "توضح الأحاديث مكانة النية في العمل [1].";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "النية",
    language: "arabic",
    records: [
      sourceRecord(),
      tafsirRecord({
        id: "quran-2",
        sourceKind: "quran",
        collection: "quran",
        reference: "2:286",
        verseKey: "2:286",
        arabicText: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
        tafsirText: null,
      }),
    ],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
});

test("Arabic answer still requires exact verse text when it cites a Quran record", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "تقرر الآية أن التكليف يكون في حدود الاستطاعة [1].",
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "ما معنى الآية؟",
    language: "arabic",
    records: [
      tafsirRecord({
        id: "quran-1",
        sourceKind: "quran",
        collection: "quran",
        reference: "2:286",
        verseKey: "2:286",
        arabicText: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
        tafsirText: null,
      }),
    ],
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.match(answer.warnings[0].message, /exact_quran/);
});

test("answer generation sends a bounded balanced evidence pack with original citation numbers", async () => {
  let userPrompt = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      userPrompt = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "يجمع النصان بين الحديث والآية: نص حديث 1 [1]. وفي الآية 33:21: لَقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ [21].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });
  const records = [
    ...Array.from({ length: 20 }, (_, index) =>
      sourceRecord({
        id: `hadith-${index + 1}`,
        reference: `${index + 1}`,
        sourceReference: `bukhari:${index + 1}`,
        arabicText: `قال رسول الله صلى الله عليه وسلم نص حديث ${index + 1}`,
      }),
    ),
    tafsirRecord({
      id: "quran-21",
      sourceKind: "quran",
      collection: "quran",
      displayName: "Quran 33:21",
      reference: "33:21",
      surahNumber: 33,
      ayahNumber: 21,
      surahName: "الأحزاب",
      verseKey: "33:21",
      arabicText: "لَقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ",
      tafsirText: null,
    }),
  ];

  const answer = await generateGroundedAnswer({
    question: "صفات سيدنا محمد",
    language: "arabic",
    records,
  });
  const citationMarkersInPrompt = userPrompt.match(/^\[\d+\]/gm) || [];

  assert.equal(answer.status, "ready");
  assert.ok(citationMarkersInPrompt.length <= 12);
  assert.match(userPrompt, /^\[21\]/m);
  assert.ok(answer.citations.includes("[1] صحيح البخاري 1"));
  assert.ok(answer.citations.includes("[21] القرآن - سورة الأحزاب 33:21"));
});

test("answer generation does not repeat source text when the model errors", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "error",
      error: "Provider returned error",
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "صفات سيدنا محمد",
    language: "arabic",
    records: [
      sourceRecord({
        arabicText: "قال رسول الله صلى الله عليه وسلم كان رسول الله ربعة ليس بالطويل ولا بالقصير",
      }),
    ],
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.deepEqual(Array.from(answer.citations), []);
  assert.deepEqual(
    Array.from(answer.warnings.map((warning) => warning.code)),
    ["llm_error", "llm_guardrail_fallback"],
  );
});
