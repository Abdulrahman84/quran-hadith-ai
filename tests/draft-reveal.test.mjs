import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createTsRequire } from "./helpers/ts-require.mjs";

const { nextRevealLength } = createTsRequire(path.join(process.cwd(), "tests/index.mjs"))(
  "@/components/search/draft-reveal",
);

function revealAll(target) {
  const steps = [];
  let shown = 0;

  while (shown < target.length) {
    const next = nextRevealLength(target, shown);
    assert.ok(next > shown, "every tick reveals something");
    steps.push(target.slice(0, next));
    shown = next;
  }

  return steps;
}

test("the draft is revealed word by word, never splitting a word", () => {
  const target = "تدل المصادر على فضل الصدقة [1] وأنها تطفئ الخطيئة.";
  const steps = revealAll(target);

  assert.equal(steps.at(-1), target);
  assert.ok(steps.length >= 6, "a short answer takes several ticks");
  for (const step of steps.slice(0, -1)) {
    assert.match(step, /\s$/, `"${step}" ends at a word boundary`);
  }
});

test("a long backlog is revealed faster, so the draft catches up", () => {
  const words = Array.from({ length: 200 }, (_, index) => `word${index}`).join(" ");
  const first = nextRevealLength(words, 0);
  const nearEnd = nextRevealLength(words, words.length - 20);

  assert.equal(words.slice(0, first).trim().split(/\s+/).length, 3);
  assert.equal(words.slice(words.length - 20, nearEnd).trim().split(/\s+/).length, 1);
  assert.ok(revealAll(words).length < 200, "fewer ticks than words");
});

test("out-of-range positions are clamped", () => {
  assert.equal(nextRevealLength("abc def", 99), 7);
  assert.equal(nextRevealLength("abc def", -5), 4);
  assert.equal(nextRevealLength("", 0), 0);
});

test("the search hook waits for the draft before showing the checked answer", () => {
  const hook = fs.readFileSync(path.join(process.cwd(), "src/components/search/use-search-stream.ts"), "utf8");

  assert.match(hook, /await waitForDraftReveal\(\)/);
  assert.match(hook, /prefers-reduced-motion: reduce/);
  assert.match(hook, /DRAFT_REVEAL_MAX_WAIT_MS/);
});
