#!/usr/bin/env node
// Resolves eval/dataset-spec.json into eval/retrieval-questions.json by querying the real
// source databases, so every expected reference is backed by an actual record.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(evalDir, "..");
const MAX_MATCHES_PER_RULE = 40;
// Bump only when the output format changes; other tools read retrieval-questions.json.
const DATASET_SCHEMA_VERSION = 1;
const KINDS = new Set(["exact-quote", "reference", "paraphrase", "topical"]);
const MODIFIERS = new Set(["cross-lingual", "source-limited", "dialect", "informal"]);
const CORPORA = new Set(["hadith", "quran", "mixed"]);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvFile(path.join(projectRoot, ".env.local"));

const siblingHadithRepo = path.resolve(projectRoot, "../hadith-mcp");
const hadithDb =
  process.env.HADITH_MCP_DB_PATH || path.join(siblingHadithRepo, "data/generated/hadith-meeatif.sqlite");
const quranDb = process.env.TAFSIR_DB_PATH || path.join(os.homedir(), ".cache/tafsir-mcp/quran.db");

if (!hadithDb || !fs.existsSync(hadithDb)) {
  console.error(`Hadith DB not found. Set HADITH_MCP_DB_PATH (got: ${hadithDb ?? "unset"}).`);
  process.exit(1);
}
if (!fs.existsSync(quranDb)) {
  console.error(`Quran DB not found at ${quranDb}. Set TAFSIR_DB_PATH.`);
  process.exit(1);
}

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

function query(db, sql) {
  const out = execFileSync("sqlite3", ["-separator", "\t", db, sql], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").filter(Boolean).map((line) => line.split("\t"));
}

function resolveHadithRule(rule) {
  const where = rule.all.map((fragment) => `t.search_text LIKE ${sqlString(`%${fragment}%`)}`).join(" AND ");
  const collectionFilter = rule.collections?.length
    ? ` AND c.collection IN (${rule.collections.map(sqlString).join(",")})`
    : "";
  const rows = query(
    hadithDb,
    `SELECT c.collection, h.hadith_number FROM hadiths h
     JOIN hadith_texts t ON t.hadith_id = h.id AND t.language = 'arabic'
     JOIN collections c ON c.id = h.collection_id
     WHERE ${where}${collectionFilter}
     ORDER BY c.id, h.id;`,
  );
  return rows.map(([collection, hadithNumber]) => ({ kind: "hadith", collection, hadithNumber }));
}

function resolveQuran(spec) {
  if (spec.verseKeys) {
    return spec.verseKeys.map((verseKey) => {
      const [surah, ayah] = verseKey.split(":").map(Number);
      const rows = query(quranDb, `SELECT 1 FROM ayah_fts WHERE surahNo = ${surah} AND ayahNo = ${ayah};`);
      if (rows.length === 0) throw new Error(`verseKey ${verseKey} does not exist in quran.db`);
      return { kind: "quran", verseKey };
    });
  }
  const where = spec.all.map((fragment) => `text_normalized LIKE ${sqlString(`%${fragment}%`)}`).join(" AND ");
  return query(quranDb, `SELECT surahNo, ayahNo FROM ayah_fts WHERE ${where} ORDER BY CAST(surahNo AS INT), CAST(ayahNo AS INT);`).map(
    ([surah, ayah]) => ({ kind: "quran", verseKey: `${surah}:${ayah}` }),
  );
}

const spec = JSON.parse(fs.readFileSync(path.join(evalDir, "dataset-spec.json"), "utf8"));
const problems = [];
const ids = new Set();

const items = spec.items.map((item) => {
  if (ids.has(item.id)) problems.push(`${item.id}: duplicate id`);
  ids.add(item.id);
  if (!KINDS.has(item.kind)) problems.push(`${item.id}: kind must be one of ${[...KINDS].join(", ")}`);
  if (!CORPORA.has(item.corpus)) problems.push(`${item.id}: corpus must be one of ${[...CORPORA].join(", ")}`);
  const expectedTags = [
    item.kind,
    ...(item.language === "english" ? ["cross-lingual"] : []),
    ...["source-limited", "dialect", "informal"].filter((tag) => item.tags.includes(tag)),
    item.corpus,
  ];
  if (JSON.stringify(item.tags) !== JSON.stringify(expectedTags)) {
    problems.push(`${item.id}: tags must be [kind, modifiers..., corpus]; expected ${JSON.stringify(expectedTags)}`);
  }
  for (const tag of item.tags) {
    if (!KINDS.has(tag) && !MODIFIERS.has(tag) && !CORPORA.has(tag)) problems.push(`${item.id}: unknown tag ${tag}`);
  }

  const expected = [];
  const evidence = [];

  for (const rule of item.hadith ?? []) {
    const matches = resolveHadithRule(rule);
    evidence.push({ rule: { source: "hadith", ...rule }, matches: matches.length });
    if (matches.length === 0) problems.push(`${item.id}: hadith rule ${JSON.stringify(rule.all)} matched nothing`);
    if (matches.length > MAX_MATCHES_PER_RULE) problems.push(`${item.id}: hadith rule ${JSON.stringify(rule.all)} matched ${matches.length} (> ${MAX_MATCHES_PER_RULE}); tighten it`);
    expected.push(...matches);
  }

  if (item.quran) {
    const matches = resolveQuran(item.quran);
    evidence.push({ rule: { source: "quran", ...item.quran }, matches: matches.length });
    if (matches.length === 0) problems.push(`${item.id}: quran rule matched nothing`);
    if (matches.length > MAX_MATCHES_PER_RULE) problems.push(`${item.id}: quran rule matched ${matches.length}; tighten it`);
    expected.push(...matches);
  }

  const seen = new Set();
  const uniqueExpected = expected.filter((ref) => {
    const key = ref.kind === "hadith" ? `h:${ref.collection}:${ref.hadithNumber}` : `q:${ref.verseKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    id: item.id,
    question: item.question,
    language: item.language,
    kind: item.kind,
    corpus: item.corpus,
    tags: item.tags,
    minExpected: item.minExpected ?? 1,
    expected: uniqueExpected,
    evidence,
  };
});

if (problems.length > 0) {
  console.error("Dataset problems:\n" + problems.map((problem) => `  - ${problem}`).join("\n"));
  process.exit(1);
}

const output = {
  schemaVersion: DATASET_SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  sources: { hadithDb: path.basename(hadithDb), quranDb: path.basename(quranDb) },
  count: items.length,
  items,
};

fs.writeFileSync(path.join(evalDir, "retrieval-questions.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${items.length} questions to eval/retrieval-questions.json`);
for (const item of items) {
  console.log(`  ${item.id.padEnd(20)} ${String(item.expected.length).padStart(3)} expected`);
}
