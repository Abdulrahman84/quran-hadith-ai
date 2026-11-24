import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { createTsRequire } from "./helpers/ts-require.mjs";
import { createSseParser, parseChatStreamData } from "../src/lib/llm/sse.ts";
import {
  createAnswerDraftCoalescer,
  readSearchResponse,
  searchStreamMediaType,
} from "../src/lib/search-stream.ts";

function transpile(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const outputText = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;

  return { filename, outputText };
}

function loadModule(relativePath, { stubs = {}, globals = {} } = {}) {
  const { filename, outputText } = transpile(relativePath);
  const loaded = { exports: {} };
  const tsRequire = createTsRequire(filename);

  vm.runInNewContext(outputText, {
    AbortController,
    TextDecoder,
    clearTimeout,
    console,
    exports: loaded.exports,
    module: loaded,
    process,
    require: (id) => (id in stubs ? stubs[id] : tsRequire(id)),
    setTimeout,
    ...globals,
  }, { filename });

  return loaded.exports;
}

function sseBody(text, chunkSize = 1) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }

      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

function sseDelta(content) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
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

test("SSE parser survives byte-by-byte chunks, split Arabic characters and keep-alive comments", async () => {
  const stream = [
    ": OPENROUTER PROCESSING\n\n",
    sseDelta("بارك الله "),
    sseDelta("فيك [1]."),
    "data: [DONE]\n\n",
  ].join("");
  const reader = sseBody(stream).getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    const events = done ? [...parser.push(decoder.decode()), ...parser.flush()] : parser.push(decoder.decode(value, { stream: true }));
    chunks.push(...events.map(parseChatStreamData));

    if (done) {
      break;
    }
  }

  assert.deepEqual(chunks, [
    { kind: "delta", text: "بارك الله " },
    { kind: "delta", text: "فيك [1]." },
    { kind: "done" },
  ]);
});

test("SSE parser handles CRLF, multi-line data and a final event without a blank line", () => {
  const parser = createSseParser();

  assert.deepEqual(parser.push("data: a\r\ndata: b\r\n\r\ndata: tail"), ["a\nb"]);
  assert.deepEqual(parser.flush(), ["tail"]);
});

test("chat stream data reports in-stream errors and ignores role-only chunks", () => {
  assert.deepEqual(parseChatStreamData(JSON.stringify({ error: { message: "Provider overloaded", code: 502 } })), {
    kind: "error",
    message: "Provider overloaded",
    code: 502,
  });
  assert.deepEqual(parseChatStreamData(JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })), { kind: "ignore" });
  assert.deepEqual(parseChatStreamData("not json"), { kind: "ignore" });
});

test("draft coalescer batches deltas per interval and a reset drops pending text", () => {
  const sent = [];
  const scheduled = [];
  const timers = {
    setTimeout: (callback) => {
      scheduled.push(callback);
      return scheduled.length;
    },
    clearTimeout: () => {},
  };
  const coalescer = createAnswerDraftCoalescer((event) => sent.push(event), 50, timers);

  coalescer.delta("a");
  coalescer.delta("b");
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  coalescer.delta("c");
  coalescer.reset();
  coalescer.delta("d");
  coalescer.flush();

  assert.deepEqual(sent, [
    { version: 1, type: "answer_delta", text: "ab" },
    { version: 1, type: "answer_reset" },
    { version: 1, type: "answer_delta", text: "d" },
  ]);
});

test("stream reader forwards draft events and skips unknown event types", async () => {
  const lines = [
    { version: 1, type: "progress", progress: 76, phase: "answering" },
    { version: 1, type: "answer_delta", text: "تدل " },
    { version: 1, type: "sources_preview", records: [] },
    { version: 1, type: "answer_reset" },
    { version: 1, type: "answer_delta", text: "الرواية" },
    { version: 1, type: "result", progress: 100, payload: { query: "q", warnings: [] }, httpStatus: 200, ok: true },
  ].map((event) => JSON.stringify(event)).join("\n");
  const drafts = [];
  const result = await readSearchResponse(
    new Response(sseBody(`${lines}\n`, 3), { headers: { "Content-Type": `${searchStreamMediaType}; charset=utf-8` } }),
    () => {},
    (event) => drafts.push(event.type === "answer_delta" ? event.text : "<reset>"),
  );

  assert.deepEqual(drafts, ["تدل ", "<reset>", "الرواية"]);
  assert.equal(result.payload.query, "q");
});

function loadGroundedAnswer(streamLlmText) {
  return loadModule("src/lib/llm/grounded-answer/index.ts", {
    stubs: {
      "../provider": {
        completeLlmText: async () => ({ status: "error", error: "unused", provider: "openrouter", model: "m" }),
        streamLlmText,
      },
    },
  });
}

function streamingModel(chunks) {
  return async ({ onDelta }) => {
    chunks.forEach((chunk) => onDelta(chunk));
    return { status: "ok", text: chunks.join("").trim(), provider: "openrouter", model: "m" };
  };
}

test("a streamed answer that passes the checks is kept as-is", async () => {
  const chunks = ["Actions are connected ", "to intentions [", "1]."];
  const { generateGroundedAnswer } = loadGroundedAnswer(streamingModel(chunks));
  const events = [];
  const answer = await generateGroundedAnswer(
    { question: "What about intentions?", language: "english", records: [sourceRecord()] },
    { onDraft: (event) => events.push(event) },
  );

  assert.equal(answer.status, "ready");
  assert.equal(answer.text, "Actions are connected to intentions [1].");
  assert.deepEqual(Array.from(answer.warnings), []);
  assert.ok(events.every((event) => event.type === "delta"));
  assert.deepEqual(events.map((event) => event.text), ["Actions are connected ", "to intentions ", "[1]."]);
});

test("thinking blocks never reach the streamed draft", async () => {
  const chunks = ["<thi", "nk>planning</think>", "Actions follow intentions [1]."];
  const { generateGroundedAnswer } = loadGroundedAnswer(streamingModel(chunks));
  const shown = [];

  await generateGroundedAnswer(
    { question: "What about intentions?", language: "english", records: [sourceRecord()] },
    { onDraft: (event) => shown.push(event.type === "delta" ? event.text : "<reset>") },
  );

  assert.equal(shown.join(""), "Actions follow intentions [1].");
});

test("a draft that breaks a guard is withdrawn mid-stream and the final answer is marked replaced", async () => {
  const chunks = ["Intentions matter [1]. ", "You must ", "always do this."];
  const { generateGroundedAnswer, answerReplacedWarningCode } = loadGroundedAnswer(streamingModel(chunks));
  const events = [];
  const answer = await generateGroundedAnswer(
    { question: "What about intentions?", language: "english", records: [sourceRecord()] },
    { onDraft: (event) => events.push(event) },
  );

  assert.deepEqual(events.map((event) => event.type), ["delta", "reset"]);
  assert.notEqual(answer.status, "ready");
  assert.ok(answer.warnings.some((warning) => warning.code === answerReplacedWarningCode));
});

test("a draft citing a number outside the source pack is withdrawn", async () => {
  const chunks = ["Intentions matter [1]. ", "See also [7]."];
  const { generateGroundedAnswer, answerReplacedWarningCode } = loadGroundedAnswer(streamingModel(chunks));
  const events = [];
  const answer = await generateGroundedAnswer(
    { question: "What about intentions?", language: "english", records: [sourceRecord()] },
    { onDraft: (event) => events.push(event) },
  );

  assert.equal(events.at(-1).type, "reset");
  assert.ok(answer.warnings.some((warning) => warning.code === answerReplacedWarningCode));
});

function loadProvider(fetchImpl) {
  return loadModule("src/lib/llm/provider.ts", {
    stubs: {
      "./credit-monitor": {
        checkOpenRouterCreditBalanceIfDue: async () => {},
        reportOpenRouterCreditFailure: async () => {},
      },
    },
    globals: { fetch: fetchImpl },
  });
}

function withAnswerEnv(run) {
  const keys = ["OPENROUTER_API_KEY", "ANSWER_MODEL", "ANSWER_FALLBACK_MODELS", "LLM_ENABLED"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.ANSWER_MODEL = "first/model";
  process.env.ANSWER_FALLBACK_MODELS = "second/model";
  delete process.env.LLM_ENABLED;

  return run().finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("streaming falls back to the next model when the first fails before any text", () =>
  withAnswerEnv(async () => {
    const models = [];
    const { streamLlmText } = loadProvider(async (_url, init) => {
      const { model, stream } = JSON.parse(init.body);
      models.push(model);
      assert.equal(stream, true);

      if (model === "first/model") {
        return new Response(JSON.stringify({ error: { message: "down", code: 503 } }), { status: 503 });
      }

      return new Response(sseBody(`${sseDelta("Hello ")}${sseDelta("world")}data: [DONE]\n\n`, 7), {
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    const deltas = [];
    const result = await streamLlmText({
      task: "answer",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 10,
      temperature: 0,
      onDelta: (text) => deltas.push(text),
    });

    assert.deepEqual(models, ["first/model", "second/model"]);
    assert.equal(result.status, "ok");
    assert.equal(result.text, "Hello world");
    assert.equal(result.model, "second/model");
    assert.deepEqual(deltas, ["Hello ", "world"]);
  }));

test("streaming does not splice a second model in after text was emitted", () =>
  withAnswerEnv(async () => {
    const models = [];
    const { streamLlmText } = loadProvider(async (_url, init) => {
      models.push(JSON.parse(init.body).model);
      const body = `${sseDelta("Partial ")}data: ${JSON.stringify({ error: { message: "cut off" } })}\n\n`;

      return new Response(sseBody(body, 5), { headers: { "Content-Type": "text/event-stream" } });
    });
    const result = await streamLlmText({
      task: "answer",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 10,
      temperature: 0,
      onDelta: () => {},
    });

    assert.deepEqual(models, ["first/model"]);
    assert.equal(result.status, "error");
    assert.equal(result.error, "cut off");
  }));
