import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readHomePage() {
  return fs.readFileSync(path.join(process.cwd(), "src/app/page.tsx"), "utf8");
}

test("search requests include the selected tafsir source", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /async function runSearch\(nextQuestion: string, selectedTafsirSource = tafsirSource\)/);
  assert.match(pageSource, /tafsirSource: selectedTafsirSource/);
});

test("changing tafsir source reruns the submitted question with the new source", () => {
  const pageSource = readHomePage();

  assert.match(pageSource, /function handleTafsirSourceChange\(nextSource: TafsirSourceSelection\)/);
  assert.match(pageSource, /setTafsirSource\(nextSource\);/);
  assert.match(pageSource, /runSearch\(submittedQuestion, nextSource\)/);
});
