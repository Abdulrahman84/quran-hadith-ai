import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadNormalizer() {
  const filename = path.join(process.cwd(), "src/components/dashboard/normalize-dashboard-stats.ts");
  const transpiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require: () => ({}) };

  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(transpiled, sandbox, { filename });
  return sandbox.module.exports.normalizeDashboardStats;
}

function legacyStats() {
  return {
    trackedCount: 12,
    completedCount: 8,
    needsReviewCount: 3,
    failedCount: 1,
    citationCount: 24,
    averageSources: 2,
    sourceTotals: { quran: 8, tafsir: 7, hadith: 9 },
    dailyActivity: [{ dayStart: 1_786_924_800_000, count: 4 }],
  };
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const normalizeDashboardStats = loadNormalizer();

test("dashboard supplies safe workflow totals for a legacy backend payload", () => {
  const normalized = plain(normalizeDashboardStats(legacyStats()));

  assert.deepEqual(normalized.workflowTotals, { general: 12, check: 0 });
  assert.deepEqual(normalized.checkTotals, {
    ayah: 0,
    hadith: 0,
    classified: 0,
    unclassified: 0,
    exact: 0,
    similar: 0,
    notFound: 0,
  });
});

test("dashboard preserves workflow totals from the current backend payload", () => {
  const current = {
    ...legacyStats(),
    workflowTotals: { general: 7, check: 5 },
    checkTotals: {
      ayah: 3,
      hadith: 2,
      classified: 4,
      unclassified: 1,
      exact: 2,
      similar: 1,
      notFound: 1,
    },
  };
  const normalized = plain(normalizeDashboardStats(current));

  assert.deepEqual(normalized, current);
});
