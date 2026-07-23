export type CreditAlert = {
  state: "low" | "exhausted";
  remaining?: number;
};

const defaultBaseUrl = "https://ntfy.sh";
const defaultTimeoutMs = 4000;

function readTimeout() {
  const parsed = Number(process.env.CREDIT_ALERT_TIMEOUT_MS);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTimeoutMs;
}

function readConfig() {
  const topic = process.env.NTFY_TOPIC?.trim();

  if (!topic) {
    return null;
  }

  try {
    const baseUrl = new URL(process.env.NTFY_BASE_URL?.trim() || defaultBaseUrl);

    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      return null;
    }

    return {
      baseUrl: baseUrl.toString(),
      topic,
      accessToken: process.env.NTFY_ACCESS_TOKEN?.trim(),
    };
  } catch {
    return null;
  }
}

function alertMessage(alert: CreditAlert) {
  if (alert.state === "low" && alert.remaining !== undefined) {
    return `Approximately $${alert.remaining.toFixed(2)} in OpenRouter credit remains.`;
  }

  return "OpenRouter requests stopped because the account credit or API-key spending limit was exhausted.";
}

export async function sendCreditAlert(alert: CreditAlert) {
  const config = readConfig();

  if (!config) {
    return false;
  }

  const low = alert.state === "low";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeout());
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }

  try {
    const response = await fetch(config.baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        topic: config.topic,
        title: low ? "Sanad AI: OpenRouter credit is low" : "Sanad AI: OpenRouter credit unavailable",
        message: alertMessage(alert),
        priority: low ? 4 : 5,
        tags: ["warning", "moneybag"],
        click: "https://openrouter.ai/settings/credits",
      }),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
