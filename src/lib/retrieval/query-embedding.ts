import { hadithMcpEmbeddingEnv } from "./hadith-hybrid";

type Env = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Embeds search questions in the app process, for the Quran vector index. It reads the same
 * EMBEDDINGS_* settings the Hadith MCP uses, so both indexes are queried with the same model,
 * provider, prefix and timeout. The hadith embedding is computed inside the Hadith MCP process
 * and never returned, so it cannot be shared with this one.
 */
export type QueryEmbedder = {
  /** "ollama" or the OpenAI-compatible base URL. */
  provider: string;
  model: string;
  embed(texts: string[]): Promise<Float32Array[]>;
};

const DEFAULT_TIMEOUT_MS = 8000;
const retryDelaysMs = [250, 750];

// Same cleanup as hadith-mcp's embeddingQueryText and the Quran index builder.
const arabicMarksPattern = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const decorativePattern = /[ـ‎‏‪-‮]/g;

export function embeddingQueryText(query: string) {
  return query.replace(arabicMarksPattern, "").replace(decorativePattern, "").replace(/\s+/g, " ").trim();
}

export function normalizeVector(values: ArrayLike<number>) {
  const vector = Float32Array.from(values);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  return norm === 0 ? vector : vector.map((value) => value / norm);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === "number");
}

async function postJson(fetchImpl: FetchLike, url: string, body: unknown, headers: Record<string, string>, timeoutMs: number) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return (await response.json()) as unknown;
    }

    // A hosted API sometimes answers 429 or 5xx for a moment; one quick retry usually succeeds.
    if ((response.status === 429 || response.status >= 500) && attempt < retryDelaysMs.length) {
      await response.body?.cancel().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]));
      continue;
    }

    const detail = (await response.text().catch(() => "")).slice(0, 200);
    throw new Error(`Embedding request failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

function vectorsFrom(payload: unknown, expected: number): Float32Array[] {
  const ollama = (payload as { embeddings?: unknown }).embeddings;
  const openAi = (payload as { data?: unknown }).data;
  const vectors = Array.isArray(ollama)
    ? ollama
    : Array.isArray(openAi)
      ? [...openAi]
          .sort((left, right) => ((left as { index?: number }).index ?? 0) - ((right as { index?: number }).index ?? 0))
          .map((item) => (item as { embedding?: unknown }).embedding)
      : null;

  if (!vectors || vectors.length !== expected || !vectors.every(isNumberArray)) {
    throw new Error("The embedding API returned an unexpected payload.");
  }

  return vectors.map(normalizeVector);
}

/**
 * EMBEDDINGS_PROVIDER "openai" (any OpenAI-compatible /embeddings API at EMBEDDINGS_BASE_URL),
 * "ollama" (the default when no base URL is set) or "none". Returns null when nothing usable is
 * configured. The OpenRouter key falls back to OPENROUTER_API_KEY, as for the Hadith MCP.
 */
export function createQueryEmbedder(env: Env = process.env, fetchImpl: FetchLike = fetch): QueryEmbedder | null {
  const settings = hadithMcpEmbeddingEnv(env);
  const baseUrl = settings.EMBEDDINGS_BASE_URL?.replace(/\/+$/, "");
  const kind = settings.EMBEDDINGS_PROVIDER?.toLowerCase() || (baseUrl ? "openai" : "ollama");
  const model = settings.EMBEDDINGS_MODEL || "bge-m3";
  const timeoutMs = Number.parseInt(settings.EMBEDDINGS_TIMEOUT_MS ?? "", 10);
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const prefix = settings.EMBEDDINGS_QUERY_PREFIX?.replace(/\\n/g, "\n") ?? "";
  const withPrefix = (texts: string[]) => texts.map((text) => prefix + embeddingQueryText(text));

  if (kind === "none" || (kind === "openai" && !baseUrl)) {
    return null;
  }

  if (kind === "openai" && baseUrl) {
    const dimensions = Number.parseInt(settings.EMBEDDINGS_DIMENSIONS ?? "", 10);
    const providerOrder = (settings.EMBEDDINGS_PROVIDER_ORDER ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const headers: Record<string, string> = settings.EMBEDDINGS_API_KEY ? { Authorization: `Bearer ${settings.EMBEDDINGS_API_KEY}` } : {};
    const extraBody = {
      ...(Number.isFinite(dimensions) && dimensions > 0 ? { dimensions } : {}),
      ...(providerOrder.length > 0 ? { provider: { order: providerOrder, allow_fallbacks: true } } : {}),
    };

    return {
      provider: baseUrl,
      model,
      async embed(texts) {
        const payload = await postJson(fetchImpl, `${baseUrl}/embeddings`, { model, input: withPrefix(texts), ...extraBody }, headers, timeout);
        return vectorsFrom(payload, texts.length);
      },
    };
  }

  const ollamaUrl = (settings.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");

  return {
    provider: "ollama",
    model,
    async embed(texts) {
      const payload = await postJson(fetchImpl, `${ollamaUrl}/api/embed`, { model, input: withPrefix(texts) }, {}, timeout);
      return vectorsFrom(payload, texts.length);
    },
  };
}
