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

  for (const pagePath of appPages) {
    const pageSource = readProjectFile(pagePath);

    assert.match(pageSource, /import \{ SiteHeader \} from "@\/components\/site-header";/);
    assert.match(pageSource, /<SiteHeader \/>/);
    assert.doesNotMatch(pageSource, /<header className=/);
  }
});

test("information pages have copy for the retrieval pipeline and source boundary", () => {
  const dictionarySource = readProjectFile("src/lib/i18n.ts");

  for (const key of [
    "how.pipeline.query",
    "how.pipeline.sources",
    "how.pipeline.answer",
    "how.flow.title",
    "policy.boundary.title",
    "policy.flow.title",
    "policy.flow.sources.title",
    "policy.guardrails.title",
    "policy.sources.title",
    "policy.sources.tafsir.tabari",
    "policy.sources.hadith.bukhari",
    "policy.provenance.title",
    "policy.provenance.useLabel",
    "policy.provenance.quran.origin",
    "policy.provenance.tafsir.visible",
    "policy.provenance.hadith.note",
  ]) {
    assert.match(dictionarySource, new RegExp(`"${key}"`));
  }
});
