import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { encodeQuranIndex } from "../scripts/quran-embeddings.mjs";
import { createTsRequire } from "./helpers/ts-require.mjs";

const retrievalDir = path.join(process.cwd(), "src/lib/retrieval");

function loadModule(filename, { env = {}, stubs = {}, globals = {} } = {}) {
  const fallbackRequire = createTsRequire(filename);
  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: { env },
    URL,
    AbortSignal,
    setTimeout,
    clearTimeout,
    ...globals,
    require: (id) => (id in stubs ? stubs[id] : fallbackRequire(id)),
  };

  sandbox.exports = sandbox.module.exports;
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  vm.runInNewContext(source, sandbox, { filename });

  return sandbox.module.exports;
}

const loadHybrid = (options) => loadModule(path.join(retrievalDir, "quran-hybrid.ts"), options);
const loadIndexModule = () => loadModule(path.join(retrievalDir, "quran-vector-index.ts"));

function unit(values) {
  const norm = Math.hypot(...values);
  return values.map((value) => value / norm);
}

// Three ayahs in a 3-dimensional space: each points mostly along one axis.
const tinyIndex = {
  header: { model: "bge-m3", dims: 3, recipe: "ayah+moyassar/v1", textsSha256: "x", sourceDbSha256: "y" },
  verses: [
    [1, 1],
    [2, 255],
    [112, 1],
  ],
  vectors: [unit([1, 0.1, 0]), unit([0, 1, 0.1]), unit([0.1, 0, 1])],
};

function writeTinyIndex() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "quran-index-"));
  const file = path.join(dir, "quran-embeddings.bin");
  fs.writeFileSync(file, encodeQuranIndex(tinyIndex));
  return file;
}

test("Quran search mode defaults to lexical and accepts hybrid", () => {
  assert.equal(loadHybrid().getQuranSearchMode({}), "lexical");
  assert.equal(loadHybrid().getQuranSearchMode({ QURAN_SEARCH_MODE: "vector" }), "lexical");
  assert.equal(loadHybrid().getQuranSearchMode({ QURAN_SEARCH_MODE: " Hybrid " }), "hybrid");
  assert.equal(loadHybrid().startQuranVectorSearch("الصبر", {}), undefined);
  assert.equal(loadHybrid().quranVectorWaitMs({}), 2000);
  assert.equal(loadHybrid().quranVectorWaitMs({ QURAN_VECTOR_WAIT_MS: "250" }), 250);
});

test("ayah rankings fuse by reciprocal rank, counting duplicates once and keeping the keyword list ahead on ties", () => {
  const { fuseAyahRankings } = loadHybrid();
  const fused = fuseAyahRankings([{ verseKeys: ["2:183", "2:184", "2:183"] }, { verseKeys: ["2:185", "2:183"] }]);

  assert.deepEqual(
    [...fused.map((item) => item.verseKey)],
    ["2:183", "2:185", "2:184"],
  );
  assert.ok(Math.abs(fused[0].score - (1 / 61 + 1 / 62)) < 1e-12);
  assert.deepEqual([...fused[0].ranks], [1, 2]);
  assert.deepEqual([...fused[2].ranks], [2, 0]);

  const tie = fuseAyahRankings([{ verseKeys: ["2:184"] }, { verseKeys: ["2:185"] }]);
  assert.deepEqual([...tie.map((item) => item.verseKey)], ["2:184", "2:185"]);
});

test("weighted lists count by their weight", () => {
  const { fuseAyahRankings } = loadHybrid();
  // 17:24 is in two lists. Two half-weight vector lists agreeing on 18:81 tie with the keyword list's
  // first ayah, which wins the tie.
  const fused = fuseAyahRankings([
    { verseKeys: ["2:83", "17:24"] },
    { verseKeys: ["18:81", "52:26"], weight: 0.5 },
    { verseKeys: ["18:81", "17:24"], weight: 0.5 },
  ]);

  assert.deepEqual([...fused.map((item) => item.verseKey)], ["17:24", "2:83", "18:81", "52:26"]);
  assert.ok(Math.abs(fused[2].score - 1 / 61) < 1e-12);
});

test("a written index loads and returns the nearest ayahs", () => {
  const { loadQuranVectorIndex, searchQuranVectorIndex } = loadIndexModule();
  const file = writeTinyIndex();

  return loadQuranVectorIndex(file, "bge-m3").then((index) => {
    assert.equal(index.size, 3);
    assert.equal(index.dims, 3);
    assert.deepEqual([...index.verseKeys], ["1:1", "2:255", "112:1"]);

    const hits = searchQuranVectorIndex(index, Float32Array.from(unit([0, 1, 0.2])), 2);
    assert.deepEqual(
      [...hits.map((hit) => hit.verseKey)],
      ["2:255", "112:1"],
    );
    assert.ok(hits[0].similarity > 0.99);
  });
});

test("an index for another model, a truncated file or a foreign file is refused", async () => {
  const { loadQuranVectorIndex, parseQuranVectorIndex } = loadIndexModule();
  const file = writeTinyIndex();

  await assert.rejects(loadQuranVectorIndex(file, "qwen3-embedding"), /built with bge-m3/);
  assert.throws(() => parseQuranVectorIndex(fs.readFileSync(file).subarray(0, -4)), /header implies/);
  assert.throws(() => parseQuranVectorIndex(Buffer.from("SQLite format 3\0 and more")), /bad magic/);
});

function fakeEmbedder(vectorsByText, calls = []) {
  return {
    provider: "fake",
    model: "bge-m3",
    async embed(texts) {
      calls.push(...texts);
      return texts.map((text) => {
        if (!(text in vectorsByText)) throw new Error(`no vector for ${text}`);
        return Float32Array.from(vectorsByText[text]);
      });
    },
  };
}

test("the vector search embeds the question once and returns its nearest ayahs", async () => {
  const file = writeTinyIndex();
  const calls = [];
  const search = await loadHybrid()
    .searchQuranVectors("وش معنى قل هو الله", {
      env: { QURAN_EMBEDDINGS_PATH: file },
      embedder: fakeEmbedder({ "وش معنى قل هو الله": unit([0.1, 0, 1]) }, calls),
    })
    .collect(1000);

  assert.equal(search.status, "ok");
  assert.deepEqual(calls, ["وش معنى قل هو الله"]);
  assert.equal(search.lists.length, 1);
  assert.equal(search.lists[0].hits[0].verseKey, "112:1");
  assert.equal(search.indexSize, 3);
});

test("the vector search reports why it is unavailable instead of failing", async () => {
  const { searchQuranVectors: start } = loadHybrid();
  const searchQuranVectors = (...args) => start(...args).collect(1000);
  const file = writeTinyIndex();

  const noPath = await searchQuranVectors("الصبر", { env: {}, embedder: fakeEmbedder({}) });
  assert.equal(noPath.status, "unavailable");
  assert.match(noPath.reason, /QURAN_EMBEDDINGS_PATH/);

  const noProvider = await searchQuranVectors("الصبر", { env: { QURAN_EMBEDDINGS_PATH: file }, embedder: null });
  assert.match(noProvider.reason, /no embedding provider/);

  const apiDown = await searchQuranVectors("الصبر", { env: { QURAN_EMBEDDINGS_PATH: file }, embedder: fakeEmbedder({}) });
  assert.equal(apiDown.status, "unavailable");
  assert.match(apiDown.reason, /no vector for/);

  const missingFile = await searchQuranVectors("الصبر", {
    env: { QURAN_EMBEDDINGS_PATH: path.join(path.dirname(file), "missing.bin") },
    embedder: fakeEmbedder({ الصبر: unit([1, 0, 0]) }),
  });
  assert.equal(missingFile.status, "unavailable");
  assert.match(missingFile.reason, /ENOENT/);
});

function slowEmbedder(delays) {
  return {
    provider: "fake",
    model: "bge-m3",
    embed: ([text]) => new Promise((resolve) => setTimeout(() => resolve([Float32Array.from(unit([1, 0, 0]))]), delays[text])),
  };
}

test("the keyword search waits a bounded time for a slow embedding, then gives up", async () => {
  const file = writeTinyIndex();
  const { searchQuranVectors } = loadHybrid();
  const env = { QURAN_EMBEDDINGS_PATH: file };

  const quick = await searchQuranVectors("الصبر", { env, embedder: slowEmbedder({ الصبر: 5 }) }).collect(200);
  assert.equal(quick.status, "ok");

  const startedAt = Date.now();
  const late = await searchQuranVectors("الصبر", { env, embedder: slowEmbedder({ الصبر: 500 }) }).collect(40);
  assert.equal(late.status, "unavailable");
  assert.match(late.reason, /not ready within 40 ms/);
  assert.ok(Date.now() - startedAt < 300);

  // The budget counts from when the question arrived: a search collected after it ran out does not wait.
  const handle = searchQuranVectors("الصبر", { env, embedder: slowEmbedder({ الصبر: 500 }) });
  await new Promise((resolve) => setTimeout(resolve, 60));
  const collectStartedAt = Date.now();
  assert.equal((await handle.collect(50)).status, "unavailable");
  assert.ok(Date.now() - collectStartedAt < 30);
});

// Tafsir MCP integration: keyword search through a stubbed MCP client, vector search injected.

function loadTafsirMcp(callTool, env = {}) {
  const calls = [];
  const client = {
    callTool: async (request) => {
      calls.push(request);
      return { structuredContent: callTool(request) };
    },
  };
  const tafsirMcp = loadModule(path.join(retrievalDir, "tafsir-mcp.ts"), {
    env,
    stubs: {
      "./mcp-stdio": {
        withStdioMcpClient: async (_config, run) => run({ client, stderr: [] }),
        getMcpPayload: (result) => result.structuredContent,
      },
    },
  });
  return { tafsirMcp, calls };
}

const quranText = { "2:183": "كتب عليكم الصيام", "2:185": "شهر رمضان", "2:184": "أياما معدودات", "94:5": "فإن مع العسر يسرا" };

function tafsirServer({ quranHits = [] } = {}) {
  return (request) => {
    const args = request.arguments;
    if (request.name === "search_quran_text") {
      return { result: quranHits.map(([surah, ayah]) => ({ surah, ayah, text: quranText[`${surah}:${ayah}`] ?? "نص" })) };
    }
    if (request.name === "fetch_ayah") {
      return { surah: args.surah, ayah: args.ayah, text: quranText[`${args.surah}:${args.ayah}`] ?? "نص" };
    }
    if (request.name === "fetch_tafsir") {
      return {
        surah: args.surah,
        ayah: args.ayah,
        tafsirs: [{ source: "moyassar", attribution: "Al-Muyassar", text: `تفسير ${args.surah}:${args.ayah}` }],
      };
    }
    return { result: [] };
  };
}

const vectorHandle = (search) => ({ collect: async () => search });
const vectorOk = (...lists) =>
  vectorHandle({
    status: "ok",
    lists: lists.map((keys, index) => ({ query: `q${index}`, hits: keys.map((verseKey) => ({ verseKey, similarity: 0.6 })) })),
    model: "bge-m3",
    provider: "fake",
    indexSize: 6236,
    ms: 5,
  });

test("hybrid Quran search fuses keyword and vector ayahs, verses first, and fetches what only the vectors found", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp(tafsirServer({ quranHits: [[2, 184], [2, 183]] }));
  const response = await tafsirMcp.searchTafsirSources("الصيام", "arabic", {
    tafsirSource: "moyassar",
    vectorSearch: vectorOk(["2:183", "2:185"], ["2:183"]),
  });

  const verses = [...response.records.filter((record) => record.sourceKind === "quran").map((record) => record.verseKey)];
  // 2:183 is in every list; 2:184 (keyword rank 1, 1/61) beats 2:185 (half-weight vector rank 2).
  assert.deepEqual(verses, ["2:183", "2:184", "2:185"]);
  assert.deepEqual(
    response.records.map((record) => record.rank),
    response.records.map((_, index) => index + 1),
  );
  assert.ok(response.records.slice(0, 3).every((record) => record.sourceKind === "quran"));
  assert.ok(response.records.some((record) => record.sourceKind === "tafsir" && record.verseKey === "2:185"));
  // Only the vector-only ayah is fetched separately.
  assert.deepEqual(
    calls.filter((call) => call.name === "fetch_ayah").map((call) => `${call.arguments.surah}:${call.arguments.ayah}`),
    ["2:185"],
  );
  assert.ok(response.provenanceNotes.some((note) => note.includes("Quran search: hybrid") && note.includes("k=60")));
});

test("the vector search adds at most a few ayahs and never drops a keyword match", async () => {
  const keywordHits = [[2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7]];
  const vectorKeys = Array.from({ length: 20 }, (_, index) => `3:${index + 1}`);
  const { tafsirMcp, calls } = loadTafsirMcp(tafsirServer({ quranHits: keywordHits }));
  const response = await tafsirMcp.searchTafsirSources("كلمة", "arabic", { tafsirSource: "moyassar", vectorSearch: vectorOk(vectorKeys) });

  const verses = new Set(response.records.map((record) => record.verseKey));
  keywordHits.forEach(([surah, ayah]) => assert.ok(verses.has(`${surah}:${ayah}`)));
  assert.ok(calls.filter((call) => call.name === "fetch_ayah").length <= tafsirMcp.QURAN_VECTOR_ADDITIONS);
});

test("vector results answer a question the keyword search finds nothing for", async () => {
  const { tafsirMcp } = loadTafsirMcp(tafsirServer());
  const response = await tafsirMcp.searchTafsirSources("Which verse made fasting obligatory?", "english", {
    tafsirSource: "mukhtasar_en",
    vectorSearch: vectorOk(["2:183"]),
  });

  assert.equal(response.status, "ok");
  assert.equal(response.records[0].verseKey, "2:183");
  assert.equal(response.warnings.length, 0);
});

test("an unavailable vector search falls back to keyword results with a provenance note", async () => {
  const { tafsirMcp } = loadTafsirMcp(tafsirServer({ quranHits: [[94, 5]] }));
  const response = await tafsirMcp.searchTafsirSources("فإن مع العسر يسرا", "arabic", {
    tafsirSource: "moyassar",
    vectorSearch: vectorHandle({ status: "unavailable", reason: "the Quran index was built with bge-m3, but EMBEDDINGS_INDEX_MODEL is x." }),
  });

  assert.deepEqual(
    [...response.records.map((record) => `${record.sourceKind}:${record.verseKey}`)],
    ["quran:94:5", "tafsir:94:5"],
  );
  assert.ok(response.provenanceNotes.some((note) => note.startsWith("Quran semantic search unavailable, used keyword search only")));
});

test("a verse named by reference is fetched directly, without vector additions", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp(tafsirServer());
  let collected = false;
  const response = await tafsirMcp.searchTafsirSources("2:183", "english", {
    tafsirSource: "moyassar",
    vectorSearch: { collect: async () => ((collected = true), { status: "unavailable", reason: "unused" }) },
  });

  assert.equal(collected, false, "the vector search is not waited for");

  assert.deepEqual([...new Set(response.records.map((record) => record.verseKey))], ["2:183"]);
  assert.equal(calls.filter((call) => call.name === "fetch_ayah").length, 1);
  assert.ok(response.provenanceNotes.some((note) => note.startsWith("Quran semantic search skipped")));
});
