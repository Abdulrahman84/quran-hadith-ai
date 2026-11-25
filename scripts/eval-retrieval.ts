// Retrieval benchmark: runs eval/retrieval-questions.json through searchSources and scores
// how well the expected references are ranked. Usage: npm run eval:retrieval -- --help
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type ExpectedRef = { kind: "hadith"; collection: string; hadithNumber: string } | { kind: "quran"; verseKey: string };

type EvalItem = {
  id: string;
  question: string;
  language: "arabic" | "english";
  kind: string;
  corpus: string;
  tags: string[];
  minExpected: number;
  expected: ExpectedRef[];
};

type ReturnedRecord = {
  sourceKind: string;
  collection: string;
  hadithNumber: string | null;
  verseKey: string | null;
};

type QuestionResult = {
  id: string;
  question: string;
  language: string;
  kind: string;
  tags: string[];
  status: string;
  latencyMs: number;
  recordCount: number;
  firstRelevantRank: number | null;
  hitsAt1: number;
  hitsAt5: number;
  hitsAtAll: number;
  successAt1: boolean;
  successAt5: boolean;
  reciprocalRank: number;
  returned: string[];
  warnings: string[];
  error?: string;
};

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const evalDir = path.join(projectRoot, "eval");

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

function applyLocalSourceDefaults() {
  const hadithRepo = path.resolve(projectRoot, "../hadith-mcp");
  process.env.HADITH_MCP_CWD ??= hadithRepo;
  process.env.HADITH_MCP_CLI_PATH ??= path.join(hadithRepo, "packages/hadith-mcp/dist/cli.js");
  process.env.HADITH_MCP_DB_PATH ??= path.join(hadithRepo, "data/generated/hadith-meeatif.sqlite");
  if (process.env.HADITH_SEARCH_MODE?.trim().toLowerCase() === "hybrid") {
    // The index sits next to the hadith database built in the same hadith-mcp checkout.
    process.env.HADITH_MCP_EMBEDDINGS_PATH ??= path.join(path.dirname(process.env.HADITH_MCP_DB_PATH), "hadith-embeddings.sqlite");
  }
  if (process.env.QURAN_SEARCH_MODE?.trim().toLowerCase() === "hybrid") {
    // The Quran index sits next to the quran.db it was built from (the build script's default).
    const quranDb = process.env.TAFSIR_DB_PATH?.trim() || path.join(os.homedir(), ".cache/tafsir-mcp/quran.db");
    process.env.QURAN_EMBEDDINGS_PATH ??= path.join(path.dirname(quranDb), "quran-embeddings-bge-m3.bin");
  }
}

type Options = { limit: number | null; only: string[]; ids: string[]; concurrency: number; timeoutMs: number; retrievalMode: string };

function parseArgs(argv: string[]): Options {
  const options: Options = { limit: null, only: [], ids: [], concurrency: 2, timeoutMs: 120_000, retrievalMode: "lexical" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      index += 1;
      return value;
    };
    if (arg === "--limit") options.limit = Number.parseInt(next(), 10);
    else if (arg === "--only") options.only.push(...next().split(","));
    else if (arg === "--id") options.ids.push(...next().split(","));
    else if (arg === "--concurrency") options.concurrency = Math.max(1, Number.parseInt(next(), 10));
    else if (arg === "--timeout-ms") options.timeoutMs = Number.parseInt(next(), 10);
    else if (arg === "--label") options.retrievalMode = next();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npm run eval:retrieval -- [options]
  --limit N          run only the first N matching questions
  --only tag[,tag]   run questions having any of these tags (e.g. topical, cross-lingual, hadith)
  --id id[,id]       run specific question ids
  --concurrency N    parallel questions (default 2)
  --timeout-ms N     per-question timeout (default 120000)
  --label mode       retrieval mode recorded as retrievalMode (default "lexical"; e.g. "vector", "hybrid")
Note: searchSources calls OpenRouter models, so each question costs a few LLM calls.`);
      process.exit(0);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function refKey(ref: ExpectedRef) {
  return ref.kind === "hadith" ? `hadith:${ref.collection}:${ref.hadithNumber}` : `quran:${ref.verseKey}`;
}

function recordKeys(record: ReturnedRecord): string[] {
  if (record.sourceKind === "hadith") return [`hadith:${record.collection}:${record.hadithNumber}`];
  // A tafsir record on the expected ayah counts as finding that ayah.
  return record.verseKey ? [`quran:${record.verseKey}`] : [];
}

function scoreRecords(item: EvalItem, records: ReturnedRecord[]) {
  const expectedKeys = new Set(item.expected.map(refKey));
  const foundAt = new Map<string, number>();
  records.forEach((record, index) => {
    for (const key of recordKeys(record)) {
      if (expectedKeys.has(key) && !foundAt.has(key)) foundAt.set(key, index + 1);
    }
  });
  const ranks = [...foundAt.values()].sort((left, right) => left - right);
  const hitsWithin = (k: number) => ranks.filter((rank) => rank <= k).length;
  const needed = Math.min(item.minExpected, item.expected.length);
  const firstRelevantRank = ranks[0] ?? null;
  return {
    firstRelevantRank,
    hitsAt1: hitsWithin(1),
    hitsAt5: hitsWithin(5),
    hitsAtAll: ranks.length,
    successAt1: hitsWithin(1) >= Math.min(needed, 1),
    successAt5: hitsWithin(5) >= needed,
    reciprocalRank: firstRelevantRank ? 1 / firstRelevantRank : 0,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

const mean = (values: number[]) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function aggregate(results: QuestionResult[]) {
  return {
    questions: results.length,
    errors: results.filter((result) => result.error || result.status === "error").length,
    recallAt1: mean(results.map((result) => (result.successAt1 ? 1 : 0))),
    recallAt5: mean(results.map((result) => (result.successAt5 ? 1 : 0))),
    anyHit: mean(results.map((result) => (result.hitsAtAll > 0 ? 1 : 0))),
    mrr: mean(results.map((result) => result.reciprocalRank)),
    meanLatencyMs: Math.round(mean(results.map((result) => result.latencyMs))),
    p90LatencyMs: Math.round([...results.map((result) => result.latencyMs)].sort((a, b) => a - b)[Math.max(0, Math.ceil(results.length * 0.9) - 1)] ?? 0),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  loadEnvFile(path.join(projectRoot, ".env.local"));
  applyLocalSourceDefaults();

  const { searchSources } = await import("../src/lib/retrieval/source-router");
  const dataset = JSON.parse(fs.readFileSync(path.join(evalDir, "retrieval-questions.json"), "utf8")) as { items: EvalItem[] };

  let items = dataset.items;
  if (options.ids.length > 0) items = items.filter((item) => options.ids.includes(item.id));
  if (options.only.length > 0) items = items.filter((item) => item.tags.some((tag) => options.only.includes(tag)));
  if (options.limit !== null) items = items.slice(0, options.limit);

  if (items.length === 0) {
    console.error("No questions selected.");
    process.exit(1);
  }

  console.log(`Running ${items.length} questions (concurrency ${options.concurrency})...\n`);
  const startedAt = Date.now();

  const results = await runPool(items, options.concurrency, async (item): Promise<QuestionResult> => {
    const questionStartedAt = Date.now();
    try {
      const response = await withTimeout(searchSources(item.question, item.language), options.timeoutMs);
      const latencyMs = Date.now() - questionStartedAt;
      const records = response.records as ReturnedRecord[];
      const score = scoreRecords(item, records);
      const result: QuestionResult = {
        id: item.id,
        question: item.question,
        language: item.language,
        kind: item.kind,
        tags: item.tags,
        status: response.status,
        latencyMs,
        recordCount: records.length,
        ...score,
        returned: records.slice(0, 10).map((record) => recordKeys(record)[0] ?? `${record.sourceKind}:?`),
        warnings: response.warnings.map((warning) => warning.code),
      };
      const mark = result.successAt5 ? "PASS" : result.hitsAtAll > 0 ? "LOW " : "MISS";
      console.log(
        `${mark} ${item.id.padEnd(20)} rank=${String(result.firstRelevantRank ?? "-").padStart(2)} hits@5=${result.hitsAt5}/${item.expected.length} records=${records.length} ${latencyMs}ms${result.warnings.length ? ` warn=${result.warnings.join(",")}` : ""}`,
      );
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`ERR  ${item.id.padEnd(20)} ${message}`);
      return {
        id: item.id,
        question: item.question,
        language: item.language,
        kind: item.kind,
        tags: item.tags,
        status: "error",
        latencyMs: Date.now() - questionStartedAt,
        recordCount: 0,
        firstRelevantRank: null,
        hitsAt1: 0,
        hitsAt5: 0,
        hitsAtAll: 0,
        successAt1: false,
        successAt5: false,
        reciprocalRank: 0,
        returned: [],
        warnings: [],
        error: message,
      };
    }
  });

  const overall = aggregate(results);
  const tags = [...new Set(results.flatMap((result) => result.tags))].sort();
  const byTag = Object.fromEntries(tags.map((tag) => [tag, aggregate(results.filter((result) => result.tags.includes(tag)))]));
  const byLanguage = Object.fromEntries(
    ["arabic", "english"].map((language) => [language, aggregate(results.filter((result) => result.language === language))]),
  );

  console.log(`\nOverall [${options.retrievalMode}] (${overall.questions} questions, ${overall.errors} errors)`);
  console.log(`  recall@1 ${pct(overall.recallAt1)}  recall@5 ${pct(overall.recallAt5)}  any-hit ${pct(overall.anyHit)}  MRR ${overall.mrr.toFixed(3)}`);
  console.log(`  latency mean ${overall.meanLatencyMs}ms  p90 ${overall.p90LatencyMs}ms`);
  console.log("\nBy tag:");
  for (const [tag, stats] of Object.entries(byTag)) {
    console.log(`  ${tag.padEnd(16)} n=${String(stats.questions).padStart(2)}  R@1 ${pct(stats.recallAt1).padStart(6)}  R@5 ${pct(stats.recallAt5).padStart(6)}  MRR ${stats.mrr.toFixed(3)}`);
  }
  console.log("\nBy language:");
  for (const [language, stats] of Object.entries(byLanguage)) {
    console.log(`  ${language.padEnd(16)} n=${String(stats.questions).padStart(2)}  R@1 ${pct(stats.recallAt1).padStart(6)}  R@5 ${pct(stats.recallAt5).padStart(6)}  MRR ${stats.mrr.toFixed(3)}`);
  }

  const resultsDir = path.join(evalDir, "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeMode = options.retrievalMode.replace(/[^a-z0-9._-]/gi, "_");
  const reportPath = path.join(resultsDir, `${stamp}-${safeMode}.json`);
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        reportVersion: 1,
        retrievalMode: options.retrievalMode,
        startedAt: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        options,
        models: {
          router: process.env.MCP_TOOL_ROUTER_MODEL ?? process.env.OPENROUTER_MODEL ?? null,
          hadithPlanner: process.env.HADITH_QUERY_PLANNER_MODEL ?? null,
        },
        searchModes: {
          hadith: process.env.HADITH_SEARCH_MODE?.trim() || "lexical",
          quran: process.env.QURAN_SEARCH_MODE?.trim() || "lexical",
        },
        overall,
        byTag,
        byLanguage,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nReport: ${path.relative(projectRoot, reportPath)}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
