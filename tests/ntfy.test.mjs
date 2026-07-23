import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadNotifier(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/notifications/ntfy.ts");
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const sandbox = {
    AbortController,
    URL,
    clearTimeout,
    exports: {},
    fetch,
    module: { exports: {} },
    process: { env: {} },
    setTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("ntfy sends an authenticated urgent credit alert", async () => {
  const requests = [];
  const { sendCreditAlert } = loadNotifier({
    fetch: async (url, init) => {
      requests.push({ url, init });
      return { ok: true };
    },
    process: { env: { NTFY_TOPIC: "sanad", NTFY_ACCESS_TOKEN: "ntfy-token" } },
  });

  assert.equal(await sendCreditAlert({ state: "exhausted" }), true);
  assert.equal(requests[0].url, "https://ntfy.sh/");
  assert.equal(requests[0].init.headers.Authorization, "Bearer ntfy-token");
  const notification = JSON.parse(requests[0].init.body);
  assert.equal(notification.topic, "sanad");
  assert.equal(notification.priority, 5);
});

test("ntfy failures never escape to the model request", async () => {
  const { sendCreditAlert } = loadNotifier({
    fetch: async () => {
      throw new Error("ntfy unavailable");
    },
    process: { env: { NTFY_TOPIC: "sanad" } },
  });

  await assert.doesNotReject(() => sendCreditAlert({ state: "exhausted" }));
  assert.equal(await sendCreditAlert({ state: "exhausted" }), false);
});
