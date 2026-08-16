import type { Language, TranslationKey } from "@/lib/i18n";

import { StatCard } from "./stat-card";
import type { DashboardStats } from "./types";

type StatsGridProps = {
  language: Language;
  stats: DashboardStats;
  t: (key: TranslationKey) => string;
};

export function StatsGrid({ language, stats, t }: StatsGridProps) {
  const number = new Intl.NumberFormat(language === "ar" ? "ar" : "en");
  const cards = [
    {
      label: t("dashboard.stat.questions"),
      value: number.format(stats.trackedCount),
      note: t("dashboard.stat.allTime"),
    },
    {
      label: t("dashboard.stat.general"),
      value: number.format(stats.workflowTotals.general),
      note: t("dashboard.stat.generalNote"),
    },
    {
      label: t("dashboard.stat.checks"),
      value: number.format(stats.workflowTotals.check),
      note: t("dashboard.stat.checksNote"),
    },
    {
      label: t("dashboard.stat.completed"),
      value: number.format(stats.completedCount),
      note: `${number.format(stats.needsReviewCount)} ${t("dashboard.stat.withWarnings")}`,
    },
    {
      label: t("dashboard.stat.citations"),
      value: number.format(stats.citationCount),
      note: t("dashboard.stat.citationsNote"),
    },
    {
      label: t("dashboard.stat.averageSources"),
      value: number.format(stats.averageSources),
      note: t("dashboard.stat.averageSourcesNote"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => <StatCard key={card.label} {...card} />)}
    </div>
  );
}
