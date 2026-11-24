import assert from "node:assert/strict";
import test from "node:test";

import { ResponseCache, readResponseCacheOptions, responseCacheKey } from "../src/lib/server/response-cache.ts";

test("cache key normalizes whitespace and case but keeps filters distinct", () => {
  const base = { text: "  What is   Patience? ", language: "english", hadithCollection: "all", tafsirSource: "all" };

  assert.equal(responseCacheKey(base), responseCacheKey({ ...base, text: "what is patience?" }));
  assert.notEqual(responseCacheKey(base), responseCacheKey({ ...base, hadithCollection: "bukhari" }));
  assert.notEqual(responseCacheKey(base), responseCacheKey({ ...base, language: "arabic" }));
});

test("entries expire after the TTL", () => {
  const cache = new ResponseCache({ ttlMs: 100, maxEntries: 10 });

  cache.set("a", 1, 0);
  assert.equal(cache.get("a", 99), 1);
  assert.equal(cache.get("a", 100), undefined);
  assert.equal(cache.size, 0);
});

test("least recently used entry is evicted first", () => {
  const cache = new ResponseCache({ ttlMs: 1000, maxEntries: 2 });

  cache.set("a", 1, 0);
  cache.set("b", 2, 0);
  cache.get("a", 1);
  cache.set("c", 3, 2);

  assert.equal(cache.get("a", 3), 1);
  assert.equal(cache.get("b", 3), undefined);
  assert.equal(cache.get("c", 3), 3);
});

test("zero size or TTL disables caching", () => {
  const cache = new ResponseCache({ ttlMs: 0, maxEntries: 10 });
  cache.set("a", 1, 0);
  assert.equal(cache.get("a", 0), undefined);
});

test("options read from env with defaults", () => {
  assert.deepEqual(readResponseCacheOptions({}), { ttlMs: 6 * 60 * 60 * 1000, maxEntries: 500 });
  assert.deepEqual(readResponseCacheOptions({ SEARCH_CACHE_TTL_MS: "0", SEARCH_CACHE_MAX_ENTRIES: "20" }), {
    ttlMs: 0,
    maxEntries: 20,
  });
});
