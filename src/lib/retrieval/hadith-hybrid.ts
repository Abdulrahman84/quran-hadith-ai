export type HadithSearchMode = "lexical" | "hybrid";

type Env = Record<string, string | undefined>;

/**
 * HADITH_SEARCH_MODE=hybrid adds one semantic_search_hadith call (full-text + embedding
 * similarity, fused on the Hadith MCP side) for the user's question, next to the planned
 * lexical search_hadith queries. Anything else keeps lexical search only.
 */
export function getHadithSearchMode(env: Env = process.env): HadithSearchMode {
  return env.HADITH_SEARCH_MODE?.trim().toLowerCase() === "hybrid" ? "hybrid" : "lexical";
}

// The MCP child process only inherits a minimal default environment, so the embedding
// settings the Hadith MCP reads have to be passed through explicitly.
const embeddingEnvKeys = [
  "HADITH_MCP_EMBEDDINGS_PATH",
  "HADITH_MCP_VECTOR_WEIGHT",
  "EMBEDDINGS_PROVIDER",
  "EMBEDDINGS_MODEL",
  "EMBEDDINGS_BASE_URL",
  "EMBEDDINGS_API_KEY",
  "EMBEDDINGS_TIMEOUT_MS",
  "OLLAMA_URL",
] as const;

export function hadithMcpEmbeddingEnv(env: Env = process.env): Record<string, string> {
  return Object.fromEntries(
    embeddingEnvKeys.flatMap((key) => {
      const value = env[key]?.trim();
      return value ? [[key, value]] : [];
    }),
  );
}

export const HADITH_FUSION_K = 60;

function recordKey(record: { collection: string; hadithNumber: string | null; reference: string }) {
  return `${record.collection}:${record.hadithNumber || record.reference}`;
}

/**
 * Reciprocal rank fusion of already-ranked hadith lists: score = Σ 1 / (k + rank).
 * Ties keep first-seen order, so earlier lists win ties. The first list's copy of a
 * record is kept, and ranks are renumbered from 1.
 */
export function fuseHadithRankings<T extends { collection: string; hadithNumber: string | null; reference: string; rank: number | null }>(
  lists: T[][],
  k: number = HADITH_FUSION_K,
): T[] {
  const fused = new Map<string, { record: T; score: number; firstSeen: number }>();

  lists.forEach((list) => {
    const seenInList = new Set<string>();

    list.forEach((record) => {
      const key = recordKey(record);

      if (seenInList.has(key)) {
        return;
      }

      seenInList.add(key);
      const rank = seenInList.size;
      const existing = fused.get(key);

      if (existing) {
        existing.score += 1 / (k + rank);
      } else {
        fused.set(key, { record, score: 1 / (k + rank), firstSeen: fused.size });
      }
    });
  });

  return [...fused.values()]
    .sort((left, right) => right.score - left.score || left.firstSeen - right.firstSeen)
    .map(({ record }, index) => ({ ...record, rank: index + 1 }));
}
