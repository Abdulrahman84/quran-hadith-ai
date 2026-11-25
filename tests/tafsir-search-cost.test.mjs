import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { createTsRequire } from "./helpers/ts-require.mjs";

const filename = path.join(process.cwd(), "src/lib/retrieval/tafsir-mcp.ts");

function loadTafsirMcp(callTool) {
  const calls = [];
  const client = {
    callTool: async (request) => {
      calls.push(request);
      return { structuredContent: callTool(request) };
    },
  };
  const fallbackRequire = createTsRequire(filename);
  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: { env: {} },
    require: (id) =>
      id === "./mcp-stdio"
        ? {
            withStdioMcpClient: async (_config, run) => run({ client, stderr: "" }),
            getMcpPayload: (result) => result.structuredContent,
          }
        : fallbackRequire(id),
  };
  sandbox.exports = sandbox.module.exports;
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  vm.runInNewContext(source, sandbox, { filename });
  return { tafsirMcp: sandbox.module.exports, calls };
}

const nothing = () => ({ result: [] });

test("al-Tabari is not text-searched when all tafsirs are selected", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp(nothing);
  await tafsirMcp.searchTafsirSources("صلة الرحم", "arabic");

  const searched = calls.filter((call) => call.name === "search_in_tafsir").map((call) => call.arguments.source);
  assert.ok(searched.length > 0);
  assert.ok(!searched.includes("tabary"), "al-Tabari is skipped in the verse-finding search");
  assert.ok(searched.includes("katheer") && searched.includes("moyassar"));
});

test("al-Tabari is still searched when the user picks it", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp(nothing);
  await tafsirMcp.searchTafsirSources("صلة الرحم", "arabic", { tafsirSource: "tabary" });

  const searched = new Set(calls.filter((call) => call.name === "search_in_tafsir").map((call) => call.arguments.source));
  assert.deepEqual([...searched], ["tabary"]);
});

test("a question that finds nothing makes a bounded number of attempts", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp(nothing);
  await tafsirMcp.searchTafsirSources("كيف اتعامل مع جاري اللي بيضايقني كل يوم وبيعمل دوشة بالليل وانا تعبان", "arabic", {
    questionRewrite: Promise.resolve({ fusha: "حقوق الجار وإيذاء الجار", warning: null }),
  });

  const attempts = calls.filter((call) => call.name === "search_quran_text").length;
  assert.ok(attempts <= 4, `expected at most 4 attempts, got ${attempts}`);
});

test("verses found are fetched with every tafsir, including al-Tabari", async () => {
  const { tafsirMcp, calls } = loadTafsirMcp((request) =>
    request.name === "search_quran_text" ? { result: [{ surah: 2, ayah: 83, text: "وبالوالدين إحسانا" }] } : { result: [] },
  );
  await tafsirMcp.searchTafsirSources("بالوالدين إحسانا", "arabic");

  const fetches = calls.filter((call) => call.name === "fetch_tafsir");
  assert.ok(fetches.length > 0);
  assert.ok(fetches.every((call) => call.arguments.sources.includes("tabary")));
});
