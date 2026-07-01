import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import { planHadithRetrievalQueries } from "./hadith-query-planner";
import { getMcpPayload, withStdioMcpClient, type McpCallResult } from "./mcp-stdio";
import { planRetrievalQuery, splitFallbackQueries } from "./query-planner";
import type { RetrievalLanguage, RetrievalResponse, SourceGrade, SourceRecord } from "./types";

type HadithGrade = {
  value: string;
  source: string;
  source_reference: string;
  provenance_notes: string[];
};

type HadithSearchResult = {
  collection: string;
  display_name: string;
  book: string | null;
  chapter: string | null;
  hadith_number: string;
  arabic_text: string;
  english_text: string | null;
  grade: HadithGrade | null;
  source_dataset: string;
  source_url_or_reference: string;
  provenance_notes: string[];
  snippet: string;
  rank: number;
};

type SearchHadithOutput = {
  query: string;
  collection: string | null;
  language: "arabic" | "english" | "both";
  limit: number;
  offset: number;
  total: number;
  results: HadithSearchResult[];
  provenance_notes: string[];
};

type SearchAttempt = {
  output: SearchHadithOutput;
  query: string;
};

const DEFAULT_HADITH_MCP_ROOT = "/Users/abdulrahman/Projects/hadith-mcp";
const DEFAULT_HADITH_MCP_DB_PATH = `${DEFAULT_HADITH_MCP_ROOT}/data/generated/hadith-meeatif.sqlite`;
const DEFAULT_HADITH_MCP_CLI = `${DEFAULT_HADITH_MCP_ROOT}/packages/hadith-mcp/dist/cli.js`;

function getHadithMcpConfig() {
  const command = process.env.HADITH_MCP_COMMAND?.trim() || "node";
  const cliPath = process.env.HADITH_MCP_CLI_PATH?.trim() || DEFAULT_HADITH_MCP_CLI;
  const dbPath = process.env.HADITH_MCP_DB_PATH?.trim() || DEFAULT_HADITH_MCP_DB_PATH;
  const cwd = process.env.HADITH_MCP_CWD?.trim() || DEFAULT_HADITH_MCP_ROOT;

  return { command, cliPath, dbPath, cwd };
}

function isSearchHadithOutput(value: unknown): value is SearchHadithOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SearchHadithOutput>;
  return (
    typeof candidate.query === "string" &&
    typeof candidate.total === "number" &&
    Array.isArray(candidate.results) &&
    Array.isArray(candidate.provenance_notes)
  );
}

function normalizeGrade(grade: HadithGrade | null): SourceGrade | null {
  if (grade === null) {
    return null;
  }

  return {
    value: grade.value,
    source: grade.source,
    sourceReference: grade.source_reference,
    provenanceNotes: grade.provenance_notes,
  };
}

function normalizeRecord(record: HadithSearchResult): SourceRecord {
  return {
    id: `${record.collection}:${record.hadith_number}:${record.rank}`,
    sourceKind: "hadith",
    collection: record.collection,
    displayName: record.display_name,
    reference: record.hadith_number,
    book: record.book,
    chapter: record.chapter,
    hadithNumber: record.hadith_number,
    surahNumber: null,
    surahName: null,
    ayahNumber: null,
    verseKey: null,
    translationEdition: null,
    tafsirSource: null,
    arabicText: record.arabic_text,
    englishText: record.english_text,
    tafsirText: null,
    grade: normalizeGrade(record.grade),
    sourceDataset: record.source_dataset,
    sourceReference: record.source_url_or_reference,
    provenanceNotes: record.provenance_notes,
    snippet: record.snippet,
    rank: record.rank,
  };
}

async function callSearchHadith(client: Client, query: string, language: RetrievalLanguage): Promise<SearchAttempt | null> {
  const result = (await client.callTool({
    name: "search_hadith",
    arguments: {
      query,
      language,
      limit: 5,
      offset: 0,
    },
  })) as McpCallResult;

  const payload = getMcpPayload(result);

  if (result.isError || !isSearchHadithOutput(payload)) {
    return null;
  }

  return {
    output: payload,
    query,
  };
}

export async function searchHadithSources(query: string, language: RetrievalLanguage): Promise<RetrievalResponse> {
  const planned = planRetrievalQuery(query, language);
  const config = getHadithMcpConfig();
  const stderrChunks: string[] = [];

  try {
    return await withStdioMcpClient(
      {
        command: config.command,
        args: [config.cliPath],
        cwd: config.cwd,
        env: {
          HADITH_MCP_DB_PATH: config.dbPath,
        },
      },
      async ({ client, stderr }) => {
        let searchAttempt: SearchAttempt | null = null;
        const hadithQueryPlan = await planHadithRetrievalQueries(query, language, planned.retrievalQuery);

        for (const searchQuery of hadithQueryPlan.queries) {
          const attempt = await callSearchHadith(client, searchQuery, language);

          if (!searchAttempt || (attempt && attempt.output.results.length > 0)) {
            searchAttempt = attempt;
          }

          if (searchAttempt && searchAttempt.output.results.length > 0) {
            break;
          }
        }

        if (searchAttempt?.output.results.length === 0) {
          for (const fallbackQuery of splitFallbackQueries(query, language)) {
            if (fallbackQuery === planned.retrievalQuery) {
              continue;
            }

            const fallbackAttempt = await callSearchHadith(client, fallbackQuery, language);

            if (fallbackAttempt && fallbackAttempt.output.results.length > 0) {
              searchAttempt = fallbackAttempt;
              break;
            }
          }
        }

        if (!searchAttempt) {
          return {
            status: "error",
            query,
            retrievalQuery: planned.retrievalQuery,
            sourceMode: "hadith-only",
            records: [],
            warnings: [
              {
                code: "hadith_mcp_unexpected_response",
                message: "Hadith MCP returned a response the product app could not normalize.",
              },
            ],
            provenanceNotes: stderr.join("").trim() ? [stderr.join("").trim()] : [],
          };
        }

        const records = searchAttempt.output.results.map(normalizeRecord);

        return {
          status: records.length > 0 ? "ok" : "empty",
          query,
          retrievalQuery: searchAttempt.query,
          sourceMode: "hadith-only",
          records,
          warnings: records.length > 0 ? [] : [{ code: "no_hadith_results", message: "No hadith records matched this query." }],
          provenanceNotes: [
            ...searchAttempt.output.provenance_notes,
            `Hadith query planner: ${hadithQueryPlan.planner}.`,
            ...(hadithQueryPlan.warning ? [`Hadith query planner warning: ${hadithQueryPlan.warning}`] : []),
            ...(planned.changed || searchAttempt.query !== query ? [`Product query planner searched Hadith MCP for: ${searchAttempt.query}`] : []),
          ],
        };
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Hadith MCP error.";

    return {
      status: "error",
      query,
      retrievalQuery: planned.retrievalQuery,
      sourceMode: "hadith-only",
      records: [],
      warnings: [
        {
          code: "hadith_mcp_error",
          message,
        },
      ],
      provenanceNotes: stderrChunks.join("").trim() ? [stderrChunks.join("").trim()] : [],
    };
  }
}
