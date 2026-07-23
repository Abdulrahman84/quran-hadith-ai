export type DashboardScope = "all" | "live" | "demo";
export type DashboardStatus = "all" | "completed" | "needs_review" | "failed";

export type DashboardStats = {
  trackedCount: number;
  completedCount: number;
  needsReviewCount: number;
  failedCount: number;
  citationCount: number;
  averageSources: number;
  demoCount: number;
  liveCount: number;
  isCapped: boolean;
  sourceTotals: {
    quran: number;
    tafsir: number;
    hadith: number;
  };
  dailyActivity: Array<{
    dayStart: number;
    count: number;
  }>;
};

export type DashboardRun = {
  _id: string;
  question: string;
  language: "arabic" | "english";
  status: Exclude<DashboardStatus, "all">;
  answerText: string | null;
  citationCount: number;
  sourceCount: number;
  quranCount: number;
  tafsirCount: number;
  hadithCount: number;
  warningCount: number;
  durationMs: number;
  occurredAt: number;
  isDemo: boolean;
};
