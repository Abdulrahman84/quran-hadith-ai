import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";

import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/admin";

const statusValidator = v.union(
  v.literal("completed"),
  v.literal("needs_review"),
  v.literal("failed"),
);

const filterStatusValidator = v.union(
  v.literal("all"),
  v.literal("completed"),
  v.literal("needs_review"),
  v.literal("failed"),
);

const questionRunResult = v.object({
  _id: v.id("questionRuns"),
  question: v.string(),
  language: v.union(v.literal("arabic"), v.literal("english")),
  status: statusValidator,
  answerText: v.union(v.string(), v.null()),
  citationCount: v.number(),
  sourceCount: v.number(),
  quranCount: v.number(),
  tafsirCount: v.number(),
  hadithCount: v.number(),
  warningCount: v.number(),
  durationMs: v.number(),
  occurredAt: v.number(),
});

function presentRun(run: Doc<"questionRuns">) {
  return {
    _id: run._id,
    question: run.question,
    language: run.language,
    status: run.status,
    answerText: run.answerText,
    citationCount: run.citationCount,
    sourceCount: run.sourceCount,
    quranCount: run.quranCount,
    tafsirCount: run.tafsirCount,
    hadithCount: run.hadithCount,
    warningCount: run.warningCount,
    durationMs: run.durationMs,
    occurredAt: run.occurredAt,
  };
}

function normalizeSearch(search: string) {
  return search.trim().slice(0, 200).split(/\s+/).slice(0, 16).join(" ");
}

export const recordRun = internalMutation({
  args: {
    runId: v.string(),
    question: v.string(),
    language: v.union(v.literal("arabic"), v.literal("english")),
    status: statusValidator,
    answerText: v.union(v.string(), v.null()),
    citationCount: v.number(),
    quranCount: v.number(),
    tafsirCount: v.number(),
    hadithCount: v.number(),
    warningCount: v.number(),
    durationMs: v.number(),
  },
  returns: v.id("questionRuns"),
  handler: async (ctx, args) => {
    const existingRun = await ctx.db
      .query("questionRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();

    if (existingRun) return existingRun._id;

    const sourceCount = args.quranCount + args.tafsirCount + args.hadithCount;

    return await ctx.db.insert("questionRuns", {
      ...args,
      sourceCount,
      occurredAt: Date.now(),
      isDemo: false,
    });
  },
});

export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.string(),
    status: filterStatusValidator,
  },
  returns: paginationResultValidator(questionRunResult),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const search = normalizeSearch(args.search);
    let result;

    if (search.length > 0) {
      const selectedStatus = args.status;
      result = await ctx.db
        .query("questionRuns")
        .withSearchIndex("search_question", (q) => {
          const liveSearch = q.search("question", search).eq("isDemo", false);
          return selectedStatus === "all" ? liveSearch : liveSearch.eq("status", selectedStatus);
        })
        .paginate(args.paginationOpts);
    } else if (args.status === "all") {
      result = await ctx.db
        .query("questionRuns")
        .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", false))
        .order("desc")
        .paginate(args.paginationOpts);
    } else {
      const selectedStatus = args.status;
      result = await ctx.db
        .query("questionRuns")
        .withIndex("by_is_demo_status_and_occurred_at", (q) =>
          q.eq("isDemo", false).eq("status", selectedStatus),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return { ...result, page: result.page.map(presentRun) };
  },
});

export const removeDemoRuns = internalMutation({
  args: {},
  returns: v.object({
    deletedCount: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx) => {
    const demoRuns = await ctx.db
      .query("questionRuns")
      .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", true))
      .take(500);

    await Promise.all(demoRuns.map((run) => ctx.db.delete(run._id)));

    return {
      deletedCount: demoRuns.length,
      hasMore: demoRuns.length === 500,
    };
  },
});
