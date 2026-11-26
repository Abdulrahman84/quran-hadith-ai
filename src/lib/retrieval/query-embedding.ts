import http from "node:http";
import https from "node:https";

import { hadithMcpEmbeddingEnv } from "./hadith-hybrid";

type Env = Record<string, string | undefined>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Embedding requests get sockets of their own. Through the global fetch they share a connection
// with the router, planner and rewrite model calls to the same host, and then wait for them: an
// embedding that takes 0.4 s alone took 1.1 to 1.6 s next to the hadith planner call (November 2026).
const embeddingAgents = { "http:": new http.Agent({ keepAlive: true }), "https:": new https.Agent({ keepAlive: true }) };

/** A small POST-only fetch over node:http(s), on the embedding agents above. */
export const embeddingFetch: FetchLike = (input, init = {}) =>
  new Promise((resolve, reject) => {
    const url = new URL(input);
    const transport = url.protocol === "http:" ? http : https;
    const request = transport.request(
      url,
      {
        method: init.method ?? "POST",
        headers: Object.fromEntries(new Headers(init.headers).entries()),
        agent: url.protocol === "http:" ? embeddingAgents["http:"] : embeddingAgents["https:"],
        signal: init.signal ?? undefined,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers: Object.entries(response.headers).flatMap(([name, value]) =>
                value === undefined ? [] : [[name, Array.isArray(value) ? value.join(", ") : value] as [string, string]],
              ),
            }),
          ),
        );
      },
    );

    request.on("error", reject);
    request.end(typeof init.body === "string" ? init.body : undefined);
  });

/**
 * Embeds search questions in the app process. It reads the same EMBEDDINGS_* settings the Hadith
 * MCP uses, so the Quran and hadith indexes are queried with the same model, provider, prefix and
 * timeout, and one vector serves both: the Quran index is searched in the app and the vector is
 * passed to semantic_search_hadith as query_embedding.
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
export function createQueryEmbedder(env: Env = process.env, fetchImpl: FetchLike = embeddingFetch): QueryEmbedder | null {
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

export type EmbeddedText = { ok: true; vector: Float32Array } | { ok: false; reason: string };

/**
 * One embedding request for a search, shared by the Quran vector search and the hadith semantic
 * search. OpenRouter serves parallel bge-m3 calls slower (about 0.5 s alone, 1 to 2 s with a few in
 * flight), so the question is embedded once instead of once per index.
 */
export type SharedQueryEmbedding = {
  /** The name the vectors are known by in both indexes (EMBEDDINGS_INDEX_MODEL, else EMBEDDINGS_MODEL). */
  model: string;
  provider: string;
  startedAt: number;
  texts: string[];
  /** The vector for one of the texts, or null when it was not in the request. Never rejects. */
  vectorFor(text: string): Promise<EmbeddedText> | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Starts one request that embeds every text, with duplicates and blanks dropped. */
export function startSharedQueryEmbedding(texts: string[], embedder: QueryEmbedder, env: Env = process.env): SharedQueryEmbedding {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))];
  const startedAt = Date.now();
  const request: Promise<Float32Array[] | string> =
    unique.length === 0 ? Promise.resolve([]) : embedder.embed(unique).catch((error: unknown) => errorMessage(error));

  return {
    model: env.EMBEDDINGS_INDEX_MODEL?.trim() || embedder.model,
    provider: embedder.provider,
    startedAt,
    texts: unique,
    vectorFor(text) {
      const position = unique.indexOf(text.trim());

      if (position < 0) {
        return null;
      }

      return request.then((vectors): EmbeddedText => {
        if (typeof vectors === "string") {
          return { ok: false, reason: vectors };
        }

        const vector = vectors[position];
        return vector ? { ok: true, vector } : { ok: false, reason: "the embedding API returned no vector for the question." };
      });
    },
  };
}
