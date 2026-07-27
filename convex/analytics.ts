import { v } from "convex/values";

import { query } from "./_generated/server";
import { requireAdmin } from "./lib/admin";
import { getRunStats } from "./runStats";

export const getStats = query({
  args: { dayStart: v.number() },
  returns: v.object({
    trackedCount: v.number(),
    completedCount: v.number(),
    needsReviewCount: v.number(),
    failedCount: v.number(),
    citationCount: v.number(),
    averageSources: v.number(),
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
    return await getRunStats(ctx, args.dayStart);
  },
});
