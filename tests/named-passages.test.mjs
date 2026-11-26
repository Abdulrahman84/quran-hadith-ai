import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { createTsRequire } from "./helpers/ts-require.mjs";

const { findNamedQuranPassage } = createTsRequire(path.join(process.cwd(), "tests/index.mjs"))(
  "@/lib/retrieval/named-passages",
);

function keysFor(query) {
  const passage = findNamedQuranPassage(query);
  return passage ? Array.from(passage.verseKeys) : null;
}

test("Ayat al-Kursi resolves to 2:255 in Arabic, English and common misspellings", () => {
  for (const query of [
    "تفسير آية الكرسي",
    "تفسير ايه الكرسي",
    "شرح آيةِ الكُرسيّ",
    "فضل اية الكرسى",
    "معنى ايت الكرسي",
    "ما معنى الآية الكرسي",
    "Explain Ayat al-Kursi",
    "explain ayatul kursi",
    "Ayat ul Kursi meaning",
    "tafsir of aayatul kursi",
    "ayah al-kursiy",
    "What is Ayatulkursi about?",
    "the Throne Verse",
    "verse of the throne",
    "Āyat al-Kursī",
  ]) {
    assert.deepEqual(keysFor(query), ["2:255"], query);
  }
});

test("named verse runs resolve to their verse keys", () => {
  assert.deepEqual(keysFor("خواتيم سورة البقرة"), ["2:285", "2:286"]);
  assert.deepEqual(keysFor("آخر آيتين من سورة البقرة"), ["2:285", "2:286"]);
  assert.deepEqual(keysFor("الآيتان الأخيرتان من سورة البقرة"), ["2:285", "2:286"]);
  assert.deepEqual(keysFor("Explain the last two verses of Surah al-Baqarah"), ["2:285", "2:286"]);
  assert.deepEqual(keysFor("last 2 ayat of baqara"), ["2:285", "2:286"]);
  assert.deepEqual(keysFor("آية الدين"), ["2:282"]);
  assert.deepEqual(keysFor("What does Ayat al-Dayn say about writing debts?"), ["2:282"]);
  assert.deepEqual(keysFor("the verse of debt"), ["2:282"]);
  assert.deepEqual(keysFor("تفسير آية النور"), ["24:35"]);
  assert.deepEqual(keysFor("ayat an-nur"), ["24:35"]);
  assert.deepEqual(keysFor("آية الوضوء"), ["5:6"]);
  assert.deepEqual(keysFor("أواخر سورة الحشر"), ["59:22", "59:23", "59:24"]);
  assert.deepEqual(keysFor("last verses of al-Hashr"), ["59:22", "59:23", "59:24"]);
  assert.equal(keysFor("آخر عشر آيات من سورة آل عمران").length, 11);
  assert.equal(keysFor("last ten verses of Aal-e-Imran")[0], "3:190");
  assert.deepEqual(keysFor("أول عشر آيات من سورة الكهف"), Array.from({ length: 10 }, (_, index) => `18:${index + 1}`));
  assert.equal(keysFor("first ten verses of Surat al-Kahf").length, 10);
});

test("short surahs resolve to the whole surah", () => {
  const fatiha = ["1:1", "1:2", "1:3", "1:4", "1:5", "1:6", "1:7"];
  assert.deepEqual(keysFor("تفسير سورة الفاتحة"), fatiha);
  assert.deepEqual(keysFor("تفسير الفاتحة"), fatiha);
  assert.deepEqual(keysFor("فاتحة الكتاب"), fatiha);
  assert.deepEqual(keysFor("Explain al-Fatiha"), fatiha);
  assert.deepEqual(keysFor("meaning of surah fatihah"), fatiha);
  assert.deepEqual(keysFor("سورة الإخلاص"), ["112:1", "112:2", "112:3", "112:4"]);
  assert.deepEqual(keysFor("سوره الاخلاص"), ["112:1", "112:2", "112:3", "112:4"]);
  assert.deepEqual(keysFor("Explain Surah al-Ikhlas"), ["112:1", "112:2", "112:3", "112:4"]);
  assert.deepEqual(keysFor("suratul ikhlaas"), ["112:1", "112:2", "112:3", "112:4"]);
  assert.deepEqual(keysFor("Surah an-Nas"), ["114:1", "114:2", "114:3", "114:4", "114:5", "114:6"]);
  assert.deepEqual(keysFor("surah al-nasr"), ["110:1", "110:2", "110:3"]);
  assert.deepEqual(keysFor("تفسير المعوذتين").length, 11);
  assert.deepEqual(keysFor("the mu'awwidhatayn")[0], "113:1");
  assert.deepEqual(keysFor("سورة العصر"), ["103:1", "103:2", "103:3"]);
});

test("a long surah resolves to its opening and keeps the search", () => {
  const kahf = findNamedQuranPassage("Explain Surat al-Kahf");

  assert.equal(kahf.complete, false);
  assert.deepEqual(Array.from(kahf.verseKeys), ["18:1", "18:2", "18:3", "18:4", "18:5"]);
  assert.equal(findNamedQuranPassage("تفسير سورة الكهف").complete, false);
  assert.equal(findNamedQuranPassage("Ayat al-Kursi").complete, true);
});

test("a question pointing inside a long surah is left to the search", () => {
  assert.equal(findNamedQuranPassage("آية عن الصبر في سورة الكهف"), null);
  assert.equal(findNamedQuranPassage("قصة أصحاب الكهف في سورة الكهف"), null);
  assert.equal(findNamedQuranPassage("last ten verses of Surat al-Kahf"), null);
  assert.equal(findNamedQuranPassage("verse 5 of surah al-Mulk"), null);
});

test("a verse reference wins over a name", () => {
  assert.equal(findNamedQuranPassage("2:255"), null);
  assert.equal(findNamedQuranPassage("Ayat al-Kursi 2:255"), null);
});

test("words that only look like a surah name are not read as one", () => {
  for (const query of [
    "الإخلاص في العمل",
    "sincerity (ikhlas) in worship",
    "حقوق الناس",
    "صلاة العصر",
    "the light of faith",
    "ما هو الكرسي",
    "فاتحة خير",
    "Mehmed the Fatih",
    "النبي قال ايه عن الغضب",
    "kindness to animals",
    "إن مع العسر يسرا",
  ]) {
    assert.equal(findNamedQuranPassage(query), null, query);
  }
});

test("every named passage is small enough to fetch directly", () => {
  for (const query of ["آخر عشر آيات من سورة آل عمران", "المعوذتين", "أول عشر آيات من سورة الكهف"]) {
    assert.ok(findNamedQuranPassage(query).verseKeys.length <= 11, query);
  }
});
