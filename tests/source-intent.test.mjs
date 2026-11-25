import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

import { createTsRequire } from "./helpers/ts-require.mjs";


function loadSourceIntent(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/retrieval/source-intent.ts");
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
    exports: {},
    module: { exports: {} },
    process: { env: {} },
    require: (id) => {
      if (id === "../llm/provider") {
        return {
          completeLlmText: async (input) => {
            if (overrides.process?.env?.MCP_TOOL_ROUTER_ENABLED === "false" || !overrides.process?.env?.OPENROUTER_API_KEY) {
              return {
                status: "disabled",
                error: "OpenRouter is not configured for router.",
                provider: "openrouter",
                model: "google/gemma-4-26b-a4b-it:free",
              };
            }

            const response = await overrides.fetch("https://openrouter.test/api/v1/chat/completions", {
              body: JSON.stringify({
                model: overrides.process?.env?.MCP_TOOL_ROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
                messages: input.messages,
                response_format: input.json ? { type: "json_object" } : undefined,
              }),
            });
            const payload = await response.json();

            return {
              status: "ok",
              text: payload.choices?.[0]?.message?.content || "",
              provider: "openrouter",
              model: overrides.process?.env?.MCP_TOOL_ROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
            };
          },
        };
      }

      return createTsRequire(filename)(id);
    },
    setTimeout,
    clearTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("lets the AI router choose source tools from the approved MCP set", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);

      assert.equal(body.model, "router-model");
      assert.match(body.messages.at(-1).content, /patience/);

      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"routes":["tafsir","hadith"],"reason":"The question asks for broad evidence."}',
              },
            },
          ],
        }),
      };
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
        MCP_TOOL_ROUTER_MODEL: "router-model",
      },
    },
  });

  const decision = await planSourceRouteDecision("What evidence is there about patience?");

  assert.equal(decision.planner, "llm");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.equal(decision.reason, "The question asks for broad evidence.");
  assert.equal(decision.warning, null);
});

test("adds both routes for broad Islamic topics when the model is too narrow", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["tafsir"],"reason":"The model chose Quran evidence."}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("ما المصادر عن الصبر؟");

  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
});

test("keeps explicitly Quran-only questions on the tafsir route", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["tafsir"],"reason":"The question asks for tafsir."}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("تفسير آية كل من عليها فان");

  assert.deepEqual(Array.from(decision.routes), ["tafsir"]);
});

test("falls back to both routes when the AI router returns invalid tools", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"routes":["web_search"],"reason":"unsupported"}' } }],
      }),
    }),
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("What is said about intention?");

  assert.equal(decision.planner, "heuristic");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.match(decision.warning, /invalid route plan/);
});

test("falls back to keyword routing when the AI router is not configured", async () => {
  const { planSourceRouteDecision } = loadSourceIntent({
    process: {
      env: {
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const decision = await planSourceRouteDecision("What sources mention mercy?");

  assert.equal(decision.planner, "heuristic");
  assert.deepEqual(Array.from(decision.routes), ["tafsir", "hadith"]);
  assert.match(decision.warning, /OpenRouter is not configured/i);
});

test("skips the AI router when the question names its source explicitly", async () => {
  let routerCalls = 0;
  const { planSourceRouteDecision } = loadSourceIntent({
    fetch: async () => {
      routerCalls += 1;
      throw new Error("router should not be called");
    },
    process: {
      env: {
        OPENROUTER_API_KEY: "test-key",
        MCP_TOOL_ROUTER_ENABLED: "true",
      },
    },
  });

  const hadithOnly = await planSourceRouteDecision("Find hadith about intention");
  const quranOnly = await planSourceRouteDecision("ما تفسير سورة الإخلاص");

  assert.equal(routerCalls, 0);
  assert.equal(hadithOnly.planner, "heuristic");
  assert.deepEqual(Array.from(hadithOnly.routes), ["hadith"]);
  assert.equal(hadithOnly.warning, null);
  assert.deepEqual(Array.from(quranOnly.routes), ["tafsir"]);
});

test("Egyptian «ايه» (what) is not read as «آية» (verse)", () => {
  const { heuristicSourceRoutes, isExplicitQuranOnlyRequest, isExplicitHadithOnlyRequest } = loadSourceIntent();

  assert.equal(isExplicitQuranOnlyRequest("انا عصبي جدا، النبي قال ايه عن الغضب؟"), false);
  assert.equal(isExplicitQuranOnlyRequest("جاري بيضايقني هو الاسلام بيقول ايه عن حق الجار"), false);
  assert.deepEqual(Array.from(heuristicSourceRoutes("النبي قال ايه عن الغضب")), ["tafsir", "hadith"]);
  assert.equal(isExplicitHadithOnlyRequest("في حديث بيقول ايه عن الصبر؟"), true);

  // The verse is still recognized when spelled so it can't mean "what".
  assert.equal(isExplicitQuranOnlyRequest("اشرح آية الكرسي"), true);
  assert.equal(isExplicitQuranOnlyRequest("اشرح اية الكرسي"), true);
  assert.equal(isExplicitQuranOnlyRequest("وين الايه يلي فيها كتب عليكم الصيام"), true);
  assert.equal(isExplicitQuranOnlyRequest("ايات الصبر"), true);
  assert.equal(isExplicitQuranOnlyRequest("تفسير ايه الكرسي"), true);
});

test("the Quran as a topic is not a request to search only the Quran", () => {
  const { isExplicitQuranOnlyRequest } = loadSourceIntent();

  assert.equal(isExplicitQuranOnlyRequest("شنو ثواب اللي يقرا قرآن كل يوم"), false);
  assert.equal(isExplicitQuranOnlyRequest("فضل حفظ القرآن"), false);
  assert.equal(isExplicitQuranOnlyRequest("reward for reciting the Quran"), false);

  assert.equal(isExplicitQuranOnlyRequest("بر الوالدين في القرآن"), true);
  assert.equal(isExplicitQuranOnlyRequest("شو بيحكي القرآن عن الصبر"), true);
  assert.equal(isExplicitQuranOnlyRequest("What does the Quran say about kindness to parents?"), true);
  assert.equal(isExplicitQuranOnlyRequest("Quran on backbiting"), true);
  assert.equal(isExplicitQuranOnlyRequest("the Quran about patience"), true);
});

test("heuristic routing treats ta marbuta spellings the same", () => {
  const { heuristicSourceRoutes, isExplicitQuranOnlyRequest } = loadSourceIntent();

  assert.equal(isExplicitQuranOnlyRequest("اعرض سورة الكهف"), true);
  assert.equal(isExplicitQuranOnlyRequest("اعرض سوره الكهف"), true);
  assert.deepEqual(Array.from(heuristicSourceRoutes("ما هي الآية التي تتحدث عن الصبر")), ["tafsir"]);
  assert.deepEqual(Array.from(heuristicSourceRoutes("احاديث عن فضل سورة الكهف")), ["hadith"]);
  assert.deepEqual(Array.from(heuristicSourceRoutes("ما حكم الصدقة")), ["tafsir", "hadith"]);
});

test("a request for hadith evidence by adjective searches hadith only", async () => {
  let routerCalls = 0;
  const { heuristicSourceRoutes, isExplicitHadithOnlyRequest, planSourceRouteDecision } = loadSourceIntent({
    process: { env: { OPENROUTER_API_KEY: "test-key" } },
    fetch: async () => {
      routerCalls += 1;
      return Response.json({ choices: [{ message: { content: '{"routes":["tafsir","hadith"]}' } }] });
    },
  });

  assert.equal(isExplicitHadithOnlyRequest("اعرض دليلا حديثيا عن الصلاة"), true);
  assert.equal(isExplicitHadithOnlyRequest("ما الأدلة الحديثية على فضل الصدقة"), true);
  assert.equal(isExplicitHadithOnlyRequest("أعطني حديثا عن الصبر"), true);
  assert.equal(isExplicitHadithOnlyRequest("Find hadiths about prayer"), true);
  assert.deepEqual(Array.from(heuristicSourceRoutes("اعرض دليلا حديثيا عن الصلاة")), ["hadith"]);

  const decision = await planSourceRouteDecision("اعرض دليلا حديثيا عن الصلاة");

  assert.deepEqual(Array.from(decision.routes), ["hadith"]);
  assert.equal(decision.planner, "heuristic");
  assert.equal(routerCalls, 0);

  // Naming a verse as well still searches both.
  assert.deepEqual(Array.from(heuristicSourceRoutes("اعرض دليلا حديثيا ثم آية عن الصلاة")), ["tafsir", "hadith"]);
});

function routerReturning(content, onRequest = () => {}) {
  return loadSourceIntent({
    fetch: async (_url, init) => {
      onRequest(JSON.parse(init.body));
      return { ok: true, json: async () => ({ choices: [{ message: { content } }] }) };
    },
    process: { env: { OPENROUTER_API_KEY: "test-key", MCP_TOOL_ROUTER_ENABLED: "true" } },
  });
}

test("the router can read a hadith request from context without the word hadith", async () => {
  let systemPrompt = "";
  const { planSourceRouteDecision } = routerReturning(
    '{"routes":["hadith"],"limitedByUser":true,"reason":"The question asks what the Prophet said."}',
    (body) => {
      systemPrompt = body.messages[0].content;
    },
  );

  for (const question of ["ماذا قال النبي عن الغضب؟", "النبي قال ايه عن الصبر", "What did the Prophet say about anger?"]) {
    const decision = await planSourceRouteDecision(question);

    assert.equal(decision.planner, "llm", question);
    assert.deepEqual(Array.from(decision.routes), ["hadith"], question);
  }

  assert.match(systemPrompt, /Decide from what the question means, not from keywords/);
  assert.match(systemPrompt, /limitedByUser/);
});

test("a narrow route the user did not ask for is still widened for an open topic", async () => {
  const unlimited = routerReturning('{"routes":["hadith"],"limitedByUser":false,"reason":"Prayer."}');
  const missingFlag = routerReturning('{"routes":["hadith"],"reason":"Prayer."}');

  assert.deepEqual(Array.from((await unlimited.planSourceRouteDecision("ما فضل الصلاة؟")).routes), ["hadith", "tafsir"]);
  assert.deepEqual(Array.from((await missingFlag.planSourceRouteDecision("ما فضل الصلاة؟")).routes), ["hadith", "tafsir"]);
});
