import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readHomePage() {
  return fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
}

function readExpandableSourceText() {
  return fs.readFileSync(path.join(process.cwd(), "src/components/expandable-source-text.tsx"), "utf8");
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
  const pageSource = readHomePage();

  assert.match(pageSource, /record\.arabicText \|\| fallbackText\.english/);
  assert.match(pageSource, /const direction: "ltr" \| "rtl" = record\.englishText \? "ltr" : "rtl"/);
  assert.match(pageSource, /dir: direction/);
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

test("long Quran and hadith source text can expand from a five-line preview", () => {
  const pageSource = readHomePage();
  const expandableSourceText = readExpandableSourceText();
  const globalStyles = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

  assert.match(pageSource, /record\.sourceKind === "quran" \|\| record\.sourceKind === "hadith"/);
  assert.match(pageSource, /result\.showMore/);
  assert.match(pageSource, /result\.showLess/);
  assert.match(expandableSourceText, /scrollHeight > element\.clientHeight \+ 1/);
  assert.match(expandableSourceText, /aria-expanded=\{isExpanded\}/);
  assert.match(expandableSourceText, /aria-controls=\{contentId\}/);
  assert.match(globalStyles, /-webkit-line-clamp: 5/);
});
