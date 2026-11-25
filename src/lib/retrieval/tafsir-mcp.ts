import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { formatMcpStderr } from "./mcp-error";
import { getMcpPayload, withStdioMcpClient, type McpCallResult } from "./mcp-stdio";
import { planRetrievalQuery, splitFallbackQueries } from "./query-planner";
import type { QuestionRewrite } from "./question-rewrite";
import { fuseAyahRankings, QURAN_FUSION_K, quranVectorWaitMs, type QuranVectorSearch, type QuranVectorSearchHandle } from "./quran-hybrid";
import { resolveTafsirSources, type TafsirSourceSelection } from "./tafsir-sources";
import {
  normalizeFetchedAyahWithTafsir,
  normalizeFetchedTafsirForAyah,
  normalizeQuranSearchResult,
  normalizeTafsirSearchResult,
  planTafsirSearchQueries,
  withoutQuranSourcePhrase,
  type FetchedAyah,
  type FetchedTafsir,
  type QuranSearchResult,
  type TafsirSearchResult,
  unwrapTafsirToolResults,
} from "./tafsir-normalizer";
import type { RetrievalLanguage, RetrievalResponse, SourceRecord } from "./types";

const tafsirAttribution = "Tafsir MCP by Tafsir Center for Quranic Studies. Quranic data licensed CC BY 4.0.";

function splitArgs(value: string | undefined, fallback: string[]) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  return trimmed.split(/\s+/).filter(Boolean);
}

function getTafsirMcpConfig() {
  const command = process.env.TAFSIR_MCP_COMMAND?.trim() || "uvx";
  const args = splitArgs(process.env.TAFSIR_MCP_ARGS, [
    "--with",
    "mcp==1.28.1",
    "--from",
    "tafsir-mcp==1.0.0",
    "tafsir-mcp",
  ]);
  const dbPath = process.env.TAFSIR_DB_PATH?.trim();
  const env = dbPath ? { TAFSIR_DB_PATH: dbPath } : undefined;

  return { command, args, env };
}

function isQuranSearchResult(value: unknown): value is QuranSearchResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<QuranSearchResult>;
  return typeof candidate.surah === "number" && typeof candidate.ayah === "number" && typeof candidate.text === "string";
}

function isTafsirSearchResult(value: unknown): value is TafsirSearchResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<TafsirSearchResult>;
  return (
    typeof candidate.surah === "number" &&
    typeof candidate.ayah === "number" &&
    typeof candidate.tafsir_excerpt === "string" &&
    typeof candidate.source_attribution === "string"
  );
}

function isFetchedAyah(value: unknown): value is FetchedAyah {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FetchedAyah>;
  return typeof candidate.surah === "number" && typeof candidate.ayah === "number" && typeof candidate.text === "string";
}

function isFetchedTafsir(value: unknown): value is FetchedTafsir {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<FetchedTafsir>;
  return typeof candidate.surah === "number" && typeof candidate.ayah === "number" && Array.isArray(candidate.tafsirs);
}

function parseVerseReference(query: string) {
  const match = query.match(/(?:^|\D)(\d{1,3})\s*[:：]\s*(\d{1,3})(?:\D|$)/);

  if (!match) {
    return null;
  }

  return {
    surah: Number.parseInt(match[1], 10),
    ayah: Number.parseInt(match[2], 10),
  };
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as McpCallResult;

  if (result.isError) {
    return undefined;
  }

  return getMcpPayload(result);
}

async function callExactVerse(client: Client, query: string, tafsirSources: string[]) {
  const parsed = parseVerseReference(query);

  if (!parsed) {
    return [];
  }

  const [ayahPayload, tafsirPayload] = await Promise.all([
    callTool(client, "fetch_ayah", { surah: parsed.surah, ayah: parsed.ayah }),
    callTool(client, "fetch_tafsir", {
      surah: parsed.surah,
      ayah: parsed.ayah,
      sources: tafsirSources,
    }),
  ]);

  if (!isFetchedAyah(ayahPayload) || !isFetchedTafsir(tafsirPayload)) {
    return [];
  }

  return normalizeFetchedAyahWithTafsir(ayahPayload, tafsirPayload);
}

/**
 * Al-Tabari is by far the largest tafsir: one text search over it takes seconds on a small
 * server (about 4 s on a cold cache even on a laptop), while the others take milliseconds.
 * When all tafsirs are selected it is left out of the text search that finds verses, but its
 * commentary is still fetched for every verse found. A user who picks al-Tabari alone still
 * searches it.
 */
const slowTafsirSearchSources = new Set(["tabary"]);

/** Single words never worth a fallback search on their own (prepositions, question words). */
const arabicFunctionWords = new Set(["في", "فى", "من", "عن", "على", "الى", "إلى", "ما", "ماذا", "شو", "ايش", "وش"]);

/**
 * At most this many query attempts per search. Each attempt is several tool calls that the tafsir
 * server runs one at a time, which costs about 3 s on a small production instance.
 */
const MAX_TAFSIR_ATTEMPTS = 2;

/** Tafsir text written in English; the others are Arabic. */
const englishTafsirSources = new Set(["mukhtasar_en"]);

/**
 * The tafsirs whose text is searched to find verses: the ones written in the question's language
 * (an English query can never match Arabic commentary), without al-Tabari. Every selected tafsir
 * is still fetched for the verses found. An explicit single-tafsir choice is always searched.
 */
function tafsirSearchSources(tafsirSources: string[], language: RetrievalLanguage = "arabic") {
  if (tafsirSources.length === 1) {
    return tafsirSources;
  }

  const sameLanguage = tafsirSources.filter((source) => englishTafsirSources.has(source) === (language === "english"));
  const fast = sameLanguage.filter((source) => !slowTafsirSearchSources.has(source));
  return fast.length > 0 ? fast : sameLanguage.length > 0 ? sameLanguage : tafsirSources;
}

async function callSearches(client: Client, query: string, tafsirSources: string[], language: RetrievalLanguage) {
  const searchSources = tafsirSearchSources(tafsirSources, language);
  const [quranPayload, tafsirPayloads] = await Promise.all([
    callTool(client, "search_quran_text", { query, limit: 5 }),
    Promise.all(searchSources.map((source) => callTool(client, "search_in_tafsir", { query, source, limit: 5 }))),
  ]);
  const quranRecords = unwrapTafsirToolResults(quranPayload)
    .filter(isQuranSearchResult)
    .map((result, index) => normalizeQuranSearchResult(result, index));
  const quranResults = unwrapTafsirToolResults(quranPayload).filter(isQuranSearchResult);
  const fetchedTafsirRecords = (
    await Promise.all(
      quranResults.map(async (result, index) => {
        const payload = await callTool(client, "fetch_tafsir", {
          surah: result.surah,
          ayah: result.ayah,
          sources: tafsirSources,
        });

        if (!isFetchedTafsir(payload)) {
          return [];
        }

        return normalizeFetchedTafsirForAyah(result, payload, quranRecords.length + index + 1);
      }),
    )
  ).flat();
  const tafsirRecords = tafsirPayloads.flatMap((payload, sourceIndex) => {
    const source = searchSources[sourceIndex] || searchSources[0] || "moyassar";

    return unwrapTafsirToolResults(payload)
      .filter(isTafsirSearchResult)
      .map((result, index) => normalizeTafsirSearchResult(result, source, quranRecords.length + fetchedTafsirRecords.length + index + 1));
  });

  return [...quranRecords, ...fetchedTafsirRecords, ...tafsirRecords].filter((record, index, records) => {
    return records.findIndex((candidate) => candidate.sourceReference === record.sourceReference) === index;
  });
}

async function retrieveTafsirRecords(client: Client, query: string, tafsirSources: string[], language: RetrievalLanguage) {
  const exactRecords = await callExactVerse(client, query, tafsirSources);

  if (exactRecords.length > 0) {
    return { records: exactRecords, exactVerse: true };
  }

  return { records: await callSearches(client, query, tafsirSources, language), exactVerse: false };
}

/**
 * Fused positions open to ayahs that only the embedding search found. Each one costs two more
 * tool calls (the ayah and its tafsir), so the embedding search adds at most this many verses
 * and never removes one the keyword search found.
 */
export const QURAN_VECTOR_ADDITIONS = 5;

type HybridOutcome = { records: SourceRecord[]; keywordAyahs: number; addedAyahs: number; fetchMs: number };

async function fetchAyahRecords(client: Client, verseKey: string, tafsirSources: string[]) {
  const [surah, ayah] = verseKey.split(":").map((part) => Number.parseInt(part, 10));
  const [ayahPayload, tafsirPayload] = await Promise.all([
    callTool(client, "fetch_ayah", { surah, ayah }),
    callTool(client, "fetch_tafsir", { surah, ayah, sources: tafsirSources }),
  ]);

  return isFetchedAyah(ayahPayload) && isFetchedTafsir(tafsirPayload) ? normalizeFetchedAyahWithTafsir(ayahPayload, tafsirPayload) : [];
}

/**
 * Reciprocal rank fusion of the keyword ayahs (in the order the keyword search returned them) with
 * the embedding search. Vector lists share one vote, so together they weigh the same as the keyword
 * list, as in Hadith MCP's own hybrid search. Each ayah's lead
 * record (its verse, or its tafsir when the keyword search only matched tafsir text) comes first in
 * fused order, then the rest of each ayah's records: the same shape the keyword search returns.
 */
async function fuseWithVectorSearch(
  client: Client,
  keywordRecords: SourceRecord[],
  vectorSearch: Extract<QuranVectorSearch, { status: "ok" }>,
  tafsirSources: string[],
): Promise<HybridOutcome> {
  const keywordKeys = [...new Set(keywordRecords.flatMap((record) => (record.verseKey ? [record.verseKey] : [])))];
  const keywordKeySet = new Set(keywordKeys);
  const vectorWeight = 1 / vectorSearch.lists.length;
  const fused = fuseAyahRankings([
    { verseKeys: keywordKeys },
    ...vectorSearch.lists.map((list) => ({ verseKeys: list.hits.map((hit) => hit.verseKey), weight: vectorWeight })),
  ]);
  const kept = fused
    .filter((item, position) => keywordKeySet.has(item.verseKey) || position < QURAN_VECTOR_ADDITIONS)
    .map((item) => item.verseKey);
  const added = kept.filter((verseKey) => !keywordKeySet.has(verseKey));
  const fetchStartedAt = Date.now();
  const fetched = await Promise.all(added.map((verseKey) => fetchAyahRecords(client, verseKey, tafsirSources)));
  const fetchMs = Date.now() - fetchStartedAt;
  const byAyah = new Map<string, SourceRecord[]>();

  [...keywordRecords, ...fetched.flat()].forEach((record) => {
    const key = record.verseKey ?? "";
    byAyah.set(key, [...(byAyah.get(key) ?? []), record]);
  });

  const groups = kept.map((verseKey) => byAyah.get(verseKey) ?? []).filter((group) => group.length > 0);
  const leads = groups.map((group) => group.find((record) => record.sourceKind === "quran") ?? group[0]);
  const records = [...leads, ...groups.flatMap((group) => group.filter((record) => !leads.includes(record)))].map(
    (record, index) => ({ ...record, rank: index + 1 }),
  );

  return {
    records,
    keywordAyahs: keywordKeys.length,
    addedAyahs: fetched.filter((group) => group.length > 0).length,
    fetchMs,
  };
}

function vectorProvenanceNotes(
  vectorSearch: QuranVectorSearch | null,
  hybrid: HybridOutcome | null,
  waitMs: number,
  exactVerse: boolean,
) {
  if (exactVerse) {
    return ["Quran semantic search skipped: the question names a verse, which is fetched directly."];
  }

  if (vectorSearch === null) {
    return [];
  }

  if (vectorSearch.status === "unavailable") {
    return [`Quran semantic search unavailable, used keyword search only: ${vectorSearch.reason.slice(0, 200)}`];
  }

  if (hybrid === null) {
    return [];
  }

  const queries = vectorSearch.lists.map((list) => list.query).join(" | ");
  return [
    `Quran search: hybrid, reciprocal rank fusion (k=${QURAN_FUSION_K}, keyword and embedding lists weighted equally) of ${hybrid.keywordAyahs} keyword-matched ayahs and the nearest of ${vectorSearch.indexSize} ayah embeddings (${vectorSearch.model} via ${vectorSearch.provider}) for: ${queries}.`,
    `Quran semantic search added ${hybrid.addedAyahs} ayahs the keyword search did not find. Timing: vector lists collected ${vectorSearch.ms} ms after the embedding started, keyword search waited ${waitMs} ms for them, fetching added ayahs ${hybrid.fetchMs} ms.`,
    "Embedding similarity finds related meaning; it does not verify a quotation.",
  ];
}

export async function searchTafsirSources(
  query: string,
  language: RetrievalLanguage,
  options: {
    tafsirSource?: TafsirSourceSelection;
    questionRewrite?: Promise<QuestionRewrite>;
    /** Set when QURAN_SEARCH_MODE=hybrid; see startQuranVectorSearch. */
    vectorSearch?: QuranVectorSearchHandle;
  } = {},
): Promise<RetrievalResponse> {
  const planned = planRetrievalQuery(query, language);
  const config = getTafsirMcpConfig();
  const selectedTafsirSources = resolveTafsirSources(options.tafsirSource);

  try {
    return await withStdioMcpClient(
      {
        command: config.command,
        args: config.args,
        env: config.env,
      },
      async ({ client, stderr }) => {
        // The Fusha rewrite goes first: a dialect word like «اهلنا» still matches some verse, so
        // searching the user's own words first would stop before the rewrite is ever tried.
        const rewrite = options.questionRewrite ? await options.questionRewrite : null;
        const searchQueries = [
          ...new Set([
            ...(rewrite?.fusha ? planTafsirSearchQueries(rewrite.fusha, language) : []),
            ...planTafsirSearchQueries(query, language),
            planned.retrievalQuery,
          ]),
        ];
        let retrievalQuery = searchQueries[0] || planned.retrievalQuery;
        let records: SourceRecord[] = [];
        let exactVerse = false;
        const startedAt = Date.now();
        const attemptMs: number[] = [];
        const timedAttempt = async (searchQuery: string) => {
          const attemptStartedAt = Date.now();
          const attempt = await retrieveTafsirRecords(client, searchQuery, selectedTafsirSources, language);
          attemptMs.push(Date.now() - attemptStartedAt);
          exactVerse ||= attempt.exactVerse;
          return attempt.records;
        };

        for (const searchQuery of searchQueries.slice(0, MAX_TAFSIR_ATTEMPTS)) {
          const attemptRecords = await timedAttempt(searchQuery);

          if (attemptRecords.length > 0) {
            retrievalQuery = searchQuery;
            records = attemptRecords;
            break;
          }
        }

        if (records.length === 0) {
          for (const fallbackQuery of splitFallbackQueries(withoutQuranSourcePhrase(query, language), language)) {
            if (
              fallbackQuery === retrievalQuery ||
              searchQueries.includes(fallbackQuery) ||
              arabicFunctionWords.has(fallbackQuery)
            ) {
              continue;
            }

            if (attemptMs.length > MAX_TAFSIR_ATTEMPTS) {
              break;
            }

            const fallbackRecords = await timedAttempt(fallbackQuery);

            if (fallbackRecords.length > 0) {
              retrievalQuery = fallbackQuery;
              records = fallbackRecords;
              break;
            }
          }
        }

        // A verse named by reference is already the answer; the embedding search would only add noise.
        const vectorWaitStartedAt = Date.now();
        const vectorSearch = options.vectorSearch && !exactVerse ? await options.vectorSearch.collect(quranVectorWaitMs(process.env)) : null;
        const waitMs = Date.now() - vectorWaitStartedAt;
        const hybrid =
          vectorSearch?.status === "ok" ? await fuseWithVectorSearch(client, records, vectorSearch, selectedTafsirSources) : null;
        records = hybrid?.records ?? records;

        return {
          status: records.length > 0 ? "ok" : "empty",
          query,
          retrievalQuery,
          sourceMode: "quran-tafsir-only",
          records,
          warnings: records.length > 0 ? [] : [{ code: "no_tafsir_results", message: "No Quran or tafsir records matched this query." }],
          provenanceNotes: [
            tafsirAttribution,
            ...(rewrite?.fusha ? [`Question rewritten for search: ${rewrite.fusha}`] : []),
            `Timing (tafsir): ${attemptMs.length} search attempts across ${tafsirSearchSources(selectedTafsirSources, language).length} searched tafsir works (${attemptMs.join(" + ")} ms), total ${Date.now() - startedAt} ms.`,
            ...(planned.changed || retrievalQuery !== query ? [`Product query planner searched Tafsir MCP for: ${retrievalQuery}`] : []),
            ...(options.vectorSearch ? vectorProvenanceNotes(vectorSearch, hybrid, waitMs, exactVerse) : []),
            ...(formatMcpStderr(stderr) ? [formatMcpStderr(stderr)] : []),
          ],
        };
      },
    );
  } catch (error) {
    return {
      status: "error",
      query,
      retrievalQuery: planned.retrievalQuery,
      sourceMode: "quran-tafsir-only",
      records: [],
      warnings: [
        {
          code: "tafsir_mcp_error",
          message: error instanceof Error ? error.message : "Unknown Tafsir MCP error.",
        },
      ],
      provenanceNotes: [tafsirAttribution],
    };
  }
}
