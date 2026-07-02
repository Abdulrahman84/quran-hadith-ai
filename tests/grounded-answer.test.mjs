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

test("fallback answer addresses the asker directly in English", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "What hadith mention intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.match(answer.text, /^For your question, the retrieved records/);
  assert.doesNotMatch(answer.text, /user's question/i);
});

test("fallback answer addresses the asker directly in Arabic", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "ما حديث النية؟",
    language: "arabic",
    records: [sourceRecord()],
  });

  assert.match(answer.text, /^بالنسبة إلى سؤالك، تعرض السجلات المسترجعة/);
  assert.doesNotMatch(answer.text, /سؤال المستخدم/);
});

test("fallback Arabic summary omits narrator-chain openings", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

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

test("fallback Arabic summary prefers hadith matn over trailing notes", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "صفات سيدنا محمد",
    language: "arabic",
    records: [
      sourceRecord({
        arabicText:
          "حدثنا عمرو الناقد، عن البراء قال كان رسول الله صلى الله عليه وسلم أحسن الناس وجها وأحسنهم خلقا ليس بالطويل ولا بالقصير. قال أبو كريب له شعر.",
      }),
    ],
  });

  assert.match(answer.text, /ان رسول الله صلي الله عليه وسلم احسن الناس وجها/);
  assert.doesNotMatch(answer.text, /ابو كريب له شعر/);
});

test("fallback answer can cite tafsir records", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "What is the tafsir of Al-Fatihah 1:1?",
    language: "english",
    records: [tafsirRecord()],
  });

  assert.match(answer.text, /^For your question, the retrieved records/);
  assert.deepEqual(Array.from(answer.citations), ["[1] Tafsir 1:1 1:1"]);
});

test("fallback Arabic Quran summary mentions the verse and exact ayah text without English labels", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "تفسير آية كل من عليها فان",
    language: "arabic",
    records: [
      tafsirRecord({
        sourceKind: "quran",
        collection: "quran",
        displayName: "Quran 55:26",
        reference: "55:26",
        surahNumber: 55,
        ayahNumber: 26,
        surahName: "الرحمن",
        verseKey: "55:26",
        arabicText: "كُلُّ مَنْ عَلَيْهَا فَانٍ",
        tafsirText: null,
      }),
      tafsirRecord({
        collection: "moyassar",
        displayName: "Tafsir 55:26",
        reference: "55:26",
        surahNumber: 55,
        ayahNumber: 26,
        surahName: "الرحمن",
        verseKey: "55:26",
        arabicText: "كُلُّ مَنْ عَلَيْهَا فَانٍ",
        tafsirSource: "التفسير الميسر، مجمع الملك فهد لطباعة المصحف الشريف",
        tafsirText: "كل مَن على وجه الأرض مِن الخلق هالك.",
      }),
      sourceRecord({
        id: "bukhari-unused",
        sourceKind: "hadith",
        collection: "bukhari",
        displayName: "Sahih al-Bukhari",
        reference: "1",
      }),
    ],
  });

  assert.match(answer.text, /في القرآن الكريم، سورة الرحمن، الآية 55:26: كُلُّ مَنْ عَلَيْهَا فَانٍ \[1\]/);
  assert.match(answer.text, /الخلاصة من كتب التفسير/);
  assert.match(answer.text, /يذكر التفسير الميسر: كل مَن على وجه الأرض مِن الخلق هالك\. \[2\]/);
  assert.doesNotMatch(answer.text, /\b(?:Quran|Tafsir)\b/);
  assert.deepEqual(Array.from(answer.citations), ["[1] القرآن - سورة الرحمن 55:26", "[2] التفسير الميسر - سورة الرحمن 55:26"]);
  assert.equal(answer.citations.length, 2);
});

test("fallback Arabic broad-topic summary includes hadith alongside Quran records", () => {
  const { fallbackGroundedSummary } = loadGroundedAnswerModule();

  const answer = fallbackGroundedSummary({
    question: "ما المصادر عن الصبر؟",
    language: "arabic",
    records: [
      tafsirRecord({
        sourceKind: "quran",
        collection: "quran",
        displayName: "Quran 2:153",
        reference: "2:153",
        surahNumber: 2,
        ayahNumber: 153,
        surahName: "البقرة",
        verseKey: "2:153",
        arabicText: "يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ",
        tafsirText: null,
      }),
      sourceRecord({
        id: "bukhari-sabr",
        sourceKind: "hadith",
        collection: "bukhari",
        displayName: "Sahih al-Bukhari",
        reference: "2:35",
        arabicText: "قال رسول الله صلى الله عليه وسلم ومن يتصبر يصبره الله",
      }),
    ],
  });

  assert.match(answer.text, /ومن سجلات الحديث/);
  assert.match(answer.text, /ومن النص القرآني/);
  assert.match(answer.text, /ومن يتصبر يصبره الله/);
  assert.ok(answer.text.indexOf("ومن سجلات الحديث") < answer.text.indexOf("ومن النص القرآني"));
  assert.deepEqual(Array.from(answer.citations), ["[2] صحيح البخاري 2:35", "[1] القرآن - سورة البقرة 2:153"]);
});

test("answer generation sends a bounded balanced evidence pack with original citation numbers", async () => {
  let userPrompt = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      userPrompt = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "بالنسبة إلى سؤالك، تعرض السجلات المسترجعة نص حديث 1 [1]، ومعه الآية: لَقَدْ كَانَ لَكُمْ فِي رَسُولِ اللَّهِ أُسْوَةٌ حَسَنَةٌ [21].",
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
