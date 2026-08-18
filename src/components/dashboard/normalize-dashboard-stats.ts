import type { DashboardStats } from "./types";

type CompatibleDashboardStats = Omit<DashboardStats, "checkTotals" | "workflowTotals"> & {
  checkTotals?: DashboardStats["checkTotals"];
  workflowTotals?: DashboardStats["workflowTotals"];
};

const emptyCheckTotals: DashboardStats["checkTotals"] = {
  ayah: 0,
  hadith: 0,
  classified: 0,
  unclassified: 0,
  exact: 0,
  similar: 0,
  notFound: 0,
};

export function normalizeDashboardStats(stats: CompatibleDashboardStats): DashboardStats {
  const checkCount = stats.workflowTotals?.check ?? 0;

  return {
    ...stats,
    workflowTotals: {
      general: stats.workflowTotals?.general ?? Math.max(0, stats.trackedCount - checkCount),
      check: checkCount,
    },
    checkTotals: {
      ...emptyCheckTotals,
      ...stats.checkTotals,
    },
  };
}
