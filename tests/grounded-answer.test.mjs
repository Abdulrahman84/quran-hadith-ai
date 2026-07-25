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
  assert.match(messages[0].content, /Better: The two citations support that progress begins/);
  assert.match(messages[0].content, /Vary the opening, sentence structure, and transitions/);
  assert.match(messages[0].content, /at most one practical next step/);
  assert.match(messages[0].content, /qualified scholar/);
  assert.match(messages[0].content, /retrieved results do not establish the claim/i);
  assert.match(messages[0].content, /Match the conclusion to the exact verification requested/i);
  assert.match(messages[0].content, /wording appears in a retrieved record/i);
  assert.match(messages[0].content, /review the original source texts below/i);
  assert.match(messages[1].content, /Usually write three to five concise, friendly sentences/i);
  assert.match(messages[1].content, /begin with the verification conclusion/i);
  assert.match(messages[1].content, /review the original source texts below/i);
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
  assert.match(messages[0].content, /أفضل: تؤيد الإحالتان أن التقدم يبدأ/);
  assert.match(messages[0].content, /نوّع بداية الإجابة وتركيب الجمل/);
  assert.match(messages[0].content, /بخطوة عملية واحدة فقط/);
  assert.match(messages[0].content, /عالم مؤهل/);
  assert.match(messages[0].content, /النتائج المسترجعة لا تثبت الادعاء/u);
  assert.match(messages[0].content, /طابق نتيجة التحقق مع ما طلبه المستخدم تحديدا/u);
  assert.match(messages[0].content, /وجود هذا اللفظ في ذلك السجل فقط/u);
  assert.match(messages[0].content, /نصوص المصادر الأصلية أدناه/u);
  assert.match(messages[1].content, /ثلاث إلى خمس جمل موجزة وودودة/u);
  assert.match(messages[1].content, /فابدأ بنتيجة التحقق/u);
  assert.match(messages[1].content, /مراجعة نصوص المصادر الأصلية أدناه/u);
});

test("similar quotation matches are treated as untrusted wording in the answer prompt", async () => {
  let userPrompt = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      userPrompt = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "توضح المصادر المسترجعة معنى قريبا يتعلق بمكانة الصلاة [1].",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "حديث: الصلاة عماد الدين",
    language: "arabic",
    records: [sourceRecord()],
    quotationMatch: {
      state: "similar",
      matchedRecordIds: [],
      unmatchedCandidateTexts: ["الصلاة عماد الدين"],
    },
  });

  assert.equal(answer.status, "ready");
  assert.match(userPrompt, /نص غير موثوق لم يوجد حرفيا في النتائج المسترجعة/u);
  assert.match(userPrompt, /لا تصحح النص من الذاكرة/u);
});

test("literal quotation matches do not imply authenticity or grade", async () => {
  let userPrompt = "";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async (input) => {
      userPrompt = input.messages.at(-1).content;

      return {
        status: "ok",
        text: "يظهر هذا اللفظ في السجل المسترجع، لكن درجة الرواية غير متاحة فيه [1]. وللتحقق من اللفظ والسياق الكامل، راجع نصوص المصادر الأصلية أدناه.",
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      };
    },
  });

  const answer = await generateGroundedAnswer({
    question: "حديث: إنما الأعمال بالنيات",
    language: "arabic",
    records: [sourceRecord({ grade: null })],
    quotationMatch: {
      state: "literal",
      matchedRecordIds: ["bukhari-1"],
      unmatchedCandidateTexts: [],
    },
  });

  assert.equal(answer.status, "ready");
  assert.match(userPrompt, /يثبت وجوده في السجل فقط/u);
  assert.match(userPrompt, /لا تعتبر المطابقة وحدها إثباتا لصحة النسبة أو درجة الحديث/u);
});

test("verification closing may direct the user to original sources without a citation", async () => {
  const text =
    "The retrieved report supports that actions are connected to intentions [1]. To verify the exact wording and full context, review the original source texts below.";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "Does the report connect actions to intentions?",
    language: "english",
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
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
  let repairDeprioritizedModels = null;
  let repairAcceptText = null;
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
      repairDeprioritizedModels = input.deprioritizeModels;
      repairAcceptText = input.acceptText;

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
  assert.deepEqual(Array.from(repairDeprioritizedModels), ["google/gemma-4-26b-a4b-it:free"]);
  assert.equal(typeof repairAcceptText, "function");
  assert.equal(repairAcceptText("The report connects mercy with patient care for other people [1]."), true);
  assert.equal(repairAcceptText(`"${copiedText}" [1].`), false);
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

test("answer generation allows the user's unmatched wording when clearly caveated", async () => {
  const text = "لا تثبت المصادر أن عبارة «الصلاة عماد الدين» صحيحة، لكنها تعرض أحاديث قريبة عن مكانة الصلاة [1].";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "هل حديث الصلاة عماد الدين صحيح؟",
    language: "arabic",
    quotationMatch: {
      state: "similar",
      matchedRecordIds: [],
      unmatchedCandidateTexts: ["الصلاة عماد الدين"],
    },
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
});

test("answer generation still rejects unmatched user wording presented as verified", async () => {
  const text = "تؤكد المصادر أن «الصلاة عماد الدين» حديث صحيح [1].";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "هل حديث الصلاة عماد الدين صحيح؟",
    language: "arabic",
    quotationMatch: {
      state: "similar",
      matchedRecordIds: [],
      unmatchedCandidateTexts: ["الصلاة عماد الدين"],
    },
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "error");
  assert.equal(answer.text, null);
  assert.match(answer.warnings[0].message, /quotes/);
});

test("caveated user quotations cannot pivot to positive attribution", async () => {
  const drafts = [
    {
      language: "arabic",
      question: "هل وردت آية الصلاة عماد الدين؟",
      candidate: "الصلاة عماد الدين",
      text: "العبارة «الصلاة عماد الدين» لا تثبت مجرد معنى قريب، بل هي آية صحيحة [1].",
    },
    {
      language: "english",
      question: "Is the phrase prayer is the pillar of religion an authentic hadith?",
      candidate: "prayer is the pillar of religion",
      text: 'The wording "prayer is the pillar of religion" is not merely similar; it is authentic Quran [1].',
    },
  ];

  for (const draft of drafts) {
    const { generateGroundedAnswer } = loadGroundedAnswerModule({
      completeLlmText: async () => ({
        status: "ok",
        text: draft.text,
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      }),
    });
    const answer = await generateGroundedAnswer({
      question: draft.question,
      language: draft.language,
      quotationMatch: {
        state: "similar",
        matchedRecordIds: [],
        unmatchedCandidateTexts: [draft.candidate],
      },
      records: [sourceRecord()],
    });

    assert.equal(answer.status, "error");
    assert.match(answer.warnings[0].message, /quotes/);
  }
});

test("natural wording-not-found caveats remain allowed", async () => {
  const drafts = [
    {
      language: "arabic",
      question: "هل ورد حديث الصلاة عماد الدين؟",
      candidate: "الصلاة عماد الدين",
      text: "لم نجد هذه العبارة حرفيا «الصلاة عماد الدين» في الأدلة المرفقة [1].",
    },
    {
      language: "english",
      question: "Hadith: prayer is the pillar of religion",
      candidate: "prayer is the pillar of religion",
      text: 'The exact wording "prayer is the pillar of religion" could not be found in the cited evidence [1].',
    },
  ];

  for (const draft of drafts) {
    const { generateGroundedAnswer } = loadGroundedAnswerModule({
      completeLlmText: async () => ({
        status: "ok",
        text: draft.text,
        provider: "openrouter",
        model: "google/gemma-4-26b-a4b-it:free",
      }),
    });
    const answer = await generateGroundedAnswer({
      question: draft.question,
      language: draft.language,
      quotationMatch: {
        state: "similar",
        matchedRecordIds: [],
        unmatchedCandidateTexts: [draft.candidate],
      },
      records: [sourceRecord()],
    });

    assert.equal(answer.status, "ready");
    assert.equal(answer.text, draft.text);
  }
});

test("caveat exception applies only to the matcher candidate", async () => {
  const text = "لم نجد هذا النص «حديث الصلاة عماد» في الأدلة المرفقة [1].";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "هل حديث الصلاة عماد الدين صحيح؟",
    language: "arabic",
    quotationMatch: {
      state: "similar",
      matchedRecordIds: [],
      unmatchedCandidateTexts: ["الصلاة عماد الدين"],
    },
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "error");
  assert.match(answer.warnings[0].message, /quotes/);
});

test("literal match state does not permit a different fabricated quotation", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "تؤكد الرواية أن «كل عمل مضمون الأجر» [1].",
      provider: "openrouter",
      model: "google/gemma-4-26b-a4b-it:free",
    }),
  });

  const answer = await generateGroundedAnswer({
    question: "حديث: إنما الأعمال بالنيات",
    language: "arabic",
    quotationMatch: {
      state: "literal",
      matchedRecordIds: ["bukhari-1"],
      unmatchedCandidateTexts: [],
    },
    records: [sourceRecord()],
  });

  assert.equal(answer.status, "error");
  assert.match(answer.warnings[0].message, /quotes/);
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

test("Arabic answer may summarize a cited Quran record without repeating the verse", async () => {
  const text = "تقرر الآية أن التكليف يكون في حدود الاستطاعة [1].";
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text,
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

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, text);
});

test("Arabic answer rejects a fabricated Quran quotation", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "تقول الآية: «إن الله يكلف النفس فوق وسعها» [1].",
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
  assert.match(answer.warnings[0].message, /quotes/);
});

test("Arabic answer rejects a fabricated two-word Quran quotation", async () => {
  const { generateGroundedAnswer } = loadGroundedAnswerModule({
    completeLlmText: async () => ({
      status: "ok",
      text: "تقول الآية: «فوق وسعها» [1].",
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
  assert.match(answer.warnings[0].message, /quotes/);
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
