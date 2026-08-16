import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("analytics keeps legacy runs as General and validates Check metadata", () => {
  const http = readSource("convex/http.ts");
  const runs = readSource("convex/questionRuns.ts");

  assert.match(http, /value\.runKind === undefined \? "general"/);
  assert.match(http, /runKind === "check" && !checkType/);
  assert.match(http, /value\.status !== "failed" && !checkOutcome/);
  assert.match(runs, /run\.runKind \?\? "general"/);
  assert.match(runs, /checkType: run\.checkType \?\? null/);
  assert.match(runs, /checkOutcome: run\.checkOutcome \?\? null/);
});

test("Check analytics records only the code-owned outcome and displayed records", () => {
  const recorder = readSource("src/lib/analytics/record-check-run.ts");
  const route = readSource("src/app/api/check/route.ts");

  assert.match(recorder, /input\.response\.outcome/);
  assert.match(recorder, /input\.response\.records/);
  assert.doesNotMatch(recorder, /planCheckQueries|semanticResponses|provenanceNotes/);
  assert.match(route, /await recordCheckRun/);
});

test("dashboard aggregates Check types and outcomes without treating failures as not found", () => {
  const stats = readSource("convex/runStats.ts");

  assert.match(stats, /workflow:check/);
  assert.match(stats, /checkType:ayah/);
  assert.match(stats, /checkOutcome:not_found/);
  assert.match(stats, /unclassified: Math\.max\(0, checkCount - classifiedCheckCount\)/);
  assert.match(stats, /general: Math\.max\(0, trackedCount - checkCount\)/);
});

test("dashboard cards distinguish workflow, Check type, outcome, and technical status", () => {
  const card = readSource("src/components/dashboard/question-result-card.tsx");
  const overview = readSource("src/components/dashboard/check-overview.tsx");

  assert.match(card, /run\.runKind === "check"/);
  assert.match(card, /run\.checkType/);
  assert.match(card, /run\.checkOutcome/);
  assert.match(overview, /stats\.checkTotals\.unclassified > 0/);
});

test("dashboard-facing Arabic and English copy contains no Convex brand name", () => {
  const i18n = readSource("src/lib/i18n.ts");
  const dashboardValues = i18n
    .split("\n")
    .filter((line) => line.includes('"dashboard.'))
    .join("\n");

  assert.doesNotMatch(dashboardValues, /Convex/i);
  assert.match(dashboardValues, /"dashboard\.liveBadge": "Live data"/);
  assert.match(dashboardValues, /"dashboard\.liveBadge": "بيانات مباشرة"/);
});
