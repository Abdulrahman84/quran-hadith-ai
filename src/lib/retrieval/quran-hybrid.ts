import { createQueryEmbedder, startSharedQueryEmbedding, type QueryEmbedder, type SharedQueryEmbedding } from "./query-embedding";
import { getQuranVectorIndex, searchQuranVectorIndex, type QuranVectorHit, type QuranVectorIndex } from "./quran-vector-index";

export type QuranSearchMode = "lexical" | "hybrid";

type Env = Record<string, string | undefined>;

/**
 * QURAN_SEARCH_MODE=hybrid adds an embedding search over every ayah (QURAN_EMBEDDINGS_PATH) to
 * the Tafsir MCP keyword search, fused by reciprocal rank. Anything else keeps keyword search only.
 */
export function getQuranSearchMode(env: Env = process.env): QuranSearchMode {
  return env.QURAN_SEARCH_MODE?.trim().toLowerCase() === "hybrid" ? "hybrid" : "lexical";
}

export type QuranVectorList = { query: string; hits: QuranVectorHit[] };

export type QuranVectorSearch =
  | {
      status: "ok";
      lists: QuranVectorList[];
      model: string;
      provider: string;
      indexSize: number;
      /** When the lists were collected, counted from when the vector search started. */
      ms: number;
    }
  | { status: "unavailable"; reason: string };

/** Nearest ayahs taken from the vector search, before fusion. */
export const QURAN_VECTOR_CANDIDATES = 20;

type VectorSearchDeps = {
  env?: Env;
  /**
   * The search's shared question embedding (null when no provider is configured). Without it the
   * vector search embeds the question itself with `embedder`.
   */
  queryEmbedding?: SharedQueryEmbedding | null;
  embedder?: QueryEmbedder | null;
  loadIndex?: (indexPath: string, model: string) => Promise<QuranVectorIndex>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ownEmbedding(query: string, deps: VectorSearchDeps, env: Env) {
  const embedder = deps.embedder === undefined ? createQueryEmbedder(env) : deps.embedder;
  return embedder ? startSharedQueryEmbedding([query], embedder, env) : null;
}

/**
 * The vector search runs in the background while the keyword search runs. collect() waits for it
 * until budgetMs after it started, and no longer, so a slow embedding API costs a bounded wait
 * instead of the full embedding timeout. When the keyword search already took that long, it uses
 * the vectors only if they are ready.
 */
export type QuranVectorSearchHandle = { collect(budgetMs: number): Promise<QuranVectorSearch> };

/**
 * OpenRouter's bge-m3 usually answers in 0.4 to 0.9 s and sometimes takes 2 s (November 2026). The
 * keyword search runs meanwhile; on a small production instance it takes longer than that.
 */
export const QURAN_VECTOR_WAIT_MS = 2000;

export function quranVectorWaitMs(env: Env = process.env) {
  const value = Number.parseInt(env.QURAN_VECTOR_WAIT_MS ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : QURAN_VECTOR_WAIT_MS;
}

const unavailable = (reason: string): QuranVectorSearchHandle => ({
  collect: async () => ({ status: "unavailable", reason }),
});

type Settled<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Finds the question's nearest ayahs once its embedding is ready. Never rejects: a missing index or
 * a failed embedding gives "unavailable". The wait budget counts from when the embedding started.
 *
 * Only the user's own question is searched, not the Fusha rewrite: the keyword search already
 * searches the rewrite. The same vector goes to the hadith semantic search.
 */
export function searchQuranVectors(query: string, deps: VectorSearchDeps = {}): QuranVectorSearchHandle {
  const env = deps.env ?? process.env;
  const indexPath = env.QURAN_EMBEDDINGS_PATH?.trim();

  if (!indexPath) {
    return unavailable("no Quran embedding index configured (QURAN_EMBEDDINGS_PATH).");
  }

  if (!query.trim()) {
    return unavailable("empty question.");
  }

  const embedding = deps.queryEmbedding === undefined ? ownEmbedding(query, deps, env) : deps.queryEmbedding;
  const questionVector = embedding?.vectorFor(query);

  if (!embedding || !questionVector) {
    return unavailable("no embedding provider configured.");
  }

  const startedAt = embedding.startedAt;
  const indexPromise = getQuranVectorIndex(indexPath, embedding.model, deps.loadIndex);
  const questionList: Promise<Settled<{ list: QuranVectorList; index: QuranVectorIndex }>> = Promise.all([questionVector, indexPromise])
    .then(([embedded, index]): Settled<{ list: QuranVectorList; index: QuranVectorIndex }> =>
      embedded.ok
        ? { ok: true, value: { list: { query, hits: searchQuranVectorIndex(index, embedded.vector, QURAN_VECTOR_CANDIDATES) }, index } }
        : { ok: false, reason: embedded.reason },
    )
    .catch((error: unknown) => ({ ok: false, reason: errorMessage(error) }));

  return {
    async collect(budgetMs) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<"late">((resolve) => {
        timer = setTimeout(() => resolve("late"), Math.max(0, startedAt + budgetMs - Date.now()));
      });

      try {
        const question = await Promise.race([questionList, deadline]);

        if (question === "late") {
          return { status: "unavailable", reason: `the question's embedding was not ready within ${budgetMs} ms.` };
        }

        if (!question.ok) {
          return { status: "unavailable", reason: question.reason };
        }

        const { list, index } = question.value;

        return {
          status: "ok",
          lists: [list],
          model: index.model,
          provider: embedding.provider,
          indexSize: index.size,
          ms: Date.now() - startedAt,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * Starts the vector search when Quran search is hybrid; returns undefined otherwise. Pass the
 * search's shared question embedding (or null when there is no provider) so the question is not
 * embedded a second time.
 */
export function startQuranVectorSearch(
  query: string,
  env: Env = process.env,
  queryEmbedding?: SharedQueryEmbedding | null,
): QuranVectorSearchHandle | undefined {
  return getQuranSearchMode(env) === "hybrid" ? searchQuranVectors(query, { env, queryEmbedding }) : undefined;
}

export const QURAN_FUSION_K = 60;

export type RankedAyahs = { verseKeys: string[]; weight?: number };

export type FusedAyah = { verseKey: string; score: number; ranks: number[] };

/**
 * Weighted reciprocal rank fusion of ranked verse-key lists: score = Σ weight / (k + rank), weight
 * 1 by default. Duplicates within a list count once, at their best rank. Ties keep first-seen
 * order, so earlier lists win ties: the keyword list goes first, so an exact quote it found stays
 * ahead of an equally scored neighbour. ranks[i] is the 1-based rank in list i, or 0 when absent.
 */
export function fuseAyahRankings(lists: RankedAyahs[], k: number = QURAN_FUSION_K): FusedAyah[] {
  const fused = new Map<string, FusedAyah & { firstSeen: number }>();

  lists.forEach(({ verseKeys, weight = 1 }, listIndex) => {
    [...new Set(verseKeys)].forEach((verseKey, position) => {
      const rank = position + 1;
      const item = fused.get(verseKey) ?? { verseKey, score: 0, ranks: lists.map(() => 0), firstSeen: fused.size };

      item.score += weight / (k + rank);
      item.ranks[listIndex] = rank;
      fused.set(verseKey, item);
    });
  });

  return [...fused.values()]
    .sort((left, right) => right.score - left.score || left.firstSeen - right.firstSeen)
    .map(({ verseKey, score, ranks }) => ({ verseKey, score, ranks }));
}
