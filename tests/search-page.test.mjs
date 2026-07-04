import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readHomePage() {
  return fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
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
