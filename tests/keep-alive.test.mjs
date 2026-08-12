import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { displayUrl, ping, readConfig, runKeepAlive } from "../scripts/keep-alive.mjs";

test("keep-alive config reads a one-off request and custom timing", () => {
  const config = readConfig({
    args: ["--once"],
    env: {
      KEEP_ALIVE_INTERVAL_MINUTES: "12.5",
      KEEP_ALIVE_TIMEOUT_SECONDS: "75",
      KEEP_ALIVE_URL: "https://example.com/health?token=hidden",
    },
  });

  assert.equal(config.once, true);
  assert.equal(config.intervalMs, 750_000);
  assert.equal(config.timeoutMs, 75_000);
  assert.equal(displayUrl(config.url), "https://example.com/health");
});

test("keep-alive config rejects unsafe URLs and unknown arguments", () => {
  assert.throws(
    () => readConfig({ env: { KEEP_ALIVE_URL: "ftp://example.com" } }),
    /must use http or https/,
  );
  assert.throws(
    () => readConfig({ env: { KEEP_ALIVE_URL: "https://user:pass@example.com" } }),
    /must not contain credentials/,
  );
  assert.throws(
    () => readConfig({ args: ["--other"], env: { KEEP_ALIVE_URL: "https://example.com" } }),
    /Unknown argument/,
  );
});

test("ping sends an identified GET request and cancels the response body", async () => {
  let request;
  let cancelled = false;
  const status = await ping({
    timeoutMs: 100,
    url: new URL("https://example.com/api/health"),
    fetchImpl: async (url, init) => {
      request = { init, url };
      return {
        body: { cancel: async () => { cancelled = true; } },
        ok: true,
        status: 204,
      };
    },
  });

  assert.equal(status, 204);
  assert.equal(request.url.href, "https://example.com/api/health");
  assert.equal(request.init.headers["user-agent"], "sanad-ai-keep-alive/1.0");
  assert.equal(request.init.redirect, "follow");
  assert.equal(cancelled, true);
});

test("ping fails for a non-success response", async () => {
  await assert.rejects(
    ping({
      timeoutMs: 100,
      url: new URL("https://example.com/api/health"),
      fetchImpl: async () => ({ body: null, ok: false, status: 503 }),
    }),
    /HTTP 503/,
  );
});

test("ping aborts a request that exceeds its timeout", async () => {
  await assert.rejects(
    ping({
      timeoutMs: 5,
      url: new URL("https://example.com/api/health"),
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("request aborted")), { once: true });
      }),
    }),
    /request aborted/,
  );
});

test("continuous mode logs a transient error and tries again without overlap", async () => {
  let attempts = 0;
  const errors = [];
  const successes = [];
  const sleeps = [];

  await runKeepAlive(
    {
      intervalMs: 600_000,
      once: false,
      timeoutMs: 100,
      url: new URL("https://example.com/api/health"),
    },
    {
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("temporary outage");
        return { body: null, ok: true, status: 200 };
      },
      logger: {
        error: (message) => errors.push(message),
        log: (message) => successes.push(message),
      },
      maxRuns: 2,
      sleep: async (milliseconds) => sleeps.push(milliseconds),
    },
  );

  assert.equal(attempts, 2);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /temporary outage/);
  assert.equal(successes.length, 1);
  assert.deepEqual(sleeps, [600_000]);
});

test("deployment schedules the external health ping before Render's idle timeout", () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), ".github/workflows/keep-alive.yml"),
    "utf8",
  );
  const healthRoute = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/health/route.ts"),
    "utf8",
  );

  assert.match(workflow, /3,13,23,33,43,53 \* \* \* \*/);
  assert.match(workflow, /npm run keep-alive -- --once/);
  assert.match(workflow, /\/api\/health/);
  assert.match(healthRoute, /status: "ok"/);
});
