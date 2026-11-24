// State lives in this server process only. That matches the single-instance
// deployment; running several instances would give each its own budget.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const MAX_TRACKED_CLIENTS = 10_000;

export type RateLimitConfig = {
  enabled: boolean;
  perMinute: number;
  perDay: number;
  globalDailyCap: number | null;
};

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: "minute" | "day" | "global_day"; retryAfterSeconds: number };

type ClientUsage = {
  minuteHits: number[];
  dayStartedAt: number;
  dayCount: number;
};

type GlobalUsage = {
  dayStartedAt: number;
  dayCount: number;
};

export type RateLimitState = {
  clients: Map<string, ClientUsage>;
  global: GlobalUsage;
};

function readPositiveInt(value: string | undefined, fallback: number | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readRateLimitConfig(env: Record<string, string | undefined> = process.env): RateLimitConfig {
  return {
    enabled: env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false",
    perMinute: readPositiveInt(env.RATE_LIMIT_PER_MINUTE, 10) ?? 10,
    perDay: readPositiveInt(env.RATE_LIMIT_PER_DAY, 200) ?? 200,
    globalDailyCap: readPositiveInt(env.GLOBAL_DAILY_REQUEST_CAP, null),
  };
}

export function createRateLimitState(): RateLimitState {
  return { clients: new Map(), global: { dayStartedAt: 0, dayCount: 0 } };
}

const globalStore = globalThis as typeof globalThis & { __sanadRateLimitState?: RateLimitState };

function sharedState() {
  globalStore.__sanadRateLimitState ??= createRateLimitState();
  return globalStore.__sanadRateLimitState;
}

function secondsUntil(timestamp: number, now: number) {
  return Math.max(1, Math.ceil((timestamp - now) / 1000));
}

function isStale(usage: ClientUsage, now: number) {
  const minuteIdle = usage.minuteHits.every((hit) => now - hit >= MINUTE_MS);
  return minuteIdle && now - usage.dayStartedAt >= DAY_MS;
}

function makeRoomForClient(clients: Map<string, ClientUsage>, now: number) {
  if (clients.size < MAX_TRACKED_CLIENTS) {
    return;
  }

  for (const [key, usage] of clients) {
    if (isStale(usage, now)) {
      clients.delete(key);
    }
  }

  while (clients.size >= MAX_TRACKED_CLIENTS) {
    const oldestKey = clients.keys().next().value;

    if (oldestKey === undefined) {
      return;
    }

    clients.delete(oldestKey);
  }
}

export function consumeClientQuota(
  clientKey: string,
  options: { now?: number; config?: RateLimitConfig; state?: RateLimitState } = {},
): RateLimitDecision {
  const config = options.config ?? readRateLimitConfig();

  if (!config.enabled) {
    return { allowed: true };
  }

  const now = options.now ?? Date.now();
  const { clients } = options.state ?? sharedState();
  let usage = clients.get(clientKey);

  if (!usage) {
    makeRoomForClient(clients, now);
    usage = { minuteHits: [], dayStartedAt: now, dayCount: 0 };
    clients.set(clientKey, usage);
  }

  usage.minuteHits = usage.minuteHits.filter((hit) => now - hit < MINUTE_MS);

  if (now - usage.dayStartedAt >= DAY_MS) {
    usage.dayStartedAt = now;
    usage.dayCount = 0;
  }

  if (usage.dayCount >= config.perDay) {
    return { allowed: false, reason: "day", retryAfterSeconds: secondsUntil(usage.dayStartedAt + DAY_MS, now) };
  }

  if (usage.minuteHits.length >= config.perMinute) {
    return { allowed: false, reason: "minute", retryAfterSeconds: secondsUntil(usage.minuteHits[0] + MINUTE_MS, now) };
  }

  usage.minuteHits.push(now);
  usage.dayCount += 1;
  return { allowed: true };
}

export function consumeGlobalDailyQuota(
  options: { now?: number; config?: RateLimitConfig; state?: RateLimitState } = {},
): RateLimitDecision {
  const config = options.config ?? readRateLimitConfig();

  if (config.globalDailyCap === null) {
    return { allowed: true };
  }

  const now = options.now ?? Date.now();
  const usage = (options.state ?? sharedState()).global;

  if (now - usage.dayStartedAt >= DAY_MS) {
    usage.dayStartedAt = now;
    usage.dayCount = 0;
  }

  if (usage.dayCount >= config.globalDailyCap) {
    return { allowed: false, reason: "global_day", retryAfterSeconds: secondsUntil(usage.dayStartedAt + DAY_MS, now) };
  }

  usage.dayCount += 1;
  return { allowed: true };
}

export function rateLimitMessage(decision: Extract<RateLimitDecision, { allowed: false }>) {
  if (decision.reason === "global_day") {
    return "The service has reached its daily request limit. Please try again later.";
  }

  return "Too many requests. Please wait a moment and try again.";
}
