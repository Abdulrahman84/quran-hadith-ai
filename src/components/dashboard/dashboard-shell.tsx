"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { useAuthActions, useConvexAuth } from "@convex-dev/auth/react";

import { api } from "../../../convex/_generated/api";
import { useI18n } from "@/components/i18n-provider";

import { ActivityChart } from "./activity-chart";
import { AdminSignIn } from "./admin-sign-in";
import { QuestionResults } from "./question-results";
import { SourceMix } from "./source-mix";
import { StatsGrid } from "./stats-grid";
import type { DashboardScope, DashboardStatus } from "./types";

const scopes: DashboardScope[] = ["all", "live", "demo"];

function scopeKey(scope: DashboardScope) {
  if (scope === "live") return "dashboard.scope.live" as const;
  if (scope === "demo") return "dashboard.scope.demo" as const;
  return "dashboard.scope.all" as const;
}

export function DashboardShell() {
  const { language, t } = useI18n();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [scope, setScope] = useState<DashboardScope>("all");
  const [status, setStatus] = useState<DashboardStatus>("all");
  const stats = useQuery(api.analytics.getStats, isAuthenticated ? { scope } : "skip");
  const runs = useQuery(api.questionRuns.listRecent, isAuthenticated ? { limit: 12, scope, status } : "skip");

  if (isLoading) {
    return <div className="relative z-10 mx-auto mt-24 h-44 w-full max-w-lg animate-pulse rounded-2xl bg-[var(--color-primary-soft)]" aria-label={t("dashboard.loading")} />;
  }

  if (!isAuthenticated) return <AdminSignIn t={t} />;

  return (
    <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--color-green-soft)]">{t("dashboard.eyebrow")}</p>
            <span className="rounded-md border border-[var(--color-green)]/20 bg-[var(--color-primary-soft)] px-2 py-1 text-[0.65rem] font-bold text-[var(--color-green)]">
              {t("dashboard.liveBadge")}
            </span>
          </div>
          <h1 className="mt-4 text-balance text-3xl font-bold leading-tight text-[var(--color-green)] sm:text-5xl">{t("dashboard.title")}</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--color-muted)] sm:text-base">
            {t("dashboard.intro")}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-[var(--color-muted)]">{t("dashboard.scope.label")}</p>
          <div className="flex flex-wrap gap-2" aria-label={t("dashboard.scope.label")}>
            {scopes.map((item) => (
              <button
                aria-pressed={scope === item}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-green)] transition hover:border-[var(--color-gold)] data-[active=true]:border-[var(--color-green)] data-[active=true]:bg-[var(--color-green)] data-[active=true]:text-white"
                data-active={scope === item}
                key={item}
                onClick={() => setScope(item)}
                type="button"
              >
                {t(scopeKey(item))}
              </button>
            ))}
            <button
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs font-bold text-[var(--color-red)] transition hover:border-[var(--color-red)]"
              onClick={() => void signOut()}
              type="button"
            >
              {t("dashboard.auth.signOut")}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {stats === undefined ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("dashboard.loading")}>
            {[0, 1, 2, 3].map((item) => <div className="h-40 animate-pulse rounded-2xl bg-[var(--color-primary-soft)]" key={item} />)}
          </div>
        ) : (
          <StatsGrid language={language} stats={stats} t={t} />
        )}
      </div>

      {stats !== undefined ? (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/80 px-4 py-3 text-xs font-semibold leading-5 text-[var(--color-muted)]">
          {t("dashboard.dataNotice")} · {stats.liveCount} {t("dashboard.scope.live")} · {stats.demoCount} {t("dashboard.scope.demo")}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        {stats === undefined ? (
          <>
            <div className="h-72 animate-pulse rounded-2xl bg-[var(--color-primary-soft)]" />
            <div className="h-72 animate-pulse rounded-2xl bg-[var(--color-primary-soft)]" />
          </>
        ) : (
          <>
            <ActivityChart activity={stats.dailyActivity} language={language} t={t} />
            <SourceMix language={language} sources={stats.sourceTotals} t={t} />
          </>
        )}
      </div>

      <div className="mt-4">
        <QuestionResults language={language} runs={runs} setStatus={setStatus} status={status} t={t} />
      </div>
    </div>
  );
}
