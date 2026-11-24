import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// The search page is page.tsx plus the components and hooks it is composed from.
function readHomePage() {
  const searchDir = path.join(process.cwd(), "src/components/search");
  const parts = fs.readdirSync(searchDir)
    .filter((name) => /\.tsx?$/.test(name))
    .sort()
    .map((name) => path.join(searchDir, name));

  return [path.join(process.cwd(), "src/app/page.tsx"), ...parts]
    .map((filename) => fs.readFileSync(filename, "utf8"))
    .join("\n");
}

function readExpandableSourceText() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/expandable-source-text.tsx"), "utf8");
}

function readSourceRecordText() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/source-record-text.tsx"), "utf8");
}

test("search requests include the selected source filters", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /selectedTafsirSource = tafsirSource/);
  assert.match(pageSource, /selectedHadithCollection = hadithCollection/);
  assert.match(pageSource, /tafsirSource: selectedTafsirSource/);
  assert.match(pageSource, /hadithCollection: selectedHadithCollection/);
});

test("changing tafsir source reruns the submitted question with the new source", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /function handleTafsirSourceChange\(nextSource: TafsirSourceSelection\)/);
  assert.match(pageSource, /setTafsirSource\(nextSource\);/);
  assert.match(pageSource, /runSearch\(submittedQuestion, nextSource, hadithCollection\)/);
});

test("changing hadith collection reruns the submitted question with the new collection", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /function handleHadithCollectionChange\(nextCollection: HadithCollectionSelection\)/);
  assert.match(pageSource, /setHadithCollection\(nextCollection\);/);
  assert.match(pageSource, /runSearch\(submittedQuestion, tafsirSource, nextCollection\)/);
});

test("source result filter narrows the visible source records", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /type ResultSourceFilter = "all" \| "quran" \| "hadith"/);
  assert.match(pageSource, /record\.sourceKind === "hadith"/);
  assert.match(pageSource, /record\.sourceKind === "quran" \|\| record\.sourceKind === "tafsir"/);
});

test("English source cards fall back to original Arabic when translation is missing", () => {
  const sourceText = readSourceRecordText();

  assert.match(sourceText, /language === "en" && record\.englishText/);
  assert.match(sourceText, /dir: "rtl" as const/);
  assert.match(sourceText, /record\.arabicText \|\| t/);
});

test("similar quotation matches show a deterministic notice above the answer", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /retrieval\?\.quotationMatch\?\.state === "similar"/);
  assert.match(pageSource, /result\.similarSourceNotice/);
});

test("loading collapses search controls and keeps an accessible edit action", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /ref=\{loadingSummaryRef\}/);
  assert.match(pageSource, /role="status"/);
  assert.match(pageSource, /requestAbortRef\.current\?\.abort\(\)/);
  assert.match(pageSource, /home\.editQuestion/);
  assert.match(pageSource, /min-h-\[clamp\(18rem,48svh,36rem\)\]/);
});

test("search loading uses streamed server progress without a fixed minimum delay", () => {
  const pageSource = readHomePage();
  const loadingSource = fs.readFileSync(path.join(process.cwd(), "src/components/search-loading.tsx"), "utf8");
  const streamSource = fs.readFileSync(path.join(process.cwd(), "src/lib/search-stream.ts"), "utf8");

  assert.match(pageSource, /Accept: searchStreamMediaType/);
  assert.match(pageSource, /readSearchResponse\(\s*response/);
  assert.doesNotMatch(pageSource, /minimumLoadingMs/);
  assert.doesNotMatch(pageSource, /window\.setTimeout/);
  assert.match(loadingSource, /role="progressbar"/);
  assert.match(loadingSource, /aria-valuenow=\{safeProgress\}/);
  assert.match(streamSource, /TextDecoder/);
  assert.match(streamSource, /decoder\.decode\(value, \{ stream: !done \}\)/);
});

test("mobile source filters use equal-width columns above the full-width search action", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /grid grid-cols-2 gap-3/);
  assert.match(pageSource, /col-span-2 flex items-end lg:col-span-1/);
});

test("long Quran and hadith source text can expand from a five-line preview", () => {
  const sourceText = readSourceRecordText();
  const expandableSourceText = readExpandableSourceText();
  const globalStyles = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(sourceText, /record\.sourceKind === "quran" \|\| record\.sourceKind === "hadith"/);
  assert.match(sourceText, /result\.showMore/);
  assert.match(sourceText, /result\.showLess/);
  assert.match(expandableSourceText, /scrollHeight > element\.clientHeight \+ 1/);
  assert.match(expandableSourceText, /aria-expanded=\{isExpanded\}/);
  assert.match(expandableSourceText, /aria-controls=\{contentId\}/);
  assert.match(globalStyles, /-webkit-line-clamp: 5/);
});

test("search loading shows named steps instead of a percentage", () => {
  const loadingSource = fs.readFileSync(path.join(process.cwd(), "src/components/search-loading.tsx"), "utf8");
  const displaySource = fs.readFileSync(path.join(process.cwd(), "src/components/search/search-display.ts"), "utf8");
  const i18nSource = fs.readFileSync(path.join(process.cwd(), "src/lib/i18n.ts"), "utf8");

  for (const key of ["loading.step.understand", "loading.step.retrieve", "loading.step.draft", "loading.step.check"]) {
    assert.match(loadingSource, new RegExp(`"${key.replaceAll(".", "\\.")}"`));
    assert.equal(i18nSource.match(new RegExp(`"${key.replaceAll(".", "\\.")}"`, "g"))?.length, 2);
  }

  assert.match(loadingSource, /data-state=\{state\}/);
  assert.match(loadingSource, /aria-live="polite"/);
  assert.doesNotMatch(loadingSource, /\{safeProgress\}%/);
  assert.match(displaySource, /detail\.sources/);
  assert.match(displaySource, /detail\.records/);
});
