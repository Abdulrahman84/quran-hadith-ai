import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

import type { RetrievalResponse, SourceGrade, SourceRecord } from "./types";

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

type McpCallResult = {
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
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
    book: record.book,
    chapter: record.chapter,
    hadithNumber: record.hadith_number,
    arabicText: record.arabic_text,
    englishText: record.english_text,
    grade: normalizeGrade(record.grade),
    sourceDataset: record.source_dataset,
    sourceReference: record.source_url_or_reference,
    provenanceNotes: record.provenance_notes,
    snippet: record.snippet,
    rank: record.rank,
  };
}

export async function searchHadithSources(query: string): Promise<RetrievalResponse> {
  const config = getHadithMcpConfig();
  const client = new Client({ name: "quran-hadith-ai", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    args: [config.cliPath],
    cwd: config.cwd,
    env: {
      ...getDefaultEnvironment(),
      HADITH_MCP_DB_PATH: config.dbPath,
    },
    stderr: "pipe",
  });

  const stderrChunks: string[] = [];
  transport.stderr?.on("data", (chunk: Buffer | string) => {
    stderrChunks.push(chunk.toString());
  });

  try {
    await client.connect(transport);
    const result = (await client.callTool({
      name: "search_hadith",
      arguments: {
        query,
        language: "both",
        limit: 5,
        offset: 0,
      },
    })) as McpCallResult;

    if (result.isError || !isSearchHadithOutput(result.structuredContent)) {
      return {
        status: "error",
        query,
        sourceMode: "hadith-only",
        records: [],
        warnings: [
          {
            code: "hadith_mcp_unexpected_response",
            message: "Hadith MCP returned a response the product app could not normalize.",
          },
        ],
        provenanceNotes: stderrChunks.join("").trim() ? [stderrChunks.join("").trim()] : [],
      };
    }

    const records = result.structuredContent.results.map(normalizeRecord);

    return {
      status: records.length > 0 ? "ok" : "empty",
      query,
      sourceMode: "hadith-only",
      records,
      warnings: records.length > 0 ? [] : [{ code: "no_hadith_results", message: "No hadith records matched this query." }],
      provenanceNotes: result.structuredContent.provenance_notes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Hadith MCP error.";

    return {
      status: "error",
      query,
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
  } finally {
    await client.close().catch(() => undefined);
  }
}
