import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createTsRequire } from "./helpers/ts-require.mjs";

const { orderRecords } = createTsRequire(path.join(process.cwd(), "tests/index.mjs"))("@/lib/retrieval/record-order");

function record(id, sourceKind, arabicText, rank) {
  return { id, sourceKind, arabicText, rank };
}

const yusrHadith = record("hadith:1", "hadith", "قال رسول الله صلى الله عليه وسلم لن يغلب عسر يسرين", 1);
const otherHadith = record("hadith:2", "hadith", "حديث عن الصبر على البلاء", 2);
const yusrAyah = record("quran:94:6", "quran", "إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا", 1);
const otherAyah = record("quran:2:280", "quran", "وَإِن كَانَ ذُو عُسۡرَةٖ فَنَظِرَةٌ إِلَىٰ مَيۡسَرَةٖ", 2);

const ids = (records) => Array.from(records, (item) => item.id);

test("a verbatim ayah quote ranks the ayah first", () => {
  const ordered = orderRecords([yusrHadith, otherHadith, otherAyah, yusrAyah], "إن مع العسر يسرا", false);
  assert.equal(ordered[0].id, "quran:94:6");
});

test("an ayah quote with a one-letter typo still ranks the ayah first", () => {
  const ordered = orderRecords([yusrHadith, otherHadith, otherAyah, yusrAyah], "ان مع العسر يسري", false);
  assert.deepEqual(ids(ordered), ["quran:94:6", "hadith:1", "hadith:2", "quran:2:280"]);
});

test("short words and three-word phrases need an exact match", () => {
  // «من» for «ان» is a different word, not a typo.
  assert.equal(orderRecords([yusrHadith, yusrAyah], "من مع العسر يسرا", false)[0].id, "hadith:1");
  assert.equal(orderRecords([yusrHadith, yusrAyah], "مع العسر يسري", false)[0].id, "hadith:1");
});

test("two typos in a four-word quote are not a match", () => {
  assert.equal(orderRecords([yusrHadith, yusrAyah], "ان مع العصر يسري", false)[0].id, "hadith:1");
});

test("without a quote, hadith come first unless the question is about the Quran", () => {
  const records = [otherAyah, otherHadith, yusrAyah, yusrHadith];

  assert.deepEqual(ids(orderRecords(records, "الصبر", false)), ["hadith:1", "hadith:2", "quran:94:6", "quran:2:280"]);
  assert.deepEqual(ids(orderRecords(records, "الصبر", true)), ["quran:94:6", "quran:2:280", "hadith:1", "hadith:2"]);
});

test("a hadith quoted verbatim ranks ahead of an ayah it does not quote", () => {
  const niyyat = record("hadith:3", "hadith", "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى", 3);
  const ordered = orderRecords([yusrAyah, otherHadith, niyyat], "إنما الأعمال بالنيات", true);

  assert.equal(ordered[0].id, "hadith:3");
});
