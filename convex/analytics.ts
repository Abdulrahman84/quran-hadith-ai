import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";

const dayMs = 24 * 60 * 60 * 1000;
const sampleLimit = 500;

export const getStats = query({
  args: { dayStart: v.number() },
  returns: v.object({
    trackedCount: v.number(),
    completedCount: v.number(),
    needsReviewCount: v.number(),
    failedCount: v.number(),
    citationCount: v.number(),
    averageSources: v.number(),
    isCapped: v.boolean(),
    sourceTotals: v.object({
      quran: v.number(),
      tafsir: v.number(),
      hadith: v.number(),
    }),
    dailyActivity: v.array(
      v.object({
        dayStart: v.number(),
        count: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const runs = await ctx.db
      .query("questionRuns")
      .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", false))
      .order("desc")
      .take(sampleLimit);

    const activityStart = args.dayStart - dayMs * 6;
    const dailyActivity = Array.from({ length: 7 }, (_, index) => ({
      dayStart: activityStart + index * dayMs,
      count: 0,
    }));

    let completedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    let citationCount = 0;
    let totalSources = 0;
    let quran = 0;
    let tafsir = 0;
    let hadith = 0;

    for (const run of runs) {
      if (run.status === "completed") completedCount += 1;
      if (run.status === "needs_review") needsReviewCount += 1;
      if (run.status === "failed") failedCount += 1;
      citationCount += run.citationCount;
      totalSources += run.sourceCount;
      quran += run.quranCount;
      tafsir += run.tafsirCount;
      hadith += run.hadithCount;

      const bucket = Math.floor((run.occurredAt - activityStart) / dayMs);
      if (bucket >= 0 && bucket < dailyActivity.length) {
        dailyActivity[bucket].count += 1;
      }
    }

    return {
      trackedCount: runs.length,
      completedCount,
      needsReviewCount,
      failedCount,
      citationCount,
      averageSources: runs.length === 0 ? 0 : Math.round((totalSources / runs.length) * 10) / 10,
      isCapped: runs.length === sampleLimit,
      sourceTotals: { quran, tafsir, hadith },
      dailyActivity,
    };
  },
});
