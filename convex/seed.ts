import { v } from "convex/values";

import { internalMutation } from "./_generated/server";

const dayMs = 24 * 60 * 60 * 1000;

const examples = [
  {
    question: "ما معنى حديث إنما الأعمال بالنيات؟",
    language: "arabic" as const,
    status: "completed" as const,
    answerText: "يبين الحديث أن قيمة العمل وقبوله مرتبطان بالنية، وقد استندت الخلاصة إلى نص الحديث وشرحه في المصادر المسترجعة.",
    citationCount: 3,
    quranCount: 0,
    tafsirCount: 0,
    hadithCount: 3,
    warningCount: 0,
    durationMs: 1840,
    daysAgo: 0,
  },
  {
    question: "What do the sources say about mercy?",
    language: "english" as const,
    status: "completed" as const,
    answerText: "The retrieved records connect mercy with conduct toward others and show the source text beside the summary for review.",
    citationCount: 5,
    quranCount: 2,
    tafsirCount: 1,
    hadithCount: 2,
    warningCount: 0,
    durationMs: 2360,
    daysAgo: 0,
  },
  {
    question: "ما الأدلة المسترجعة عن بر الوالدين؟",
    language: "arabic" as const,
    status: "completed" as const,
    answerText: "جمعت النتيجة بين الآيات المسترجعة من سورة الإسراء وشرحها، مع إبقاء المراجع والنصوص ظاهرة للمراجعة.",
    citationCount: 4,
    quranCount: 2,
    tafsirCount: 2,
    hadithCount: 0,
    warningCount: 0,
    durationMs: 2110,
    daysAgo: 1,
  },
  {
    question: "Show sourced guidance about patience during hardship",
    language: "english" as const,
    status: "completed" as const,
    answerText: "The answer links patience with prayer and reliance on God, using the retrieved Quran and tafsir records without adding unsupported claims.",
    citationCount: 4,
    quranCount: 2,
    tafsirCount: 2,
    hadithCount: 0,
    warningCount: 0,
    durationMs: 1980,
    daysAgo: 2,
  },
  {
    question: "ماذا تقول المصادر عن الإخلاص في العبادة؟",
    language: "arabic" as const,
    status: "completed" as const,
    answerText: "تعرض الخلاصة النصوص المسترجعة التي تربط العبادة بالإخلاص، وتفصل بين نص المصدر وصياغة الإجابة.",
    citationCount: 3,
    quranCount: 1,
    tafsirCount: 1,
    hadithCount: 1,
    warningCount: 0,
    durationMs: 2250,
    daysAgo: 3,
  },
  {
    question: "Find evidence about maintaining prayer",
    language: "english" as const,
    status: "completed" as const,
    answerText: "The result summarizes the retrieved evidence and keeps each Quran and hadith reference available beside the answer.",
    citationCount: 6,
    quranCount: 2,
    tafsirCount: 1,
    hadithCount: 3,
    warningCount: 0,
    durationMs: 2710,
    daysAgo: 4,
  },
  {
    question: "هل توجد رواية مطابقة بهذه الصياغة؟",
    language: "arabic" as const,
    status: "needs_review" as const,
    answerText: "عُثر على نتائج قريبة، لكن الصياغة المطابقة لم تثبت في السجلات المسترجعة؛ لذلك ظهرت النتيجة مع تنبيه للمراجعة.",
    citationCount: 2,
    quranCount: 0,
    tafsirCount: 0,
    hadithCount: 2,
    warningCount: 1,
    durationMs: 1640,
    daysAgo: 5,
  },
  {
    question: "Search an unavailable source collection",
    language: "english" as const,
    status: "failed" as const,
    answerText: null,
    citationCount: 0,
    quranCount: 0,
    tafsirCount: 0,
    hadithCount: 0,
    warningCount: 1,
    durationMs: 820,
    daysAgo: 6,
  },
];

export const demo = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const existingDemo = await ctx.db
      .query("questionRuns")
      .withIndex("by_is_demo_and_occurred_at", (q) => q.eq("isDemo", true))
      .take(1);

    if (existingDemo.length > 0) return 0;

    const now = Date.now();
    for (const [index, example] of examples.entries()) {
      const { daysAgo, ...run } = example;
      await ctx.db.insert("questionRuns", {
        ...run,
        runId: `demo-${index + 1}`,
        sourceCount: run.quranCount + run.tafsirCount + run.hadithCount,
        occurredAt: now - daysAgo * dayMs - index * 17 * 60 * 1000,
        isDemo: true,
      });
    }

    return examples.length;
  },
});
