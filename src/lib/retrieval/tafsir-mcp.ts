import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { getMcpPayload, withStdioMcpClient, type McpCallResult } from "./mcp-stdio";
import { planRetrievalQuery, splitFallbackQueries } from "./query-planner";
import {
  normalizeFetchedAyahWithTafsir,
  normalizeQuranSearchResult,
  normalizeTafsirSearchResult,
  type FetchedAyah,
  type FetchedTafsir,
  type QuranSearchResult,
  type TafsirSearchResult,
} from "./tafsir-normalizer";
import type { RetrievalLanguage, RetrievalResponse } from "./types";

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
  const args = splitArgs(process.env.TAFSIR_MCP_ARGS, ["tafsir-mcp"]);
  const dbPath = process.env.TAFSIR_DB_PATH?.trim();
  const env = dbPath ? { TAFSIR_DB_PATH: dbPath } : undefined;

  return { command, args, env };
}

function defaultTafsirSource(language: RetrievalLanguage) {
  return language === "english" ? "mukhtasar_en" : "moyassar";
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

async function callExactVerse(client: Client, query: string, language: RetrievalLanguage) {
  const parsed = parseVerseReference(query);

  if (!parsed) {
    return [];
  }

  const [ayahPayload, tafsirPayload] = await Promise.all([
    callTool(client, "fetch_ayah", { surah: parsed.surah, ayah: parsed.ayah }),
    callTool(client, "fetch_tafsir", {
      surah: parsed.surah,
      ayah: parsed.ayah,
      sources: [defaultTafsirSource(language)],
    }),
  ]);

  if (!isFetchedAyah(ayahPayload) || !isFetchedTafsir(tafsirPayload)) {
    return [];
  }

  return normalizeFetchedAyahWithTafsir(ayahPayload, tafsirPayload);
}

async function callSearches(client: Client, query: string, language: RetrievalLanguage) {
  const tafsirSource = defaultTafsirSource(language);
  const [quranPayload, tafsirPayload] = await Promise.all([
    callTool(client, "search_quran_text", { query, limit: 5 }),
    callTool(client, "search_in_tafsir", { query, source: tafsirSource, limit: 5 }),
  ]);
  const quranRecords = Array.isArray(quranPayload)
    ? quranPayload.filter(isQuranSearchResult).map((result, index) => normalizeQuranSearchResult(result, index))
    : [];
  const tafsirRecords = Array.isArray(tafsirPayload)
    ? tafsirPayload.filter(isTafsirSearchResult).map((result, index) => normalizeTafsirSearchResult(result, tafsirSource, index))
    : [];

  return [...quranRecords, ...tafsirRecords];
}

async function retrieveTafsirRecords(client: Client, query: string, language: RetrievalLanguage) {
  const exactRecords = await callExactVerse(client, query, language);

  if (exactRecords.length > 0) {
    return exactRecords;
  }

  return callSearches(client, query, language);
}

export async function searchTafsirSources(query: string, language: RetrievalLanguage): Promise<RetrievalResponse> {
  const planned = planRetrievalQuery(query, language);
  const config = getTafsirMcpConfig();

  try {
    return await withStdioMcpClient(
      {
        command: config.command,
        args: config.args,
        env: config.env,
      },
      async ({ client, stderr }) => {
        let retrievalQuery = planned.retrievalQuery;
        let records = await retrieveTafsirRecords(client, retrievalQuery, language);

        if (records.length === 0) {
          for (const fallbackQuery of splitFallbackQueries(query, language)) {
            if (fallbackQuery === retrievalQuery) {
              continue;
            }

            const fallbackRecords = await retrieveTafsirRecords(client, fallbackQuery, language);

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
            ...(planned.changed || retrievalQuery !== query ? [`Product query planner searched Tafsir MCP for: ${retrievalQuery}`] : []),
            ...(stderr.join("").trim() ? [stderr.join("").trim()] : []),
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
