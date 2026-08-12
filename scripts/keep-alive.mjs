import { pathToFileURL } from "node:url";

const DEFAULT_INTERVAL_MINUTES = 10;
const DEFAULT_TIMEOUT_SECONDS = 90;
const MAX_TIMER_MS = 2_147_483_647;

function readPositiveNumber(value, fallback, name, maximum) {
  const number = value === undefined ? fallback : Number(value);

  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    throw new Error(`${name} must be a positive number no greater than ${maximum}.`);
  }

  return number;
}

function readTargetUrl(value) {
  if (!value) {
    throw new Error("KEEP_ALIVE_URL is required.");
  }

  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("KEEP_ALIVE_URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("KEEP_ALIVE_URL must not contain credentials.");
  }

  return url;
}

export function readConfig({ env = process.env, args = process.argv.slice(2) } = {}) {
  const unknownArgs = args.filter((argument) => argument !== "--once");
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument: ${unknownArgs[0]}`);
  }

  const intervalMinutes = readPositiveNumber(
    env.KEEP_ALIVE_INTERVAL_MINUTES,
    DEFAULT_INTERVAL_MINUTES,
    "KEEP_ALIVE_INTERVAL_MINUTES",
    MAX_TIMER_MS / 60_000,
  );
  const timeoutSeconds = readPositiveNumber(
    env.KEEP_ALIVE_TIMEOUT_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    "KEEP_ALIVE_TIMEOUT_SECONDS",
    MAX_TIMER_MS / 1_000,
  );

  return {
    intervalMs: intervalMinutes * 60_000,
    once: args.includes("--once"),
    timeoutMs: timeoutSeconds * 1_000,
    url: readTargetUrl(env.KEEP_ALIVE_URL),
  };
}

export function displayUrl(url) {
  return `${url.origin}${url.pathname}`;
}

export async function ping({ url, timeoutMs, fetchImpl = fetch }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      headers: { "user-agent": "sanad-ai-keep-alive/1.0" },
      redirect: "follow",
      signal: controller.signal,
    });

    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(`Keep-alive request returned HTTP ${response.status}.`);
    }

    return response.status;
  } finally {
    clearTimeout(timeout);
  }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runKeepAlive(
  config,
  { fetchImpl = fetch, logger = console, sleep = wait, maxRuns = Number.POSITIVE_INFINITY } = {},
) {
  let runs = 0;

  while (runs < maxRuns) {
    runs += 1;
    try {
      const status = await ping({ ...config, fetchImpl });
      logger.log(`[keep-alive] ${new Date().toISOString()} ${displayUrl(config.url)} -> ${status}`);
    } catch (error) {
      logger.error(`[keep-alive] ${new Date().toISOString()} ${displayUrl(config.url)} -> ${error.message}`);
      if (config.once) {
        throw error;
      }
    }

    if (!config.once && runs < maxRuns) {
      await sleep(config.intervalMs);
    } else {
      break;
    }
  }
}

async function main() {
  try {
    await runKeepAlive(readConfig());
  } catch {
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  await main();
}
