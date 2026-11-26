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
    EMBEDDINGS_DIMENSIONS: "1024",
    EMBEDDINGS_QUERY_PREFIX: "Instruct: x\\nQuery: ",
    EMBEDDINGS_PROVIDER_ORDER: "DeepInfra",
    OPENROUTER_API_KEY: "or-key",
  });

  assert.equal(openRouter.EMBEDDINGS_API_KEY, "or-key");
  assert.equal(openRouter.EMBEDDINGS_INDEX_MODEL, "bge-m3");
  assert.equal(openRouter.EMBEDDINGS_DIMENSIONS, "1024");
  assert.equal(openRouter.EMBEDDINGS_QUERY_PREFIX, "Instruct: x\\nQuery: ");
  assert.equal(openRouter.EMBEDDINGS_PROVIDER_ORDER, "DeepInfra");

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

// A stand-in for the search's shared query embedding: vectors for the given texts, or a failure.
function sharedEmbedding(vectorsByText, { failure = null } = {}) {
  return {
    model: "bge-m3",
    provider: "fake",
    startedAt: Date.now(),
    texts: Object.keys(vectorsByText),
    vectorFor: (text) =>
      text in vectorsByText
        ? Promise.resolve(failure ? { ok: false, reason: failure } : { ok: true, vector: Float32Array.from(vectorsByText[text]) })
        : null,
  };
}

function semanticServer({ querySource = "caller", refuseVectors = false } = {}) {
  return async ({ name, arguments: args }) => {
    if (name !== "semantic_search_hadith") {
      return { structuredContent: searchOutput(args.query, [hadithResult("bukhari", "2:42", 1, "advice")]) };
    }

    if (refuseVectors && args.query_embedding) {
      return { isError: true, content: [{ type: "text", text: "Input validation error" }] };
    }

    const source = querySource === null ? {} : { query_embedding_source: args.query_embedding ? querySource : "server" };
    return {
      structuredContent: searchOutput(args.query, [hadithResult("muslim", "1:103", 1, "sincere advice")], { mode: "hybrid", ...source }),
    };
  };
}

const semanticCalls = (calls) => calls.tools.filter((call) => call.name === "semantic_search_hadith").map((call) => call.arguments);

test("hybrid mode sends the shared question embedding to the Hadith MCP", async () => {
  const { hadithMcp, calls } = loadHadithMcp({ env: { ...hadithEnv, HADITH_SEARCH_MODE: "hybrid" }, callTool: semanticServer() });

  const response = await hadithMcp.searchHadithSources("sincere advice", "english", {
    queryEmbedding: sharedEmbedding({ "sincere advice": [0.6, 0.8] }),
  });

  const [semantic] = semanticCalls(calls);
  assert.deepEqual(Array.from(semantic.query_embedding), [0.6, 0.8].map(Math.fround));
  assert.equal(semantic.query_embedding_model, "bge-m3");
  assert.equal(semantic.mode, "hybrid");
  // The Hadith MCP still gets the embedding settings, to embed by itself when it has to.
  assert.equal(calls.config.env.OLLAMA_URL, hadithEnv.OLLAMA_URL);
  assert.deepEqual(Array.from(response.records, (item) => item.hadithNumber), ["1:103", "2:42"]);
  assert.ok(response.provenanceNotes.some((note) => note.includes("used the app's shared query embedding")));
});

test("the rewrite's vector is sent only when it joined the question's embedding request", async () => {
  const questionRewrite = Promise.resolve({ fusha: "النصيحة", warning: null });
  const env = { ...hadithEnv, HADITH_SEARCH_MODE: "hybrid" };

  const both = loadHadithMcp({ env, callTool: semanticServer() });
  await both.hadithMcp.searchHadithSources("الدين نصيحه", "arabic", {
    questionRewrite,
    queryEmbedding: sharedEmbedding({ "الدين نصيحه": [1, 0], النصيحة: [0, 1] }),
  });
  assert.deepEqual(
    semanticCalls(both.calls)
      .map((args) => [args.query, Array.from(args.query_embedding ?? [])])
      .sort(([left], [right]) => left.localeCompare(right)),
    [
      ["الدين نصيحه", [1, 0]],
      ["النصيحة", [0, 1]],
    ].sort(([left], [right]) => left.localeCompare(right)),
  );

  const questionOnly = loadHadithMcp({ env, callTool: semanticServer() });
  const response = await questionOnly.hadithMcp.searchHadithSources("الدين نصيحه", "arabic", {
    questionRewrite,
    queryEmbedding: sharedEmbedding({ "الدين نصيحه": [1, 0] }),
  });
  const question = semanticCalls(questionOnly.calls).find((args) => args.query === "الدين نصيحه");
  const rewrite = semanticCalls(questionOnly.calls).find((args) => args.query !== "الدين نصيحه");
  assert.ok(question.query_embedding);
  assert.equal(rewrite.query, "النصيحة");
  assert.equal(rewrite.query_embedding, undefined);
  assert.ok(!response.provenanceNotes.some((note) => note.includes("(rewrite)")));
});

test("without a usable shared vector the Hadith MCP embeds the question itself", async () => {
  const env = { ...hadithEnv, HADITH_SEARCH_MODE: "hybrid" };

  const failed = loadHadithMcp({ env, callTool: semanticServer() });
  const failedResponse = await failed.hadithMcp.searchHadithSources("sincere advice", "english", {
    queryEmbedding: sharedEmbedding({ "sincere advice": [1, 0] }, { failure: "HTTP 503" }),
  });
  assert.equal(semanticCalls(failed.calls)[0].query_embedding, undefined);
  assert.ok(failedResponse.provenanceNotes.some((note) => note.includes("was not used (HTTP 503); the Hadith MCP embedded it itself")));
  assert.equal(failedResponse.records[0].hadithNumber, "1:103");

  const noProvider = loadHadithMcp({ env, callTool: semanticServer() });
  await noProvider.hadithMcp.searchHadithSources("sincere advice", "english", { queryEmbedding: null });
  assert.equal(semanticCalls(noProvider.calls)[0].query_embedding, undefined);

  // A Hadith MCP built before query_embedding drops the argument and embeds the question itself.
  const older = loadHadithMcp({ env, callTool: semanticServer({ querySource: null }) });
  const olderResponse = await older.hadithMcp.searchHadithSources("sincere advice", "english", {
    queryEmbedding: sharedEmbedding({ "sincere advice": [1, 0] }),
  });
  assert.equal(olderResponse.records[0].hadithNumber, "1:103");
  assert.ok(olderResponse.provenanceNotes.some((note) => note.includes("as builds without query_embedding do")));

  // One that checks the vector and finds it doesn't fit its index says so and embeds it itself.
  const mismatched = loadHadithMcp({ env, callTool: semanticServer({ querySource: "server" }) });
  const mismatchedResponse = await mismatched.hadithMcp.searchHadithSources("sincere advice", "english", {
    queryEmbedding: sharedEmbedding({ "sincere advice": [1, 0] }),
  });
  assert.ok(mismatchedResponse.provenanceNotes.some((note) => note.includes("did not use the app's query embedding (question)")));

  // One that refuses the argument outright is asked again without it.
  const refusing = loadHadithMcp({ env, callTool: semanticServer({ refuseVectors: true }) });
  const refusingResponse = await refusing.hadithMcp.searchHadithSources("sincere advice", "english", {
    queryEmbedding: sharedEmbedding({ "sincere advice": [1, 0] }),
  });
  assert.deepEqual(
    semanticCalls(refusing.calls).map((args) => Boolean(args.query_embedding)),
    [true, false],
  );
  assert.equal(refusingResponse.records[0].hadithNumber, "1:103");
  assert.ok(refusingResponse.provenanceNotes.some((note) => note.includes("refused the query_embedding argument")));
});
