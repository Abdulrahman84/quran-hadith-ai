export type DashboardStatus = "all" | "completed" | "needs_review" | "failed";
export type DashboardPaginationStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

export type DashboardStats = {
  trackedCount: number;
  completedCount: number;
  needsReviewCount: number;
  failedCount: number;
  citationCount: number;
  averageSources: number;
  workflowTotals: {
    general: number;
    check: number;
  };
  checkTotals: {
    ayah: number;
    hadith: number;
    classified: number;
    unclassified: number;
    exact: number;
    similar: number;
    notFound: number;
  };
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
  runKind: "general" | "check";
  checkType: "ayah" | "hadith" | null;
  checkOutcome: "exact" | "similar" | "not_found" | null;
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
};
