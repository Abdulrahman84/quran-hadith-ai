import { sendCreditAlert } from "../notifications/ntfy";

type CreditAlertState = "normal" | "low" | "exhausted";

type CreditsResponse = {
  data?: {
    total_credits?: number;
    total_usage?: number;
  };
};

const creditsUrl = "https://openrouter.ai/api/v1/credits";
const defaultCheckIntervalMs = 15 * 60 * 1000;
const defaultRequestTimeoutMs = 4000;

let alertState: CreditAlertState = "normal";
let alertInFlight: Promise<void> | null = null;
let checkInFlight: Promise<void> | null = null;
let nextCheckAt = 0;

function readPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function transitionAlertState(nextState: CreditAlertState, remaining?: number) {
  if (alertInFlight) {
    await alertInFlight;
  }

  if (nextState === alertState) {
    return;
  }

  if (nextState === "normal") {
    alertState = "normal";
    return;
  }

  alertInFlight = (async () => {
    if (await sendCreditAlert({ state: nextState, remaining })) {
      alertState = nextState;
    }
  })();

  try {
    await alertInFlight;
  } finally {
    alertInFlight = null;
  }
}

async function fetchCreditBalance(managementKey: string) {
  const controller = new AbortController();
  const timeoutMs = readPositiveNumber(process.env.CREDIT_ALERT_TIMEOUT_MS, defaultRequestTimeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(creditsUrl, {
      headers: { Authorization: `Bearer ${managementKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => ({}))) as CreditsResponse;
    const totalCredits = payload.data?.total_credits;
    const totalUsage = payload.data?.total_usage;

    if (!Number.isFinite(totalCredits) || !Number.isFinite(totalUsage)) {
      return null;
    }

    return Math.max(0, (totalCredits as number) - (totalUsage as number));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function runCreditCheck(managementKey: string) {
  const remaining = await fetchCreditBalance(managementKey);

  if (remaining === null) {
    return;
  }

  const threshold = readPositiveNumber(process.env.OPENROUTER_LOW_CREDIT_USD, 1);

  if (remaining <= 0) {
    await transitionAlertState("exhausted", remaining);
  } else if (remaining <= threshold) {
    await transitionAlertState("low", remaining);
  } else {
    await transitionAlertState("normal", remaining);
  }
}

export function checkOpenRouterCreditBalanceIfDue() {
  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY?.trim();

  if (!managementKey || !process.env.NTFY_TOPIC?.trim()) {
    return Promise.resolve();
  }

  if (checkInFlight) {
    return checkInFlight;
  }

  const now = Date.now();

  if (now < nextCheckAt) {
    return Promise.resolve();
  }

  nextCheckAt = now + readPositiveNumber(process.env.OPENROUTER_CREDIT_CHECK_INTERVAL_MS, defaultCheckIntervalMs);
  checkInFlight = runCreditCheck(managementKey).finally(() => {
    checkInFlight = null;
  });

  return checkInFlight;
}

export function reportOpenRouterCreditFailure() {
  return transitionAlertState("exhausted");
}
