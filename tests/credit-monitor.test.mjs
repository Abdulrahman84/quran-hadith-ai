import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

function loadCreditMonitor(overrides = {}) {
  const filename = path.join(process.cwd(), "src/lib/llm/credit-monitor.ts");
  const source = fs.readFileSync(filename, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const notifier = overrides.notifier || { sendCreditAlert: async () => true };
  const sandbox = {
    AbortController,
    URL,
    clearTimeout,
    exports: {},
    fetch,
    module: { exports: {} },
    process: { env: {} },
    require: (specifier) => specifier === "../notifications/ntfy" ? notifier : require(specifier),
    setTimeout,
    ...overrides,
  };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });

  return sandbox.module.exports;
}

test("credit checks warn through ntfy and are gated by the configured interval", async () => {
  const requests = [];
  const notifications = [];
  const { checkOpenRouterCreditBalanceIfDue } = loadCreditMonitor({
    notifier: {
      sendCreditAlert: async (alert) => {
        notifications.push(alert);
        return true;
      },
    },
    fetch: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        json: async () => ({ data: { total_credits: 10, total_usage: 9.5 } }),
      };
    },
    process: {
      env: {
        OPENROUTER_MANAGEMENT_KEY: "management-key",
        OPENROUTER_LOW_CREDIT_USD: "1",
        OPENROUTER_CREDIT_CHECK_INTERVAL_MS: "900000",
        NTFY_TOPIC: "long-random-test-topic",
      },
    },
  });

  await Promise.all([checkOpenRouterCreditBalanceIfDue(), checkOpenRouterCreditBalanceIfDue()]);
  await checkOpenRouterCreditBalanceIfDue();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://openrouter.ai/api/v1/credits");
  assert.equal(requests[0].init.headers.Authorization, "Bearer management-key");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].state, "low");
  assert.equal(notifications[0].remaining, 0.5);
});

test("an exhausted-credit failure sends one urgent alert per state", async () => {
  const notifications = [];
  const { reportOpenRouterCreditFailure } = loadCreditMonitor({
    notifier: {
      sendCreditAlert: async (alert) => {
        notifications.push(alert);
        return true;
      },
    },
    process: {
      env: {
        NTFY_TOPIC: "long-random-test-topic",
        NTFY_ACCESS_TOKEN: "ntfy-token",
      },
    },
  });

  await Promise.all([reportOpenRouterCreditFailure(), reportOpenRouterCreditFailure()]);
  await reportOpenRouterCreditFailure();

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].state, "exhausted");
  assert.equal(notifications[0].remaining, undefined);
});

test("missing notification configuration does not check credits", async () => {
  let requests = 0;
  const disabled = loadCreditMonitor({
    fetch: async () => {
      requests += 1;
      throw new Error("should not fetch");
    },
    process: { env: { OPENROUTER_MANAGEMENT_KEY: "management-key" } },
  });

  await disabled.checkOpenRouterCreditBalanceIfDue();
  await disabled.reportOpenRouterCreditFailure();
  assert.equal(requests, 0);
});
