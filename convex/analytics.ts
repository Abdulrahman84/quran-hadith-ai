import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { query } from "./_generated/server";

const dayMs = 24 * 60 * 60 * 1000;
const sampleLimit = 500;

const scopeValidator = v.union(v.literal("all"), v.literal("live"), v.literal("demo"));

export const getStats = query({
  args: { scope: scopeValidator },
  returns: v.object({
    trackedCount: v.number(),
    completedCount: v.number(),
    needsReviewCount: v.number(),
    failedCount: v.number(),
    citationCount: v.number(),
    averageSources: v.number(),
    demoCount: v.number(),
    liveCount: v.number(),
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
    const userId = await getAuthUserId(ctx);
    const user = userId ? await ctx.db.get(userId) : null;
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

    if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail) {
      throw new Error("Administrator access required.");
    }

    const runs = args.scope === "all"
      ? await ctx.db.query("questionRuns").withIndex("by_occurred_at").order("desc").take(sampleLimit)
      : await ctx.db
          .query("questionRuns")
          .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", args.scope === "demo"))
          .order("desc")
          .take(sampleLimit);

    const dayStart = Math.floor(Date.now() / dayMs) * dayMs;
    const activityStart = dayStart - dayMs * 6;
    const dailyActivity = Array.from({ length: 7 }, (_, index) => ({
      dayStart: activityStart + index * dayMs,
      count: 0,
    }));

    let completedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    let citationCount = 0;
    let totalSources = 0;
    let demoCount = 0;
    let quran = 0;
    let tafsir = 0;
    let hadith = 0;

    for (const run of runs) {
      if (run.status === "completed") completedCount += 1;
      if (run.status === "needs_review") needsReviewCount += 1;
      if (run.status === "failed") failedCount += 1;
      if (run.isDemo) demoCount += 1;

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
      demoCount,
      liveCount: runs.length - demoCount,
      isCapped: runs.length === sampleLimit,
      sourceTotals: { quran, tafsir, hadith },
      dailyActivity,
    };
  },
});
