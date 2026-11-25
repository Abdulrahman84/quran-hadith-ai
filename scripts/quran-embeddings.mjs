#!/usr/bin/env node
// Builds and checks the Quran embedding index used by hybrid Quran search (QURAN_SEARCH_MODE=hybrid).
// One vector per ayah, embedded from the ayah text together with its short modern tafsir, read from the
// same quran.db the Tafsir MCP serves. Usage: node scripts/quran-embeddings.mjs --help
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Bump when the embedding text changes, so a stale index fails its check. */
export const QURAN_EMBEDDING_RECIPE = "ayah+moyassar/v1";
export const QURAN_INDEX_MAGIC = "SANADQVI";
export const QURAN_INDEX_VERSION = 1;
export const QURAN_AYAH_COUNT = 6236;

// The same mark stripping the hadith index uses (hadith-mcp embeddings/text.ts), so queries
// and documents are cleaned alike.
const arabicMarksPattern = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const decorativePattern = /[ـ‎‏‪-‮]/g;

export function stripArabicMarks(value) {
  return value.replace(arabicMarksPattern, "").replace(decorativePattern, "").replace(/\s+/g, " ").trim();
}

/** The text embedded for one ayah: the ayah itself, then the Muyassar tafsir in modern wording. */
export function embeddingTextForAyah(ayah) {
  return [ayah.text, ayah.moyassar]
    .map((part) => stripArabicMarks(part ?? ""))
    .filter((part) => part.length > 0)
    .join("\n\n");
}

export function textsSha256(texts) {
  const hash = createHash("sha256").update(QURAN_EMBEDDING_RECIPE);
  texts.forEach((text) => hash.update("\0").update(text));
  return hash.digest("hex");
}

export async function fileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

/** Every ayah in mushaf order with its Muyassar tafsir. */
export async function readAyahs(dbPath) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath, { readOnly: true });

  try {
    return db
      .prepare(
        `SELECT ayah_fts.surahNo AS surah, ayah_fts.ayahNo AS ayah, ayah_fts.text_original AS text, tafsir_moyassar.tafsir AS moyassar
         FROM ayah_fts
         LEFT JOIN tafsir_moyassar ON tafsir_moyassar.sura = ayah_fts.surahNo AND tafsir_moyassar.aya = ayah_fts.ayahNo
         ORDER BY ayah_fts.surahNo, ayah_fts.ayahNo`,
      )
      .all()
      .map((row) => ({ surah: Number(row.surah), ayah: Number(row.ayah), text: String(row.text ?? ""), moyassar: row.moyassar ?? null }));
  } finally {
    db.close();
  }
}

/**
 * File layout (little-endian): 8-byte magic, uint32 format version, uint32 header length, a JSON
 * header padded with spaces to a multiple of 4 bytes, then count × (uint16 surah, uint16 ayah),
 * then count × dims float32 L2-normalized vectors. Plain bytes, so the app loads it without SQLite.
 */
export function encodeQuranIndex({ header, verses, vectors }) {
  const dims = header.dims;
  const count = verses.length;
  let headerJson = JSON.stringify({ ...header, count });
  while (Buffer.byteLength(headerJson) % 4 !== 0) headerJson += " ";
  const headerBytes = Buffer.from(headerJson, "utf8");
  const prefix = Buffer.alloc(16);
  prefix.write(QURAN_INDEX_MAGIC, 0, "ascii");
  prefix.writeUInt32LE(QURAN_INDEX_VERSION, 8);
  prefix.writeUInt32LE(headerBytes.length, 12);
  const keys = Buffer.alloc(count * 4);
  verses.forEach(([surah, ayah], index) => {
    keys.writeUInt16LE(surah, index * 4);
    keys.writeUInt16LE(ayah, index * 4 + 2);
  });
  const matrix = Buffer.alloc(count * dims * 4);
  vectors.forEach((vector, row) => {
    if (vector.length !== dims) throw new Error(`Vector ${row} has ${vector.length} dimensions, expected ${dims}.`);
    vector.forEach((value, dim) => matrix.writeFloatLE(value, (row * dims + dim) * 4));
  });
  return Buffer.concat([prefix, headerBytes, keys, matrix]);
}

/** Reads the header and verse keys (not the vectors) and checks the file length. */
export function decodeQuranIndexHeader(buffer) {
  if (buffer.length < 16 || buffer.toString("ascii", 0, 8) !== QURAN_INDEX_MAGIC) {
    throw new Error("Not a Quran embedding index (bad magic).");
  }
  const version = buffer.readUInt32LE(8);
  if (version !== QURAN_INDEX_VERSION) throw new Error(`Unsupported Quran index version ${version}.`);
  const headerLength = buffer.readUInt32LE(12);
  const header = JSON.parse(buffer.toString("utf8", 16, 16 + headerLength));
  const keysOffset = 16 + headerLength;
  const matrixOffset = keysOffset + header.count * 4;
  const expectedLength = matrixOffset + header.count * header.dims * 4;
  if (buffer.length !== expectedLength) {
    throw new Error(`Quran index is ${buffer.length} bytes; its header implies ${expectedLength}.`);
  }
  const verses = Array.from({ length: header.count }, (_, index) => [
    buffer.readUInt16LE(keysOffset + index * 4),
    buffer.readUInt16LE(keysOffset + index * 4 + 2),
  ]);
  return { header, verses, matrixOffset };
}

function normalize(values) {
  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return norm === 0 ? values : values.map((value) => value / norm);
}

async function postJson(url, body, headers) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) return response.json();
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    throw new Error(`Embedding request to ${url} failed with HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

/** Ollama by default (the index was built with local bge-m3); EMBEDDINGS_BASE_URL selects an OpenAI-compatible API. */
function embedderFromEnv(env) {
  const baseUrl = env.EMBEDDINGS_BASE_URL?.trim();
  const kind = env.EMBEDDINGS_PROVIDER?.trim().toLowerCase() || (baseUrl ? "openai" : "ollama");
  const model = env.EMBEDDINGS_MODEL?.trim() || "bge-m3";

  if (kind === "openai") {
    if (!baseUrl) throw new Error("EMBEDDINGS_PROVIDER=openai needs EMBEDDINGS_BASE_URL.");
    const apiKey = env.EMBEDDINGS_API_KEY?.trim();
    return {
      model,
      label: `${model} via ${baseUrl}`,
      async embed(texts) {
        const payload = await postJson(`${baseUrl.replace(/\/+$/, "")}/embeddings`, { model, input: texts }, apiKey ? { Authorization: `Bearer ${apiKey}` } : {});
        return [...payload.data].sort((left, right) => left.index - right.index).map((item) => normalize(item.embedding));
      },
    };
  }

  const ollamaUrl = (env.OLLAMA_URL?.trim() || "http://127.0.0.1:11434").replace(/\/+$/, "");
  return {
    model,
    label: `${model} via Ollama at ${ollamaUrl}`,
    async embed(texts) {
      const payload = await postJson(`${ollamaUrl}/api/embed`, { model, input: texts }, {});
      return payload.embeddings.map(normalize);
    },
  };
}

const defaultDbPath = () => process.env.TAFSIR_DB_PATH?.trim() || path.join(os.homedir(), ".cache/tafsir-mcp/quran.db");

async function build({ dbPath, outPath, batchSize, indexModel }) {
  const embedder = embedderFromEnv(process.env);
  const ayahs = await readAyahs(dbPath);
  const texts = ayahs.map(embeddingTextForAyah);
  const sourceDbSha256 = await fileSha256(dbPath);
  console.error(`Embedding ${ayahs.length} ayahs from ${dbPath} with ${embedder.label}, batch size ${batchSize}`);

  const vectors = [];
  const startedAt = Date.now();
  for (let start = 0; start < texts.length; start += batchSize) {
    vectors.push(...(await embedder.embed(texts.slice(start, start + batchSize))));
    if (vectors.length % (batchSize * 20) === 0 || vectors.length === texts.length) {
      const seconds = (Date.now() - startedAt) / 1000;
      console.error(`  ${vectors.length}/${texts.length} (${(vectors.length / seconds).toFixed(1)}/s)`);
    }
  }

  const header = {
    model: indexModel || embedder.model,
    dims: vectors[0].length,
    recipe: QURAN_EMBEDDING_RECIPE,
    textsSha256: textsSha256(texts),
    sourceDbSha256,
    builtAt: new Date().toISOString(),
    attribution: "Quranic text and Al-Muyassar tafsir from Tafsir MCP by Tafsir Center for Quranic Studies, licensed CC BY 4.0.",
  };
  const buffer = encodeQuranIndex({ header, verses: ayahs.map((row) => [row.surah, row.ayah]), vectors });
  fs.writeFileSync(outPath, buffer);
  console.error(`Wrote ${outPath} (${(buffer.length / 1e6).toFixed(1)} MB, ${header.dims} dimensions, model ${header.model}).`);
  console.error(`sha256 ${await fileSha256(outPath)}`);
}

/**
 * Verifies an index (for example one downloaded during the Docker build) against quran.db: the
 * embedded texts must hash the same, every ayah must be present in order, and the model must match.
 */
async function check({ dbPath, indexPath, indexModel }) {
  const { header, verses } = decodeQuranIndexHeader(fs.readFileSync(indexPath));
  const ayahs = await readAyahs(dbPath);
  const problems = [];

  if (header.recipe !== QURAN_EMBEDDING_RECIPE) problems.push(`recipe ${header.recipe}, expected ${QURAN_EMBEDDING_RECIPE}`);
  if (indexModel && header.model !== indexModel) problems.push(`model ${header.model}, expected ${indexModel}`);
  if (verses.length !== ayahs.length) problems.push(`${verses.length} vectors for ${ayahs.length} ayahs`);
  if (verses.some(([surah, ayah], index) => ayahs[index]?.surah !== surah || ayahs[index]?.ayah !== ayah)) {
    problems.push("verse keys differ from quran.db");
  }
  if (header.textsSha256 !== textsSha256(ayahs.map(embeddingTextForAyah))) problems.push("embedded texts differ from quran.db");

  console.error(`Quran index check: ${verses.length} ayahs, ${header.dims} dimensions, model ${header.model}, recipe ${header.recipe}.`);
  if (problems.length > 0) throw new Error(`Quran index ${indexPath} does not match ${dbPath}: ${problems.join("; ")}.`);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      db: { type: "string" },
      out: { type: "string" },
      index: { type: "string" },
      "batch-size": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = positionals[0];

  if (values.help || !["build", "check"].includes(command)) {
    console.log(`Usage:
  node scripts/quran-embeddings.mjs build [--db quran.db] [--out quran-embeddings.bin] [--batch-size 32]
  node scripts/quran-embeddings.mjs check [--db quran.db] [--index quran-embeddings.bin]
--db defaults to TAFSIR_DB_PATH, then ~/.cache/tafsir-mcp/quran.db. The index defaults to
QURAN_EMBEDDINGS_PATH, then quran-embeddings-bge-m3.bin next to the database.
Build embeds with EMBEDDINGS_* settings (Ollama bge-m3 by default) and stores vectors under
EMBEDDINGS_INDEX_MODEL or EMBEDDINGS_MODEL. Check compares the stored model with EMBEDDINGS_INDEX_MODEL when set.`);
    process.exit(values.help ? 0 : 1);
  }

  const dbPath = path.resolve(values.db ?? defaultDbPath());
  const indexPath = path.resolve(
    values.out ?? values.index ?? (process.env.QURAN_EMBEDDINGS_PATH?.trim() || path.join(path.dirname(dbPath), "quran-embeddings-bge-m3.bin")),
  );
  const indexModel = process.env.EMBEDDINGS_INDEX_MODEL?.trim() || undefined;

  if (command === "build") {
    await build({ dbPath, outPath: indexPath, batchSize: Number.parseInt(values["batch-size"] ?? "32", 10), indexModel });
  } else {
    await check({ dbPath, indexPath, indexModel });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Quran embeddings failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
