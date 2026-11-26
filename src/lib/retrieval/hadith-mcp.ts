import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

import type { HadithCollectionSelection } from "./hadith-collections";
import { planHadithRetrievalQueries, type HadithQueryPlan } from "./hadith-query-planner";
import type { QuestionRewrite } from "./question-rewrite";
import type { SharedQueryEmbedding } from "./query-embedding";
import { rerankHadithRecords, type HadithRerankCandidate } from "./hadith-reranker";
import { fuseHadithRankings, getHadithSearchMode, hadithMcpEmbeddingEnv } from "./hadith-hybrid";
import { formatMcpStderr } from "./mcp-error";
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

type SemanticSearchHadithOutput = SearchHadithOutput & {
  mode?: string;
  /** "caller" when the search used our query_embedding. Hadith MCP builds without query_embedding omit it. */
  query_embedding_source?: string | null;
};

type SearchAttempt = {
  output: SearchHadithOutput;
  query: string;
};

/**
 * The query vector sent with a semantic search: `sent` when one went with the call, otherwise why
 * not (null when there was no shared embedding for this text, so the Hadith MCP embeds it as before).
 */
type QueryVectorArgs =
  | { sent: true; args: { query_embedding: number[]; query_embedding_model: string } }
  | { sent: false; failure: string | null };

type SemanticAttempt =
  | { attempt: SearchAttempt; mode: string; vector: QueryVectorArgs; vectorSource: string | null }
  | { attempt: null; reason: string };

const HADITH_SEARCH_LIMIT = 12;
const HADITH_RESULT_LIMIT = 5;

type HadithMcpConfig = { command: string; cliPath: string; dbPath: string; cwd: string };

function getHadithMcpConfig(): { config: HadithMcpConfig; missing: [] } | { config: null; missing: string[] } {
  const command = process.env.HADITH_MCP_COMMAND?.trim() || "node";
  const cliPath = process.env.HADITH_MCP_CLI_PATH?.trim() ?? "";
  const dbPath = process.env.HADITH_MCP_DB_PATH?.trim() ?? "";
  const cwd = process.env.HADITH_MCP_CWD?.trim() ?? "";
  const missing = [
    ...(cliPath ? [] : ["HADITH_MCP_CLI_PATH"]),
    ...(dbPath ? [] : ["HADITH_MCP_DB_PATH"]),
    ...(cwd ? [] : ["HADITH_MCP_CWD"]),
  ];

  if (missing.length > 0) {
    return { config: null, missing };
  }

  return { config: { command, cliPath, dbPath, cwd }, missing: [] };
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

async function callSearchHadith(
  client: Client,
  query: string,
  language: RetrievalLanguage,
  collection: HadithCollectionSelection,
): Promise<SearchAttempt | null> {
  const result = (await client.callTool({
    name: "search_hadith",
    arguments: {
      query,
      ...(collection === "all" ? {} : { collection }),
      language,
      limit: HADITH_SEARCH_LIMIT,
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

/**
 * Waits for the shared embedding of `text`. A failed embedding sends no vector, so the Hadith MCP
 * embeds the text itself, as it did before the embedding was shared.
 */
async function queryVectorArgs(queryEmbedding: SharedQueryEmbedding | null | undefined, text: string): Promise<QueryVectorArgs> {
  const pending = queryEmbedding?.vectorFor(text);

  if (!queryEmbedding || !pending) {
    return { sent: false, failure: null };
  }

  const embedded = await pending;

  return embedded.ok
    ? { sent: true, args: { query_embedding: Array.from(embedded.vector), query_embedding_model: queryEmbedding.model } }
    : { sent: false, failure: embedded.reason };
}

async function callSemanticSearchHadith(
  client: Client,
  query: string,
  language: RetrievalLanguage,
  collection: HadithCollectionSelection,
  vector: QueryVectorArgs = { sent: false, failure: null },
): Promise<SemanticAttempt> {
  try {
    const result = (await client.callTool({
      name: "semantic_search_hadith",
      arguments: {
        query,
        ...(collection === "all" ? {} : { collection }),
        language,
        limit: HADITH_SEARCH_LIMIT,
        offset: 0,
        mode: "hybrid",
        // Hadith MCP builds without query_embedding drop unknown arguments and embed the query themselves.
        ...(vector.sent ? vector.args : {}),
      },
    })) as McpCallResult;
    const payload = getMcpPayload(result);

    if (result.isError || !isSearchHadithOutput(payload)) {
      // A server that refuses the vector itself still gets to embed the query.
      if (vector.sent) {
        return callSemanticSearchHadith(client, query, language, collection, {
          sent: false,
          failure: "the Hadith MCP refused the query_embedding argument",
        });
      }

      return { attempt: null, reason: "semantic_search_hadith returned an error or an unexpected payload" };
    }

    const output = payload as SemanticSearchHadithOutput;

    return {
      attempt: { output, query },
      mode: typeof output.mode === "string" ? output.mode : "unknown",
      vector,
      vectorSource: typeof output.query_embedding_source === "string" ? output.query_embedding_source : null,
    };
  } catch (error) {
    // Older Hadith MCP builds do not have the tool; lexical search still runs.
    return { attempt: null, reason: error instanceof Error ? error.message : "semantic_search_hadith failed" };
  }
}

/** Says whether the Hadith MCP searched with the shared question embedding or embedded the text itself. */
function queryVectorNote(semantic: SemanticAttempt, label: string) {
  if (semantic.attempt === null || semantic.mode === "fts_fallback") {
    return [];
  }

  const { vector, vectorSource } = semantic;

  if (vector.sent && vectorSource === "caller") {
    return [`Hadith semantic search (${label}) used the app's shared query embedding; the Hadith MCP made no embedding call.`];
  }

  if (vector.sent) {
    const reason = semantic.attempt.output.provenance_notes.find((note) => note.startsWith("Ignored the caller's query_embedding"));
    return [
      vectorSource === "server"
        ? `Hadith MCP did not use the app's query embedding (${label}) and embedded it itself.${reason ? ` ${reason}` : ""}`
        : `Hadith MCP ignored the app's query embedding (${label}), as builds without query_embedding do, and embedded it itself.`,
    ];
  }

  return vector.failure ? [`The app's query embedding (${label}) was not used (${vector.failure.slice(0, 200)}); the Hadith MCP embedded it itself.`] : [];
}

function semanticProvenanceNote(semantic: SemanticAttempt | null) {
  if (semantic === null) {
    return [];
  }

  if (semantic.attempt === null) {
    return [`Hadith semantic search unavailable, used lexical search only: ${semantic.reason.slice(0, 200)}`];
  }

  if (semantic.mode === "fts_fallback") {
    const reason = semantic.attempt.output.provenance_notes.find((note) => note.startsWith("Semantic search unavailable"));
    return [`Hadith semantic search fell back to full-text on the Hadith MCP side.${reason ? ` ${reason}` : ""}`];
  }

  return [`Hadith semantic search: ${semantic.mode} (full-text + embedding similarity) for the original question.`];
}

function candidateKey(record: SourceRecord) {
  return `${record.collection}:${record.hadithNumber || record.reference}`;
}

function addSearchAttemptCandidates(
  candidates: Map<string, HadithRerankCandidate>,
  attempt: SearchAttempt,
  searchOrder: number,
) {
  attempt.output.results.forEach((result) => {
    const record = normalizeRecord(result);
    const key = candidateKey(record);
    const existing = candidates.get(key);

    if (!existing) {
      candidates.set(key, {
        record,
        searchQueries: [attempt.query],
        bestSearchRank: result.rank,
        firstSearchOrder: searchOrder,
      });
      return;
    }

    if (!existing.searchQueries.includes(attempt.query)) {
      existing.searchQueries.push(attempt.query);
    }

    existing.bestSearchRank = Math.min(existing.bestSearchRank, result.rank);
    existing.firstSearchOrder = Math.min(existing.firstSearchOrder, searchOrder);
  });
}

/**
 * Starts the AI hadith query plan. The source router calls this while it is still deciding
 * which sources to search, so the planner's model call overlaps the routing call.
 */
export function startHadithQueryPlan(query: string, language: RetrievalLanguage): Promise<HadithQueryPlan> {
  const plan = planHadithRetrievalQueries(query, language, planRetrievalQuery(query, language).retrievalQuery);
  // If hadith ends up not being searched, nobody awaits this; keep a rejection from going unhandled.
  plan.catch(() => undefined);
  return plan;
}

export async function searchHadithSources(
  query: string,
  language: RetrievalLanguage,
  options: {
    collection?: HadithCollectionSelection;
    queryPlan?: Promise<HadithQueryPlan>;
    questionRewrite?: Promise<QuestionRewrite>;
    /** The search's shared question embedding; without one the Hadith MCP embeds the question itself. */
    queryEmbedding?: SharedQueryEmbedding | null;
  } = {},
): Promise<RetrievalResponse> {
  const planned = planRetrievalQuery(query, language);
  const collection = options.collection ?? "all";
  const searchMode = getHadithSearchMode();
  const { config, missing } = getHadithMcpConfig();

  if (!config) {
    return {
      status: "error",
      query,
      retrievalQuery: planned.retrievalQuery,
      sourceMode: "hadith-only",
      records: [],
      warnings: [
        {
          code: "hadith_mcp_not_configured",
          message: `Hadith MCP is not configured. Set ${missing.join(", ")}.`,
        },
      ],
      provenanceNotes: [],
    };
  }

  try {
    return await withStdioMcpClient(
      {
        command: config.command,
        args: [config.cliPath],
        cwd: config.cwd,
        env: {
          HADITH_MCP_DB_PATH: config.dbPath,
          ...(searchMode === "hybrid" ? hadithMcpEmbeddingEnv() : {}),
        },
      },
      async ({ client, stderr }) => {
        const startedAt = Date.now();
        const candidates = new Map<string, HadithRerankCandidate>();
        const successfulQueries: string[] = [];
        // The semantic call searches the user's own question, which suits embeddings better than the
        // planner's keyword queries, and it doesn't need the plan, so it starts before the plan is ready.
        // It sends the search's shared question embedding, so the Hadith MCP doesn't embed it again.
        let semanticMs = 0;
        const semanticSearch =
          searchMode === "hybrid"
            ? queryVectorArgs(options.queryEmbedding, query)
                .then((vector) => callSemanticSearchHadith(client, query, language, collection, vector))
                .finally(() => {
                  semanticMs = Date.now() - startedAt;
                })
            : Promise.resolve(null);
        // Dialect and Arabizi embed poorly, so the Fusha rewrite gets a second semantic search.
        // The user's own wording is kept too: a natural question embeds better than a terse topic.
        // The rewrite's vector is shared only when it was ready in time to join the question's request.
        let rewrittenQuery: string | null = null;
        const rewriteSemanticSearch =
          searchMode === "hybrid" && options.questionRewrite
            ? options.questionRewrite.then(async (rewrite) => {
                rewrittenQuery = rewrite.fusha;
                return rewrite.fusha
                  ? callSemanticSearchHadith(client, rewrite.fusha, language, collection, await queryVectorArgs(options.queryEmbedding, rewrite.fusha))
                  : null;
              })
            : Promise.resolve(null);
        const hadithQueryPlan = await (options.queryPlan ?? planHadithRetrievalQueries(query, language, planned.retrievalQuery));
        const planReadyMs = Date.now() - startedAt;
        let lexicalMs = 0;
        const collectAttempts = (attempts: Array<SearchAttempt | null>, firstSearchOrder: number) => {
          attempts.forEach((attempt, index) => {
            if (attempt) {
              successfulQueries.push(attempt.query);
              addSearchAttemptCandidates(candidates, attempt, firstSearchOrder + index);
            }
          });
        };

        const [semantic, lexicalAttempts] = await Promise.all([
          semanticSearch,
          Promise.all(
            hadithQueryPlan.queries.map((searchQuery) => callSearchHadith(client, searchQuery, language, collection)),
          ).finally(() => {
            lexicalMs = Date.now() - startedAt - planReadyMs;
          }),
        ]);

        collectAttempts(lexicalAttempts, 0);

        if (candidates.size === 0) {
          const fallbackQueries = splitFallbackQueries(query, language).filter(
            (fallbackQuery) => fallbackQuery !== planned.retrievalQuery,
          );

          collectAttempts(
            await Promise.all(
              fallbackQueries.map((fallbackQuery) => callSearchHadith(client, fallbackQuery, language, collection)),
            ),
            hadithQueryPlan.queries.length,
          );
        }

        const rewriteSemantic = await rewriteSemanticSearch;
        const semanticRecords = semantic?.attempt ? semantic.attempt.output.results.map(normalizeRecord) : [];
        const rewriteSemanticRecords = rewriteSemantic?.attempt ? rewriteSemantic.attempt.output.results.map(normalizeRecord) : [];

        if (successfulQueries.length === 0 && !semantic?.attempt && !rewriteSemantic?.attempt) {
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
            provenanceNotes: [
              ...semanticProvenanceNote(semantic),
              ...(formatMcpStderr(stderr) ? [formatMcpStderr(stderr)] : []),
            ],
          };
        }

        const rankStartedAt = Date.now();
        const lexicalRecords = rerankHadithRecords([...candidates.values()], query, language);
        // The lexical reranker scores planner-phrase overlap, which would bury semantic matches
        // worded differently from the planned queries, so the two rankings are fused instead.
        const records = (
          semantic?.attempt || rewriteSemantic?.attempt
            ? fuseHadithRankings([semanticRecords, rewriteSemanticRecords, lexicalRecords].filter((list) => list.length > 0))
            : lexicalRecords
        ).slice(0, HADITH_RESULT_LIMIT);

        return {
          status: records.length > 0 ? "ok" : "empty",
          query,
          retrievalQuery: successfulQueries.slice(0, 5).join(" | ") || planned.retrievalQuery,
          sourceMode: "hadith-only",
          records,
          warnings: records.length > 0 ? [] : [{ code: "no_hadith_results", message: "No hadith records matched this query." }],
          provenanceNotes: [
            `Hadith candidates collected: ${candidates.size}${semantic?.attempt ? ` lexical + ${semanticRecords.length} semantic` : ""}.`,
            `Hadith retrieval budget: up to ${hadithQueryPlan.queries.length} queries with ${HADITH_SEARCH_LIMIT} candidates each.`,
            "Hadith reranker: matn-aware lexical rerank.",
            ...semanticProvenanceNote(semantic),
            ...(semantic ? queryVectorNote(semantic, "question") : []),
            ...(semantic?.attempt ? ["Hadith ranking: reciprocal rank fusion (k=60) of the semantic and reranked lexical lists."] : []),
            ...(collection === "all" ? [] : [`Hadith collection filter: ${collection}.`]),
            `Hadith query planner: ${hadithQueryPlan.planner}.`,
            ...(rewriteSemantic?.attempt && rewrittenQuery
              ? [`Hadith semantic search also ran on the rewritten question: ${rewrittenQuery} (${rewriteSemanticRecords.length} results).`]
              : []),
            ...(rewriteSemantic ? queryVectorNote(rewriteSemantic, "rewrite") : []),
            `Timing (hadith): plan ready at ${planReadyMs} ms, ${hadithQueryPlan.queries.length} lexical queries ${lexicalMs} ms${
              semantic ? `, semantic done at ${semanticMs} ms` : ""
            }, rank ${Date.now() - rankStartedAt} ms, total ${Date.now() - startedAt} ms.`,
            ...(hadithQueryPlan.warning ? [`Hadith query planner warning: ${hadithQueryPlan.warning}`] : []),
            ...(planned.changed || successfulQueries.some((searchQuery) => searchQuery !== query)
              ? [`Product query planner searched Hadith MCP for: ${successfulQueries.slice(0, 5).join(" | ")}`]
              : []),
          ],
        };
      },
    );
  } catch (error) {
    // withStdioMcpClient already appends the server's recent stderr to the error message.
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
      provenanceNotes: [],
    };
  }
}
