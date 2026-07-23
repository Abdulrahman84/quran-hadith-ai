import { checkOpenRouterCreditBalanceIfDue, reportOpenRouterCreditFailure } from "./credit-monitor";

export type LlmProvider = "openrouter";

export type LlmTask = "answer" | "router" | "hadith-query-planner";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type LlmCompletionInput = {
  task: LlmTask;
  messages: LlmMessage[];
  json?: boolean;
  maxTokens: number;
  temperature: number;
};

type LlmCompletionResult =
  | {
      status: "ok";
      text: string;
      provider: LlmProvider;
      model: string;
    }
  | {
      status: "disabled";
      error: string;
      provider: LlmProvider;
      model: string;
    }
  | {
      status: "error";
      error: string;
      provider: LlmProvider;
      model: string;
      httpStatus?: number;
    };

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
  };
};

const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1";
const defaultOpenRouterModel = "google/gemini-3.1-flash-lite";

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function splitModelList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

function taskModelEnv(task: LlmTask) {
  if (task === "router") {
    return process.env.MCP_TOOL_ROUTER_MODEL?.trim();
  }

  if (task === "hadith-query-planner") {
    return process.env.HADITH_QUERY_PLANNER_MODEL?.trim() || process.env.MCP_TOOL_ROUTER_MODEL?.trim();
  }

  return process.env.ANSWER_MODEL?.trim();
}

function taskFallbackModelsEnv(task: LlmTask) {
  if (task === "router") {
    return splitModelList(process.env.MCP_TOOL_ROUTER_FALLBACK_MODELS);
  }

  if (task === "hadith-query-planner") {
    return splitModelList(process.env.HADITH_QUERY_PLANNER_FALLBACK_MODELS);
  }

  if (task === "answer") {
    return splitModelList(process.env.ANSWER_FALLBACK_MODELS);
  }

  return [];
}

function taskTimeoutEnv(task: LlmTask) {
  if (task === "router") {
    return process.env.MCP_TOOL_ROUTER_TIMEOUT_MS;
  }

  if (task === "hadith-query-planner") {
    return process.env.HADITH_QUERY_PLANNER_TIMEOUT_MS;
  }

  return process.env.ANSWER_TIMEOUT_MS;
}

function isTaskEnabled(task: LlmTask) {
  if (process.env.LLM_ENABLED?.trim() === "false") {
    return false;
  }

  if (task === "router" && process.env.MCP_TOOL_ROUTER_ENABLED?.trim() === "false") {
    return false;
  }

  if (task === "hadith-query-planner" && process.env.HADITH_QUERY_PLANNER_ENABLED?.trim() === "false") {
    return false;
  }

  return true;
}

function getLlmConfig(task: LlmTask) {
  const sharedModel = process.env.LLM_MODEL?.trim();
  const taskModel = taskModelEnv(task);
  const timeoutMs = readPositiveInt(taskTimeoutEnv(task) || process.env.LLM_TIMEOUT_MS, task === "answer" ? 25000 : 12000);

  return {
    enabled: isTaskEnabled(task) && Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    provider: "openrouter" as const,
    model: taskModel || sharedModel || process.env.OPENROUTER_MODEL?.trim() || defaultOpenRouterModel,
    fallbackModels: taskFallbackModelsEnv(task),
    baseUrl: (process.env.OPENROUTER_BASE_URL?.trim() || defaultOpenRouterBaseUrl).replace(/\/$/, ""),
    apiKey: process.env.OPENROUTER_API_KEY?.trim() || "",
    timeoutMs,
  };
}

function openRouterHeaders(apiKey: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  const referer = process.env.OPENROUTER_SITE_URL?.trim();
  const title = process.env.OPENROUTER_APP_NAME?.trim() || "Sanad AI";

  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  headers["X-OpenRouter-Title"] = title;

  return headers;
}

async function completeWithOpenRouter(input: LlmCompletionInput, config: ReturnType<typeof getLlmConfig>, signal: AbortSignal) {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: openRouterHeaders(config.apiKey),
    body: JSON.stringify({
      model: config.model,
      messages: input.messages,
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      ...(input.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;

  if (!response.ok || payload.error) {
    const httpStatus = payload.error?.code || response.status;

    if (httpStatus === 402) {
      await reportOpenRouterCreditFailure();
    }

    return {
      status: "error" as const,
      error: payload.error?.message || `OpenRouter returned HTTP ${response.status}.`,
      provider: config.provider,
      model: config.model,
      httpStatus,
    };
  }

  const text = payload.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    return {
      status: "error" as const,
      error: "OpenRouter returned an empty response.",
      provider: config.provider,
      model: config.model,
    };
  }

  return {
    status: "ok" as const,
    text,
    provider: config.provider,
    model: config.model,
  };
}

export async function completeLlmText(input: LlmCompletionInput): Promise<LlmCompletionResult> {
  const config = getLlmConfig(input.task);

  if (!config.enabled) {
    return {
      status: "disabled",
      error: `OpenRouter is not configured for ${input.task}.`,
      provider: config.provider,
      model: config.model,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const models = [...new Set([config.model, ...config.fallbackModels])];
  let lastResult: LlmCompletionResult | null = null;

  void checkOpenRouterCreditBalanceIfDue();

  try {
    for (const model of models) {
      const result = await completeWithOpenRouter(input, { ...config, model }, controller.signal);

      if (result.status === "ok") {
        return result;
      }

      if (result.httpStatus === 402) {
        return result;
      }

      lastResult = result;
    }

    return lastResult || {
      status: "error",
      error: "OpenRouter request failed.",
      provider: config.provider,
      model: config.model,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "OpenRouter request failed.",
      provider: config.provider,
      model: config.model,
    };
  } finally {
    clearTimeout(timeout);
  }
}
