import { createQueryEmbedder, type QueryEmbedder } from "./query-embedding";
import type { QuestionRewrite } from "./question-rewrite";
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
  | { status: "ok"; lists: QuranVectorList[]; model: string; provider: string; indexSize: number; ms: number }
  | { status: "unavailable"; reason: string };

/** Nearest ayahs taken from each vector search, before fusion. */
export const QURAN_VECTOR_CANDIDATES = 20;

type VectorSearchDeps = {
  env?: Env;
  embedder?: QueryEmbedder | null;
  loadIndex?: (indexPath: string, model: string) => Promise<QuranVectorIndex>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Embeds the question, and the Fusha rewrite once it arrives, and finds the nearest ayahs for
 * each. The source router starts this alongside its routing model call, so it is usually done
 * before the keyword search. Never rejects: a missing index or embedding API gives "unavailable".
 */
export async function searchQuranVectors(
  query: string,
  questionRewrite: Promise<QuestionRewrite> | undefined,
  deps: VectorSearchDeps = {},
): Promise<QuranVectorSearch> {
  const env = deps.env ?? process.env;
  const startedAt = Date.now();
  const indexPath = env.QURAN_EMBEDDINGS_PATH?.trim();

  if (!indexPath) {
    return { status: "unavailable", reason: "no Quran embedding index configured (QURAN_EMBEDDINGS_PATH)." };
  }

  const embedder = deps.embedder === undefined ? createQueryEmbedder(env) : deps.embedder;

  if (!embedder) {
    return { status: "unavailable", reason: "no embedding provider configured." };
  }

  const indexModel = env.EMBEDDINGS_INDEX_MODEL?.trim() || embedder.model;

  try {
    const indexPromise = getQuranVectorIndex(indexPath, indexModel, deps.loadIndex);
    const searchFor = async (text: string): Promise<QuranVectorList> => {
      const [[vector], index] = await Promise.all([embedder.embed([text]), indexPromise]);
      return { query: text, hits: searchQuranVectorIndex(index, vector, QURAN_VECTOR_CANDIDATES) };
    };
    // A rewrite failure only loses the second list; the question's own list still counts.
    const rewriteList = (questionRewrite ?? Promise.resolve(null))
      .then((rewrite) => (rewrite?.fusha ? searchFor(rewrite.fusha) : null))
      .catch(() => null);
    const [questionList, rewrittenList, index] = await Promise.all([searchFor(query), rewriteList, indexPromise]);

    return {
      status: "ok",
      lists: rewrittenList ? [questionList, rewrittenList] : [questionList],
      model: index.model,
      provider: embedder.provider,
      indexSize: index.size,
      ms: Date.now() - startedAt,
    };
  } catch (error) {
    return { status: "unavailable", reason: errorMessage(error) };
  }
}

/**
 * Starts the vector search without letting an unused result go unhandled (hadith-only routes never
 * await it). Returns undefined when Quran search is not hybrid.
 */
export function startQuranVectorSearch(
  query: string,
  questionRewrite: Promise<QuestionRewrite> | undefined,
  env: Env = process.env,
): Promise<QuranVectorSearch> | undefined {
  return getQuranSearchMode(env) === "hybrid" ? searchQuranVectors(query, questionRewrite, { env }) : undefined;
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
