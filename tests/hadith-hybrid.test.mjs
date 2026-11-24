import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { createTsRequire } from "./helpers/ts-require.mjs";

const retrievalDir = path.join(process.cwd(), "src/lib/retrieval");

function loadModule(filename, { env = {}, stubs = {} } = {}) {
  const fallbackRequire = createTsRequire(filename);
  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: { env },
    URL,
    require: (id) => {
      if (id in stubs) {
        return stubs[id];
      }

      // Load the hybrid helpers with the same env so their process.env defaults see it.
      if (id === "./hadith-hybrid") {
        return loadModule(path.join(retrievalDir, "hadith-hybrid.ts"), { env });
      }

      return fallbackRequire(id);
    },
  };

  sandbox.exports = sandbox.module.exports;
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  vm.runInNewContext(source, sandbox, { filename });

  return sandbox.module.exports;
}

function loadHybrid(env = {}) {
  return loadModule(path.join(retrievalDir, "hadith-hybrid.ts"), { env });
}

function record(collection, hadithNumber) {
  return { collection, hadithNumber, reference: hadithNumber, rank: null };
}

function hadithResult(collection, hadithNumber, rank, text = "text") {
  return {
    collection,
    display_name: collection,
    book: null,
    chapter: null,
    hadith_number: hadithNumber,
    arabic_text: text,
    english_text: text,
    grade: null,
    source_dataset: "test",
    source_url_or_reference: `${collection}:${hadithNumber}`,
    provenance_notes: [],
    snippet: text,
    rank,
  };
}

function searchOutput(query, results, extra = {}) {
  return { query, collection: null, language: "english", limit: 12, offset: 0, total: results.length, results, provenance_notes: [], ...extra };
}

const hadithEnv = {
  HADITH_MCP_CLI_PATH: "/opt/hadith-mcp/cli.js",
  HADITH_MCP_DB_PATH: "/opt/hadith-mcp/hadith.sqlite",
  HADITH_MCP_CWD: "/opt/hadith-mcp",
  HADITH_MCP_EMBEDDINGS_PATH: "/opt/hadith-mcp/hadith-embeddings.sqlite",
  OLLAMA_URL: "http://127.0.0.1:11434",
};

function loadHadithMcp({ env, callTool }) {
  const calls = { tools: [], config: null };
  const client = {
    callTool: async (request) => {
      calls.tools.push(request);
      return callTool(request);
    },
  };
  const hadithMcp = loadModule(path.join(retrievalDir, "hadith-mcp.ts"), {
    env,
    stubs: {
      "./mcp-stdio": {
        withStdioMcpClient: async (config, run) => {
          calls.config = config;
          return run({ client, stderr: "" });
        },
        getMcpPayload: (result) => result.structuredContent,
      },
      "./hadith-query-planner": {
        planHadithRetrievalQueries: async (query) => ({ queries: [query], planner: "fallback" }),
      },
    },
  });

  return { hadithMcp, calls };
}

test("hadith search mode defaults to lexical and accepts hybrid", () => {
  assert.equal(loadHybrid().getHadithSearchMode(), "lexical");
  assert.equal(loadHybrid({ HADITH_SEARCH_MODE: "vector" }).getHadithSearchMode(), "lexical");
  assert.equal(loadHybrid({ HADITH_SEARCH_MODE: " Hybrid " }).getHadithSearchMode(), "hybrid");
});

test("only set embedding settings are forwarded to the Hadith MCP process", () => {
  const forwarded = loadHybrid().hadithMcpEmbeddingEnv({
    HADITH_MCP_EMBEDDINGS_PATH: " /data/index.sqlite ",
    EMBEDDINGS_MODEL: "",
    OPENROUTER_API_KEY: "secret",
  });

  assert.deepEqual({ ...forwarded }, { HADITH_MCP_EMBEDDINGS_PATH: "/data/index.sqlite" });
});

test("the OpenRouter key is reused only for an OpenRouter embeddings endpoint", () => {
  const { hadithMcpEmbeddingEnv } = loadHybrid();
  const openRouter = hadithMcpEmbeddingEnv({
    EMBEDDINGS_BASE_URL: "https://openrouter.ai/api/v1",
    EMBEDDINGS_MODEL: "baai/bge-m3",
    EMBEDDINGS_INDEX_MODEL: "bge-m3",
    OPENROUTER_API_KEY: "or-key",
  });

  assert.equal(openRouter.EMBEDDINGS_API_KEY, "or-key");
  assert.equal(openRouter.EMBEDDINGS_INDEX_MODEL, "bge-m3");

  const explicit = hadithMcpEmbeddingEnv({
    EMBEDDINGS_BASE_URL: "https://openrouter.ai/api/v1",
    EMBEDDINGS_API_KEY: "own-key",
    OPENROUTER_API_KEY: "or-key",
  });
  assert.equal(explicit.EMBEDDINGS_API_KEY, "own-key");

  for (const baseUrl of ["https://embeddings.example.com/v1", "https://openrouter.ai.example.com/v1", "not a url"]) {
    const other = hadithMcpEmbeddingEnv({ EMBEDDINGS_BASE_URL: baseUrl, OPENROUTER_API_KEY: "or-key" });
    assert.equal(other.EMBEDDINGS_API_KEY, undefined, baseUrl);
  }
});

test("rank fusion rewards agreement, keeps first-list ties and renumbers ranks", () => {
  const { fuseHadithRankings } = loadHybrid();
  const fused = fuseHadithRankings([
    [record("bukhari", "1:1"), record("muslim", "1:2"), record("muslim", "1:2")],
    [record("tirmidhi", "2:1"), record("muslim", "1:2")],
  ]);

  assert.deepEqual(
    Array.from(fused, (item) => `${item.collection}:${item.hadithNumber}:${item.rank}`),
    ["muslim:1:2:1", "bukhari:1:1:2", "tirmidhi:2:1:3"],
  );
});

test("hybrid mode fuses semantic results with the lexical ranking", async () => {
  const { hadithMcp, calls } = loadHadithMcp({
    env: { ...hadithEnv, HADITH_SEARCH_MODE: "hybrid" },
    callTool: async ({ name, arguments: args }) => ({
      structuredContent:
        name === "semantic_search_hadith"
          ? searchOutput(args.query, [hadithResult("muslim", "1:103", 1, "the religion is sincere advice")], { mode: "hybrid" })
          : searchOutput(args.query, [hadithResult("bukhari", "2:42", 1, "advice")]),
    }),
  });

  const response = await hadithMcp.searchHadithSources("the religion is sincere advice", "english");

  assert.equal(response.status, "ok");
  assert.deepEqual(
    calls.tools.map((call) => call.name).sort(),
    ["search_hadith", "semantic_search_hadith"],
  );
  assert.equal(calls.tools.find((call) => call.name === "semantic_search_hadith").arguments.mode, "hybrid");
  assert.equal(calls.config.env.HADITH_MCP_EMBEDDINGS_PATH, hadithEnv.HADITH_MCP_EMBEDDINGS_PATH);
  assert.equal(calls.config.env.OLLAMA_URL, hadithEnv.OLLAMA_URL);
  assert.deepEqual(
    Array.from(response.records, (item) => `${item.collection}:${item.hadithNumber}`),
    ["muslim:1:103", "bukhari:2:42"],
  );
  assert.ok(response.provenanceNotes.some((note) => note.startsWith("Hadith semantic search: hybrid")));
  assert.ok(response.provenanceNotes.some((note) => note.includes("reciprocal rank fusion")));
});

test("hybrid mode falls back to lexical search when the semantic tool is missing", async () => {
  const { hadithMcp } = loadHadithMcp({
    env: { ...hadithEnv, HADITH_SEARCH_MODE: "hybrid" },
    callTool: async ({ name, arguments: args }) => {
      if (name === "semantic_search_hadith") {
        throw new Error("MCP error -32602: Tool semantic_search_hadith not found");
      }

      return { structuredContent: searchOutput(args.query, [hadithResult("bukhari", "2:42", 1)]) };
    },
  });

  const response = await hadithMcp.searchHadithSources("advice", "english");

  assert.equal(response.status, "ok");
  assert.deepEqual(Array.from(response.records, (item) => item.hadithNumber), ["2:42"]);
  assert.ok(response.provenanceNotes.some((note) => note.startsWith("Hadith semantic search unavailable")));
  assert.ok(!response.provenanceNotes.some((note) => note.includes("reciprocal rank fusion")));
});

test("lexical mode never calls the semantic tool or forwards embedding settings", async () => {
  const { hadithMcp, calls } = loadHadithMcp({
    env: hadithEnv,
    callTool: async ({ arguments: args }) => ({ structuredContent: searchOutput(args.query, [hadithResult("bukhari", "2:42", 1)]) }),
  });

  const response = await hadithMcp.searchHadithSources("advice", "english");

  assert.equal(response.status, "ok");
  assert.deepEqual(calls.tools.map((call) => call.name), ["search_hadith"]);
  assert.deepEqual({ ...calls.config.env }, { HADITH_MCP_DB_PATH: hadithEnv.HADITH_MCP_DB_PATH });
  assert.ok(!response.provenanceNotes.some((note) => /semantic/i.test(note)));
});
