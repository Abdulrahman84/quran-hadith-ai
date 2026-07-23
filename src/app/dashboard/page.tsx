"use client";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { SiteHeader } from "@/components/site-header";

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-sand)] pt-20 text-[var(--color-ink)] sm:pt-24">
      <div className="source-grid" aria-hidden="true" />
      <SiteHeader />
      <DashboardShell />
    </main>
  );
}
