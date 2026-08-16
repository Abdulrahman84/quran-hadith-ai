import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Check is a separate workflow and endpoint from General Search", () => {
  const page = readSource("src/app/page.tsx");
  const panel = readSource("src/components/check/check-panel.tsx");

  assert.match(page, /workflow === "general"/);
  assert.match(page, /<CheckPanel \/>/);
  assert.match(panel, /fetch\("\/api\/check"/);
  assert.doesNotMatch(panel, /fetch\("\/api\/search"/);
});

test("Check exposes accessible Ayah and Hadith radio choices", () => {
  const panel = readSource("src/components/check/check-panel.tsx");

  assert.match(panel, /<fieldset>/);
  assert.match(panel, /name="check-type"/);
  assert.match(panel, /type="radio"/);
  assert.match(panel, /const checkTypes: CheckType\[\] = \["ayah", "hadith"\]/);
});

test("Check omits source helper notes and collection controls", () => {
  const panel = readSource("src/components/check/check-panel.tsx");

  assert.doesNotMatch(panel, /check\.ayahSourceNote/);
  assert.doesNotMatch(panel, /check-hadith-collection/);
  assert.doesNotMatch(panel, /hadithCollections/);
});

test("Check reuses the General Search loading presentation", () => {
  const panel = readSource("src/components/check/check-panel.tsx");

  assert.match(panel, /import \{ SearchLoading \}/);
  assert.match(panel, /<SearchLoading/);
  assert.match(panel, /min-h-\[clamp\(18rem,48svh,36rem\)\]/);
  assert.match(panel, /min-h-\[4\.5rem\]/);
  assert.match(panel, /function editCheck\(\)/);
  assert.match(panel, /home\.editQuestion/);
});

test("Check retrieval searches literal wording and AI-planned meaning queries", () => {
  const service = readSource("src/lib/check/service.ts");
  const planner = readSource("src/lib/check/query-planner.ts");

  assert.match(service, /searchQuery\(input, input\.text\)/);
  assert.match(service, /planCheckQueries/);
  assert.match(planner, /exact wording and sources with a closely related meaning/);
  assert.match(planner, /slice\(0, QUERY_LIMIT\)/);
});

test("Check answer prompt cannot replace the code-owned outcome", () => {
  const answer = readSource("src/lib/check/answer.ts");

  assert.match(answer, /outcome is code-owned and immutable/);
  assert.match(answer, /Hadith text presence never proves authenticity/);
  assert.match(answer, /No qualifying match was found in the available indexed sources/);
  assert.match(answer, /outcome === "similar" && \(claimsExactWording \|\| claimsNoMatch\)/);
  assert.match(answer, /outcome === "exact" && claimsNoMatch/);
  assert.match(answer, /outcome !== "not_found" && citations\.length === 0/);
});

test("public outcome labels distinguish exact, similar, and bounded no match", () => {
  const i18n = readSource("src/lib/i18n.ts");

  assert.match(i18n, /"check\.outcome\.exact": "Exact match found"/);
  assert.match(i18n, /"check\.outcome\.similar": "Similar sources found"/);
  assert.match(i18n, /"check\.outcome\.not_found": "No match found in the available sources"/);
});

test("Check rejects vague questions that are not source wording", () => {
  const panel = readSource("src/components/check/check-panel.tsx");
  const route = readSource("src/app/api/check/route.ts");

  assert.match(panel, /isVagueCheckPrompt\(checkedText\)/);
  assert.match(route, /check_text_too_ambiguous/);
  assert.match(route, /من قال هذا/);
});
