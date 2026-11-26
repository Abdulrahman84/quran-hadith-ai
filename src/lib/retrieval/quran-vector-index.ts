import { readFile } from "node:fs/promises";

/**
 * The Quran embedding index: one L2-normalized vector per ayah, built offline by
 * scripts/quran-embeddings.mjs (which documents the file layout). 6,236 × 1,024 floats is
 * about 25 MB, so an exact dot-product scan in memory takes a few milliseconds per query.
 */
export type QuranVectorIndex = {
  model: string;
  dims: number;
  size: number;
  recipe: string;
  /** "surah:ayah" for each row. */
  verseKeys: string[];
  /** Row-major size × dims. */
  matrix: Float32Array;
};

export type QuranVectorHit = { verseKey: string; similarity: number };

const MAGIC = "SANADQVI";
const FORMAT_VERSION = 1;

type IndexHeader = { model?: unknown; dims?: unknown; count?: unknown; recipe?: unknown };

export function parseQuranVectorIndex(buffer: Buffer): QuranVectorIndex {
  if (buffer.length < 16 || buffer.toString("ascii", 0, 8) !== MAGIC) {
    throw new Error("not a Quran embedding index (bad magic).");
  }

  const version = buffer.readUInt32LE(8);

  if (version !== FORMAT_VERSION) {
    throw new Error(`unsupported Quran index format version ${version}.`);
  }

  const headerLength = buffer.readUInt32LE(12);
  const header = JSON.parse(buffer.toString("utf8", 16, 16 + headerLength)) as IndexHeader;
  const { model, dims, count, recipe } = header;

  if (typeof model !== "string" || typeof recipe !== "string" || !Number.isInteger(dims) || !Number.isInteger(count)) {
    throw new Error("Quran index header is incomplete.");
  }

  const size = count as number;
  const width = dims as number;
  const keysOffset = 16 + headerLength;
  const matrixOffset = keysOffset + size * 4;
  const expectedLength = matrixOffset + size * width * 4;

  if (buffer.length !== expectedLength) {
    throw new Error(`Quran index is ${buffer.length} bytes; its header implies ${expectedLength}.`);
  }

  const verseKeys = Array.from(
    { length: size },
    (_, row) => `${buffer.readUInt16LE(keysOffset + row * 4)}:${buffer.readUInt16LE(keysOffset + row * 4 + 2)}`,
  );
  // Copy the vectors into their own buffer: a Float32Array view needs 4-byte alignment.
  const matrixBytes = new Uint8Array(size * width * 4);
  matrixBytes.set(buffer.subarray(matrixOffset, expectedLength));

  return { model, dims: width, size, recipe, verseKeys, matrix: new Float32Array(matrixBytes.buffer) };
}

export async function loadQuranVectorIndex(indexPath: string, model: string): Promise<QuranVectorIndex> {
  const index = parseQuranVectorIndex(await readFile(indexPath));

  if (index.model !== model) {
    throw new Error(`the Quran index was built with ${index.model}, but EMBEDDINGS_INDEX_MODEL is ${model}.`);
  }

  return index;
}

/** Top k ayahs by cosine similarity (the vectors are normalized, so a dot product). */
export function searchQuranVectorIndex(index: QuranVectorIndex, query: Float32Array, k: number): QuranVectorHit[] {
  if (query.length !== index.dims) {
    throw new Error(`the query embedding has ${query.length} dimensions; the Quran index has ${index.dims}.`);
  }

  const top: Array<{ row: number; score: number }> = [];

  for (let row = 0; row < index.size; row += 1) {
    const offset = row * index.dims;
    let score = 0;

    for (let dim = 0; dim < index.dims; dim += 1) {
      score += index.matrix[offset + dim] * query[dim];
    }

    if (top.length < k || score > top[top.length - 1].score) {
      if (top.length >= k) {
        top.pop();
      }

      const at = top.findIndex((item) => item.score < score);
      top.splice(at === -1 ? top.length : at, 0, { row, score });
    }
  }

  return top.map(({ row, score }) => ({ verseKey: index.verseKeys[row], similarity: score }));
}

const INDEX_RETRY_MS = 60_000;
let cached: { key: string; promise: Promise<QuranVectorIndex>; failedAt: number } | null = null;

/** Loads the index once per process; a failed load is retried after a minute, not on every search. */
export function getQuranVectorIndex(indexPath: string, model: string, load = loadQuranVectorIndex): Promise<QuranVectorIndex> {
  const key = `${indexPath}\0${model}`;

  if (!cached || cached.key !== key || (cached.failedAt > 0 && Date.now() - cached.failedAt > INDEX_RETRY_MS)) {
    const promise: Promise<QuranVectorIndex> = load(indexPath, model).catch((error: unknown) => {
      if (cached?.promise === promise) {
        cached.failedAt = Date.now();
      }

      throw error;
    });
    cached = { key, promise, failedAt: 0 };
  }

  return cached.promise;
}
