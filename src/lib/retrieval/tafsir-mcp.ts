import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { formatMcpStderr } from "./mcp-error";
import { getMcpPayload, withStdioMcpClient, type McpCallResult } from "./mcp-stdio";
import { planRetrievalQuery, splitFallbackQueries } from "./query-planner";
import type { QuestionRewrite } from "./question-rewrite";
import { resolveTafsirSources, type TafsirSourceSelection } from "./tafsir-sources";
import {
  normalizeFetchedAyahWithTafsir,
  normalizeFetchedTafsirForAyah,
  normalizeQuranSearchResult,
  normalizeTafsirSearchResult,
  planTafsirSearchQueries,
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

/** At most this many query attempts per search, so a question that finds nothing stays cheap. */
const MAX_TAFSIR_ATTEMPTS = 3;

function tafsirSearchSources(tafsirSources: string[]) {
  const fast = tafsirSources.filter((source) => !slowTafsirSearchSources.has(source));
  return fast.length > 0 ? fast : tafsirSources;
}

async function callSearches(client: Client, query: string, tafsirSources: string[]) {
  const searchSources = tafsirSearchSources(tafsirSources);
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

async function retrieveTafsirRecords(client: Client, query: string, tafsirSources: string[]) {
  const exactRecords = await callExactVerse(client, query, tafsirSources);

  if (exactRecords.length > 0) {
    return exactRecords;
  }

  return callSearches(client, query, tafsirSources);
}

export async function searchTafsirSources(
  query: string,
  language: RetrievalLanguage,
  options: { tafsirSource?: TafsirSourceSelection; questionRewrite?: Promise<QuestionRewrite> } = {},
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
        const startedAt = Date.now();
        const attemptMs: number[] = [];
        const timedAttempt = async (searchQuery: string) => {
          const attemptStartedAt = Date.now();
          const attemptRecords = await retrieveTafsirRecords(client, searchQuery, selectedTafsirSources);
          attemptMs.push(Date.now() - attemptStartedAt);
          return attemptRecords;
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
          for (const fallbackQuery of splitFallbackQueries(query, language)) {
            if (fallbackQuery === retrievalQuery || searchQueries.includes(fallbackQuery)) {
              continue;
            }

            if (attemptMs.length >= MAX_TAFSIR_ATTEMPTS + 1) {
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
            `Timing (tafsir): ${attemptMs.length} search attempts across ${tafsirSearchSources(selectedTafsirSources).length} searched tafsir works (${attemptMs.join(" + ")} ms), total ${Date.now() - startedAt} ms.`,
            ...(planned.changed || retrievalQuery !== query ? [`Product query planner searched Tafsir MCP for: ${retrievalQuery}`] : []),
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
