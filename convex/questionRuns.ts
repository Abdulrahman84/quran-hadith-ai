import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const statusValidator = v.union(
  v.literal("completed"),
  v.literal("needs_review"),
  v.literal("failed"),
);

const exampleStatusValidator = v.union(
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
  isDemo: v.boolean(),
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
    isDemo: run.isDemo,
  };
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

export const listRecent = query({
  args: {
    limit: v.number(),
    scope: v.union(v.literal("all"), v.literal("live"), v.literal("demo")),
    status: exampleStatusValidator,
  },
  returns: v.array(questionRunResult),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail) {
      throw new Error("Administrator access required.");
    }

    const limit = Math.min(Math.max(Math.floor(args.limit), 1), 20);

    if (args.scope === "all") {
      if (args.status === "all") {
        const runs = await ctx.db
          .query("questionRuns")
          .withIndex("by_occurred_at")
          .order("desc")
          .take(limit);

        return runs.map(presentRun);
      }

      const selectedStatus = args.status;

      const runs = await ctx.db
        .query("questionRuns")
        .withIndex("by_status_and_occurred_at", (q) => q.eq("status", selectedStatus))
        .order("desc")
        .take(limit);

      return runs.map(presentRun);
    }

    const isDemo = args.scope === "demo";

    if (args.status === "all") {
      const runs = await ctx.db
        .query("questionRuns")
        .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", isDemo))
        .order("desc")
        .take(limit);

      return runs.map(presentRun);
    }

    const selectedStatus = args.status;

    const runs = await ctx.db
      .query("questionRuns")
      .withIndex("by_is_demo_status_and_occurred_at", (q) =>
        q.eq("isDemo", isDemo).eq("status", selectedStatus),
      )
      .order("desc")
      .take(limit);

    return runs.map(presentRun);
  },
});
