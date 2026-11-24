type CacheEntry<Value> = {
  value: Value;
  expiresAt: number;
};

export type ResponseCacheOptions = {
  ttlMs: number;
  maxEntries: number;
};

export class ResponseCache<Value> {
  private readonly entries = new Map<string, CacheEntry<Value>>();
  private readonly options: ResponseCacheOptions;

  constructor(options: ResponseCacheOptions) {
    this.options = options;
  }

  get size() {
    return this.entries.size;
  }

  get(key: string, now = Date.now()): Value | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }

    // Re-insert so Map order tracks recency for LRU eviction.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: Value, now = Date.now()) {
    if (this.options.maxEntries <= 0 || this.options.ttlMs <= 0) {
      return;
    }

    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + this.options.ttlMs });

    while (this.entries.size > this.options.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey === undefined) {
        return;
      }

      this.entries.delete(oldestKey);
    }
  }

  clear() {
    this.entries.clear();
  }
}

const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

function readNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function readResponseCacheOptions(env: Record<string, string | undefined> = process.env): ResponseCacheOptions {
  return {
    ttlMs: readNonNegativeInt(env.SEARCH_CACHE_TTL_MS, DEFAULT_TTL_MS),
    maxEntries: readNonNegativeInt(env.SEARCH_CACHE_MAX_ENTRIES, DEFAULT_MAX_ENTRIES),
  };
}

const globalStore = globalThis as typeof globalThis & {
  __sanadResponseCaches?: Map<string, ResponseCache<unknown>>;
};

export function sharedResponseCache<Value>(name: string): ResponseCache<Value> {
  globalStore.__sanadResponseCaches ??= new Map();
  let cache = globalStore.__sanadResponseCaches.get(name);

  if (!cache) {
    cache = new ResponseCache<unknown>(readResponseCacheOptions());
    globalStore.__sanadResponseCaches.set(name, cache);
  }

  return cache as ResponseCache<Value>;
}

export function normalizeCacheText(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function responseCacheKey(parts: Record<string, string>) {
  return JSON.stringify(
    Object.keys(parts)
      .sort()
      .map((key) => [key, key === "text" ? normalizeCacheText(parts[key]) : parts[key]]),
  );
}
