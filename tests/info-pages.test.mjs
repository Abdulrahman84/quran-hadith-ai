import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const appPages = ["src/app/page.tsx", "src/app/how-it-works/page.tsx", "src/app/source-policy/page.tsx"];

function readProjectFile(filePath) {
  return fs.readFileSync(path.join(process.cwd(), filePath), "utf8");
}

test("main and information pages share the same site header", () => {
  assert.ok(fs.existsSync(path.join(process.cwd(), "src/components/site-header.tsx")));
  const layoutSource = readProjectFile("src/app/layout.tsx");

  assert.match(layoutSource, /import \{ SiteHeader \} from "@\/components\/site-header";/);
  assert.match(layoutSource, /<SiteHeader \/>/);

  for (const pagePath of appPages) {
    const pageSource = readProjectFile(pagePath);
    assert.doesNotMatch(pageSource, /<header className=/);
  }
});

test("source policy stays visible in the shared mobile header", () => {
  const headerSource = readProjectFile("src/components/site-header.tsx");

  assert.match(headerSource, /href="\/source-policy"/);
  assert.doesNotMatch(headerSource, /nav-link-mobile-hidden/);
});

test("information pages have copy for the retrieval pipeline and the data sources", () => {
  const dictionarySource = readProjectFile("src/lib/i18n.ts");

  for (const key of [
    "how.step.understand.text",
    "how.step.retrieve.text",
    "how.step.retrieve.meaningSearch",
    "how.step.draft.text",
    "how.step.check.text",
    "how.limits.title",
    "how.limit.fatwa",
    "policy.hadith.title",
    "policy.hadith.grades",
    "policy.hadith.credit",
    "policy.quran.title",
    "policy.quran.credit",
    "policy.privacy.title",
    "policy.privacy.ai",
    "policy.privacy.stats",
  ]) {
    assert.equal(dictionarySource.match(new RegExp(`"${key.replaceAll(".", "\\.")}"`, "g"))?.length, 2, key);
  }
});

test("How it works names its steps with the same words as the search loader", () => {
  const howSource = readProjectFile("src/app/how-it-works/page.tsx");
  const loadingSource = readProjectFile("src/components/search-loading.tsx");

  for (const key of ["loading.step.understand", "loading.step.retrieve", "loading.step.draft", "loading.step.check"]) {
    assert.ok(howSource.includes(`"${key}"`), key);
    assert.ok(loadingSource.includes(`"${key}"`), key);
  }
});

test("data source counts match the hadith import report total", () => {
  const policySource = readProjectFile("src/app/source-policy/page.tsx");
  const counts = [...policySource.matchAll(/^\s+[a-z_]+: (\d+),$/gm)].map((match) => Number(match[1]));

  assert.equal(counts.length, 6);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 33736);
});
