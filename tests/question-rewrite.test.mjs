import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const filename = path.join(process.cwd(), "src/lib/retrieval/question-rewrite.ts");

function loadRewrite({ env = {}, complete }) {
  const sandbox = {
    exports: {},
    module: { exports: {} },
    process: { env },
    setTimeout,
    clearTimeout,
    require: (id) => {
      if (id === "../llm/provider") {
        return { completeLlmText: complete };
      }
      throw new Error(`unexpected import ${id}`);
    },
  };
  sandbox.exports = sandbox.module.exports;
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, sandbox, { filename });
  return sandbox.module.exports;
}

const ok = (fusha) => async () => ({ status: "ok", text: JSON.stringify({ fusha }), provider: "test" });

test("a dialect question gets a Fusha search phrase", async () => {
  const { rewriteQuestionForSearch } = loadRewrite({ complete: ok("بر الوالدين") });
  const rewrite = await rewriteQuestionForSearch("شو بيحكي القرآن عن انو لازم نكون منيحين مع اهلنا", "arabic");
  assert.equal(rewrite.fusha, "بر الوالدين");
});

test("no rewrite for English, verse references, unchanged text or unusable output", async () => {
  let calls = 0;
  const counted = async () => {
    calls += 1;
    return { status: "ok", text: '{"fusha": "x"}', provider: "test" };
  };
  const { rewriteQuestionForSearch } = loadRewrite({ complete: counted });
  assert.equal((await rewriteQuestionForSearch("kindness to animals", "english")).fusha, null);
  assert.equal((await rewriteQuestionForSearch("تفسير 2:255", "arabic")).fusha, null);
  assert.equal(calls, 0);

  const same = loadRewrite({ complete: ok("قُلْ هُوَ اللَّهُ أَحَدٌ") });
  assert.equal((await same.rewriteQuestionForSearch("قل هو الله أحد", "arabic")).fusha, null);

  const latin = loadRewrite({ complete: ok("anger in Islam") });
  assert.equal((await latin.rewriteQuestionForSearch("el nabi 2al eh 3an el ghadab", "arabic")).fusha, null);

  const failed = loadRewrite({ complete: async () => ({ status: "error", error: "down" }) });
  assert.deepEqual({ ...(await failed.rewriteQuestionForSearch("وش فضل الصدقة", "arabic")) }, { fusha: null, warning: "down" });
});

test("a slow rewrite never holds up the search", async () => {
  const { startQuestionRewrite } = loadRewrite({
    env: { QUESTION_REWRITE_WAIT_MS: "50" },
    complete: () => new Promise((resolve) => setTimeout(() => resolve({ status: "ok", text: '{"fusha":"بر الوالدين"}' }), 1000)),
  });
  const startedAt = Date.now();
  const rewrite = await startQuestionRewrite("منيحين مع اهلنا", "arabic");
  assert.equal(rewrite.fusha, null);
  assert.match(rewrite.warning, /too long/);
  assert.ok(Date.now() - startedAt < 500);
});
