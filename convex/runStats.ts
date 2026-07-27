import { DirectAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const dayMs = 24 * 60 * 60 * 1000;
type Metric =
  | "status:completed"
  | "status:needs_review"
  | "status:failed"
  | "citations"
  | "quran"
  | "tafsir"
  | "hadith"
  | "daily";

const runStats = new DirectAggregate<{
  Namespace: Metric;
  Key: number;
  Id: string;
}>(components.questionRunStats);

type RunStatPoint = {
  namespace: Metric;
  key: number;
  id: string;
  sumValue: number;
};

function point(run: Doc<"questionRuns">, namespace: Metric, key: number, sumValue: number): RunStatPoint {
  return {
    namespace,
    key,
    id: run._id,
    sumValue,
  };
}

function pointsForRun(run: Doc<"questionRuns">) {
  if (run.isDemo) return [];

  const dayStart = Math.floor(run.occurredAt / dayMs) * dayMs;
  return [
    point(run, `status:${run.status}`, 0, 1),
    point(run, "citations", 0, run.citationCount),
    point(run, "quran", 0, run.quranCount),
    point(run, "tafsir", 0, run.tafsirCount),
    point(run, "hadith", 0, run.hadithCount),
    point(run, "daily", dayStart, 1),
  ];
}

export async function addRunToStats(ctx: MutationCtx, run: Doc<"questionRuns">) {
  for (const stat of pointsForRun(run)) {
    await runStats.replaceOrInsert(ctx, stat, stat);
  }
}

export async function removeRunFromStats(ctx: MutationCtx, run: Doc<"questionRuns">) {
  for (const stat of pointsForRun(run)) {
    await runStats.deleteIfExists(ctx, stat);
  }
}

function exact(namespace: Metric, key = 0) {
  return { namespace, bounds: { eq: key } };
}

export async function getRunStats(ctx: QueryCtx, dayStart: number) {
  const dailyStarts = Array.from({ length: 7 }, (_, index) => dayStart - dayMs * (6 - index));
  const totals = await runStats.sumBatch(ctx, [
    exact("status:completed"),
    exact("status:needs_review"),
    exact("status:failed"),
    exact("citations"),
    exact("quran"),
    exact("tafsir"),
    exact("hadith"),
    ...dailyStarts.map((start) => exact("daily", start)),
  ]);

  const [completedCount, needsReviewCount, failedCount, citationCount, quran, tafsir, hadith] = totals;
  const trackedCount = completedCount + needsReviewCount + failedCount;
  const totalSources = quran + tafsir + hadith;
  const dailyCounts = totals.slice(7);

  return {
    trackedCount,
    completedCount,
    needsReviewCount,
    failedCount,
    citationCount,
    averageSources: trackedCount === 0 ? 0 : Math.round((totalSources / trackedCount) * 10) / 10,
    sourceTotals: { quran, tafsir, hadith },
    dailyActivity: dailyStarts.map((start, index) => ({ dayStart: start, count: dailyCounts[index] })),
  };
}

export const backfill = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    const result = await ctx.db
      .query("questionRuns")
      .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", false))
      .paginate({ cursor: args.cursor ?? null, numItems: 10 });

    for (const run of result.page) {
      await addRunToStats(ctx, run);
    }

    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.runStats.backfill, { cursor: result.continueCursor });
    }

    return result.page.length;
  },
});

export const inspect = internalQuery({
  args: { dayStart: v.number() },
  handler: async (ctx, args) => await getRunStats(ctx, args.dayStart),
});
