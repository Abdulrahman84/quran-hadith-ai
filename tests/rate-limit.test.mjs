import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { getClientIp } from "../src/lib/server/client-ip.ts";
import {
  consumeClientQuota,
  consumeGlobalDailyQuota,
  createRateLimitState,
  readRateLimitConfig,
} from "../src/lib/server/rate-limit.ts";

const config = { enabled: true, perMinute: 3, perDay: 5, globalDailyCap: null };

test("client IP prefers edge-set headers over the spoofable first forwarded hop", () => {
  const edge = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6, 1.2.3.4", "cf-connecting-ip": "1.2.3.4" } });
  const realIp = new Request("http://x", { headers: { "x-forwarded-for": "6.6.6.6", "x-real-ip": "9.9.9.9" } });
  const forwardedOnly = new Request("http://x", { headers: { "x-forwarded-for": " 1.2.3.4 , 10.0.0.1" } });

  assert.equal(getClientIp(edge), "1.2.3.4");
  assert.equal(getClientIp(realIp), "9.9.9.9");
  assert.equal(getClientIp(forwardedOnly), "1.2.3.4");
  assert.equal(getClientIp(new Request("http://x")), "unknown");
});

test("config defaults and overrides come from env", () => {
  assert.deepEqual(readRateLimitConfig({}), { enabled: true, perMinute: 10, perDay: 200, globalDailyCap: null });
  assert.deepEqual(
    readRateLimitConfig({ RATE_LIMIT_ENABLED: "false", RATE_LIMIT_PER_MINUTE: "4", RATE_LIMIT_PER_DAY: "x", GLOBAL_DAILY_REQUEST_CAP: "50" }),
    { enabled: false, perMinute: 4, perDay: 200, globalDailyCap: 50 },
  );
});

test("per-minute window blocks, reports Retry-After, and slides open again", () => {
  const state = createRateLimitState();
  const now = 1_000_000;

  for (let index = 0; index < 3; index += 1) {
    assert.equal(consumeClientQuota("a", { now: now + index, config, state }).allowed, true);
  }

  const blocked = consumeClientQuota("a", { now: now + 10_000, config, state });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "minute");
  assert.equal(blocked.retryAfterSeconds, 50);
  assert.equal(consumeClientQuota("b", { now: now + 10_000, config, state }).allowed, true);
  assert.equal(consumeClientQuota("a", { now: now + 60_001, config, state }).allowed, true);
});

test("daily limit blocks until the day window resets", () => {
  const state = createRateLimitState();
  let now = 0;

  for (let index = 0; index < 5; index += 1) {
    now += 61_000;
    assert.equal(consumeClientQuota("a", { now, config, state }).allowed, true);
  }

  now += 61_000;
  const blocked = consumeClientQuota("a", { now, config, state });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "day");
  assert.equal(consumeClientQuota("a", { now: 61_000 + 24 * 60 * 60 * 1000, config, state }).allowed, true);
});

test("disabled limiter always allows", () => {
  const state = createRateLimitState();
  const disabled = { ...config, enabled: false };

  for (let index = 0; index < 20; index += 1) {
    assert.equal(consumeClientQuota("a", { now: 1, config: disabled, state }).allowed, true);
  }
});

test("global daily cap is off by default and enforced when set", () => {
  const state = createRateLimitState();

  assert.equal(consumeGlobalDailyQuota({ now: 1, config, state }).allowed, true);

  const capped = { ...config, globalDailyCap: 2 };
  const fresh = createRateLimitState();
  assert.equal(consumeGlobalDailyQuota({ now: 1, config: capped, state: fresh }).allowed, true);
  assert.equal(consumeGlobalDailyQuota({ now: 2, config: capped, state: fresh }).allowed, true);
  const blocked = consumeGlobalDailyQuota({ now: 3, config: capped, state: fresh });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "global_day");
});

test("tracked clients stay bounded", () => {
  const state = createRateLimitState();

  for (let index = 0; index < 10_050; index += 1) {
    consumeClientQuota(`client-${index}`, { now: index, config, state });
  }

  assert.ok(state.clients.size <= 10_000);
});

test("search and check routes rate limit before work and skip the global cap on cache hits", () => {
  for (const route of ["src/app/api/search/route.ts", "src/app/api/check/route.ts"]) {
    const source = fs.readFileSync(path.join(process.cwd(), route), "utf8");
    const clientIndex = source.indexOf("consumeClientQuota(getClientIp(request))");
    const parseIndex = source.indexOf("await request.json()");
    const cacheIndex = source.indexOf("Cache.get(");
    const globalIndex = source.indexOf("consumeGlobalDailyQuota()");

    assert.ok(clientIndex > 0 && clientIndex < parseIndex, `${route} limits before parsing`);
    assert.ok(cacheIndex > 0 && cacheIndex < globalIndex, `${route} checks cache before the global cap`);
    assert.match(source, /"rate_limited"/);
    assert.match(source, /"Retry-After"/);
  }
});
