import { v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";

import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin } from "./lib/admin";
import { addRunToStats } from "./runStats";

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

const runKindValidator = v.union(v.literal("general"), v.literal("check"));
const checkTypeValidator = v.union(v.literal("ayah"), v.literal("hadith"));
const checkOutcomeValidator = v.union(
  v.literal("exact"),
  v.literal("similar"),
  v.literal("not_found"),
);

const questionRunResult = v.object({
  _id: v.id("questionRuns"),
  question: v.string(),
  language: v.union(v.literal("arabic"), v.literal("english")),
  runKind: runKindValidator,
  checkType: v.union(checkTypeValidator, v.null()),
  checkOutcome: v.union(checkOutcomeValidator, v.null()),
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
    runKind: run.runKind ?? "general",
    checkType: run.checkType ?? null,
    checkOutcome: run.checkOutcome ?? null,
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
    runKind: v.optional(runKindValidator),
    checkType: v.optional(checkTypeValidator),
    checkOutcome: v.optional(checkOutcomeValidator),
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
    const runKind = args.runKind ?? "general";

    if (runKind === "general" && (args.checkType || args.checkOutcome)) {
      throw new Error("General runs cannot include Check metadata.");
    }

    if (runKind === "check" && !args.checkType) {
      throw new Error("Check runs require a Check type.");
    }

    if (runKind === "check" && args.status !== "failed" && !args.checkOutcome) {
      throw new Error("Successful Check runs require a Check outcome.");
    }

    if (runKind === "check" && args.status === "failed" && args.checkOutcome) {
      throw new Error("Failed Check runs cannot include a Check outcome.");
    }

    const existingRun = await ctx.db
      .query("questionRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", args.runId))
      .unique();

    if (existingRun) {
      const existingKind = existingRun.runKind ?? "general";
      if (
        existingKind !== runKind
        || existingRun.checkType !== args.checkType
        || existingRun.checkOutcome !== args.checkOutcome
      ) {
        throw new Error("A run with this ID already exists with different analytics metadata.");
      }
      await addRunToStats(ctx, existingRun);
      return existingRun._id;
    }

    const sourceCount = args.quranCount + args.tafsirCount + args.hadithCount;

    const runId = await ctx.db.insert("questionRuns", {
      runId: args.runId,
      question: args.question,
      language: args.language,
      runKind,
      ...(args.checkType ? { checkType: args.checkType } : {}),
      ...(args.checkOutcome ? { checkOutcome: args.checkOutcome } : {}),
      status: args.status,
      answerText: args.answerText,
      citationCount: args.citationCount,
      quranCount: args.quranCount,
      tafsirCount: args.tafsirCount,
      hadithCount: args.hadithCount,
      warningCount: args.warningCount,
      durationMs: args.durationMs,
      sourceCount,
      occurredAt: Date.now(),
      isDemo: false,
    });
    const run = await ctx.db.get(runId);
    await addRunToStats(ctx, run!);
    return runId;
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
