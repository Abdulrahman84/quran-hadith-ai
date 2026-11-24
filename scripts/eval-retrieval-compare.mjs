#!/usr/bin/env node
// Compares two eval/results reports per tag, scoring only the questions both runs answered.
// Tags come from the current eval/retrieval-questions.json, so older reports stay comparable.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evalDir = path.join(projectRoot, "eval");
const resultsDir = path.join(evalDir, "results");

const usage = `Usage:
  npm run eval:compare -- <baseline.json> <candidate.json>
  npm run eval:compare -- --modes lexical hybrid    (newest report of each retrievalMode)
  npm run eval:compare -- --latest                  (two newest reports)
Options: --json   print the comparison as JSON instead of tables`;

const modeOf = (report) => report.retrievalMode ?? report.label ?? "lexical";

function loadReport(file) {
  const resolved = path.isAbsolute(file) ? file : fs.existsSync(file) ? path.resolve(file) : path.join(resultsDir, file);
  const report = JSON.parse(fs.readFileSync(resolved, "utf8"));
  return { file: path.relative(projectRoot, resolved), mode: modeOf(report), report };
}

function listReports() {
  if (!fs.existsSync(resultsDir)) return [];
  return fs
    .readdirSync(resultsDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => loadReport(path.join(resultsDir, name)));
}

function pickReports(args) {
  if (args[0] === "--latest") {
    const reports = listReports();
    if (reports.length < 2) throw new Error("Need at least two reports in eval/results.");
    return reports.slice(-2);
  }
  if (args[0] === "--modes") {
    const [baseMode, candidateMode] = args.slice(1, 3);
    if (!baseMode || !candidateMode) throw new Error("--modes needs two retrievalMode names.");
    const reports = listReports();
    const newest = (mode) => {
      const match = reports.filter((entry) => entry.mode === mode).at(-1);
      if (!match) throw new Error(`No report with retrievalMode "${mode}" in eval/results.`);
      return match;
    };
    return [newest(baseMode), newest(candidateMode)];
  }
  if (args.length < 2) throw new Error(usage);
  return [loadReport(args[0]), loadReport(args[1])];
}

const mean = (values) => (values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length);

function stats(results) {
  return {
    n: results.length,
    recallAt1: mean(results.map((result) => (result.successAt1 ? 1 : 0))),
    recallAt5: mean(results.map((result) => (result.successAt5 ? 1 : 0))),
    mrr: mean(results.map((result) => result.reciprocalRank)),
    latencyMs: Math.round(mean(results.map((result) => result.latencyMs))),
    errors: results.filter((result) => result.error || result.status === "error").length,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return;
  }
  const asJson = args.includes("--json");
  const [base, candidate] = pickReports(args.filter((arg) => arg !== "--json"));

  const dataset = JSON.parse(fs.readFileSync(path.join(evalDir, "retrieval-questions.json"), "utf8"));
  const tagsById = new Map(dataset.items.map((item) => [item.id, item.tags]));
  const baseById = new Map(base.report.results.map((result) => [result.id, result]));
  const candidateById = new Map(candidate.report.results.map((result) => [result.id, result]));
  const sharedIds = [...baseById.keys()].filter((id) => candidateById.has(id) && tagsById.has(id));
  const skipped = new Set([...baseById.keys(), ...candidateById.keys()].filter((id) => !sharedIds.includes(id)));

  const groups = new Map([["ALL", sharedIds]]);
  for (const id of sharedIds) {
    for (const tag of tagsById.get(id)) {
      groups.set(tag, [...(groups.get(tag) ?? []), id]);
    }
    groups.set(`lang:${baseById.get(id).language}`, [...(groups.get(`lang:${baseById.get(id).language}`) ?? []), id]);
  }

  const groupOrder = ["ALL", "exact-quote", "reference", "paraphrase", "topical", "cross-lingual", "source-limited", "hadith", "quran", "mixed"];
  const orderOf = (group) => (groupOrder.includes(group) ? groupOrder.indexOf(group) : groupOrder.length);
  const rows = [...groups.entries()].sort(([left], [right]) => orderOf(left) - orderOf(right) || left.localeCompare(right)).map(([group, ids]) => {
    const before = stats(ids.map((id) => baseById.get(id)));
    const after = stats(ids.map((id) => candidateById.get(id)));
    return { group, before, after };
  });

  const flips = sharedIds
    .map((id) => ({ id, before: baseById.get(id), after: candidateById.get(id) }))
    .filter(({ before, after }) => before.successAt5 !== after.successAt5 || before.firstRelevantRank !== after.firstRelevantRank)
    .map(({ id, before, after }) => ({
      id,
      tags: tagsById.get(id),
      rankBefore: before.firstRelevantRank,
      rankAfter: after.firstRelevantRank,
      change: before.successAt5 === after.successAt5 ? "rank" : after.successAt5 ? "fixed" : "regressed",
    }));

  if (asJson) {
    console.log(JSON.stringify({ base: { file: base.file, mode: base.mode }, candidate: { file: candidate.file, mode: candidate.mode }, rows, flips, skipped: [...skipped] }, null, 2));
    return;
  }

  const pct = (value) => `${(value * 100).toFixed(1)}%`.padStart(6);
  const delta = (value, isPercent = true) => {
    const text = isPercent ? `${(value * 100).toFixed(1)}` : value.toFixed(3);
    return (value > 0 ? `+${text}` : text).padStart(6);
  };

  console.log(`Baseline:  ${base.mode.padEnd(10)} ${base.file}`);
  console.log(`Candidate: ${candidate.mode.padEnd(10)} ${candidate.file}`);
  console.log(`Questions compared: ${sharedIds.length}${skipped.size ? ` (skipped ${skipped.size} not in both runs or dataset)` : ""}\n`);
  console.log(`${"group".padEnd(16)} ${"n".padStart(3)}   ${"R@1".padStart(6)} ${"->".padStart(2)} ${"R@1".padStart(6)} ${"Δ".padStart(6)}   ${"R@5".padStart(6)} -> ${"R@5".padStart(6)} ${"Δ".padStart(6)}   ${"MRR".padStart(5)} -> ${"MRR".padStart(5)} ${"Δ".padStart(6)}   latency ms`);
  for (const { group, before, after } of rows) {
    console.log(
      `${group.padEnd(16)} ${String(before.n).padStart(3)}   ${pct(before.recallAt1)} -> ${pct(after.recallAt1)} ${delta(after.recallAt1 - before.recallAt1)}   ${pct(before.recallAt5)} -> ${pct(after.recallAt5)} ${delta(after.recallAt5 - before.recallAt5)}   ${before.mrr.toFixed(3)} -> ${after.mrr.toFixed(3)} ${delta(after.mrr - before.mrr, false)}   ${before.latencyMs} -> ${after.latencyMs}`,
    );
  }

  const fixed = flips.filter((flip) => flip.change === "fixed");
  const regressed = flips.filter((flip) => flip.change === "regressed");
  const reranked = flips.filter((flip) => flip.change === "rank");
  const describe = (flip) => `  ${flip.id.padEnd(20)} rank ${flip.rankBefore ?? "-"} -> ${flip.rankAfter ?? "-"}  [${flip.tags.join(", ")}]`;
  if (fixed.length) console.log(`\nFixed (${fixed.length}):\n${fixed.map(describe).join("\n")}`);
  if (regressed.length) console.log(`\nRegressed (${regressed.length}):\n${regressed.map(describe).join("\n")}`);
  if (reranked.length) console.log(`\nRank changed, same pass/fail (${reranked.length}):\n${reranked.map(describe).join("\n")}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
