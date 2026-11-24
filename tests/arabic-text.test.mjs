import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createTsRequire } from "./helpers/ts-require.mjs";

const arabic = createTsRequire(path.join(process.cwd(), "tests/index.mjs"))("@/lib/text/arabic");

test("normalizeArabic strips diacritics, tatweel, and folds letter variants", () => {
  assert.equal(arabic.normalizeArabic("إِنَّمَا الأعمـــالُ بالنِّيّاتِ"), "انما الاعمال بالنيات");
  assert.equal(arabic.normalizeArabic("آية"), "ايه");
  assert.equal(arabic.normalizeArabic("مُوسَىٰ"), "موسي");
  assert.equal(arabic.normalizeArabic("ٱلرَّحۡمَٰنِ"), "الرحمن");
});

test("normalizeArabic can keep ta marbuta for callers matching patterns spelled with it", () => {
  assert.equal(arabic.normalizeArabic("سورة", { foldTaMarbuta: false }), "سورة");
  assert.equal(arabic.normalizeArabic("سورة"), "سوره");
});

test("stripArabicDiacritics keeps letter shapes", () => {
  assert.equal(arabic.stripArabicDiacritics("أَعُوذُ بِاللَّهِ"), "أعوذ بالله");
});

test("tokenize splits on punctuation and keeps requested characters", () => {
  assert.deepEqual(Array.from(arabic.tokenize("ما تفسير الآية، 2:255؟")), ["ما", "تفسير", "الآية", "2", "255"]);
  assert.deepEqual(Array.from(arabic.tokenize("تفسير 2:255", { keep: ":" })), ["تفسير", "2:255"]);
});

test("matchingTokens lowercases and normalizes mixed text", () => {
  assert.deepEqual(Array.from(arabic.matchingTokens("Hadith عن الصلاة")), ["hadith", "عن", "الصلاه"]);
});
