"use client";

import { usePaginatedQuery, useQuery } from "convex/react";
import { useState } from "react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";

import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/components/i18n-provider";

import { ActivityChart } from "./activity-chart";
import { AdminSignIn } from "./admin-sign-in";
import { DashboardHeader } from "./dashboard-header";
import { QuestionResults } from "./question-results";
import { SourceMix } from "./source-mix";
import { StatsGrid } from "./stats-grid";
import type { DashboardPaginationStatus, DashboardStatus } from "./types";
import { useDebouncedValue } from "./use-debounced-value";

const dayMs = 24 * 60 * 60 * 1000;

export function DashboardShell() {
  const { language, t } = useI18n();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [dayStart] = useState(() => Math.floor(Date.now() / dayMs) * dayMs);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<DashboardStatus>("all");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const stats = useQuery(api.analytics.getStats, isAuthenticated ? { dayStart } : "skip");
  const runs = usePaginatedQuery(
    api.questionRuns.listPaginated,
    isAuthenticated ? { search: debouncedSearch, status } : "skip",
    { initialNumItems: 12 },
  );
  const sortedRuns = [...runs.results].sort((left, right) => right.occurredAt - left.occurredAt);

  if (isLoading) {
    return <div className="relative z-10 mx-auto mt-24 h-44 w-full max-w-lg animate-pulse rounded-2xl border-t-4 border-t-[var(--color-gold)] bg-[var(--color-gold-soft)]" aria-label={t("dashboard.loading")} />;
  }

  if (!isAuthenticated) return <AdminSignIn t={t} />;

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16">
      <DashboardHeader onSignOut={() => void signOut()} t={t} />

      <div className="mt-8">
        {stats === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("dashboard.loading")}>
            {[0, 1, 2, 3].map((item) => <div className="h-40 animate-pulse rounded-2xl border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-gold-soft)]" key={item} />)}
          </div>
        ) : (
          <StatsGrid language={language} stats={stats} t={t} />
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        {stats === undefined ? (
          <>
            <div className="h-72 animate-pulse rounded-2xl border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-gold-soft)]" />
            <div className="h-72 animate-pulse rounded-2xl border-t-[3px] border-t-[var(--color-gold)] bg-[var(--color-gold-soft)]" />
          </>
        ) : (
          <>
            <ActivityChart activity={stats.dailyActivity} language={language} t={t} />
            <SourceMix language={language} sources={stats.sourceTotals} t={t} />
          </>
        )}
      </div>

      <div className="mt-4">
        <QuestionResults
          language={language}
          loadMore={() => runs.loadMore(12)}
          paginationStatus={runs.status as DashboardPaginationStatus}
          runs={sortedRuns}
          search={search}
          setSearch={setSearch}
          setStatus={setStatus}
          status={status}
          t={t}
        />
      </div>
    </div>
  );
}
