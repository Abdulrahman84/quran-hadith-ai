# Retrieval evaluation

A fixed question set for measuring how well retrieval finds the right Quran and hadith records.
Use it to compare the current lexical (FTS) retrieval against hybrid or vector retrieval.

## Files

- `dataset-spec.json`: the questions, plus the text fragments that identify the correct sources.
- `build-dataset.mjs`: resolves those fragments against the real SQLite databases and writes `retrieval-questions.json`. Expected references are never typed in by hand. A fragment that matches nothing, or more than 40 records, fails the build.
- `retrieval-questions.json`: the generated dataset, checked in so runs stay comparable. Other tools (hadith-mcp) read it, so its format is fixed by `schemaVersion`. Change the format only by bumping that number.
- `results/`: one JSON report per run (gitignored).

## Running

```bash
npm run eval:retrieval -- --limit 5               # quick smoke test
npm run eval:retrieval -- --only topical          # one tag
npm run eval:retrieval                            # full run, retrievalMode "lexical"
npm run eval:retrieval -- --label hybrid          # full run against the hybrid backend
npm run eval:compare -- --modes lexical hybrid    # per-tag diff of the newest run of each mode
npm run eval:compare -- a.json b.json             # or two specific reports
```

`--label` sets the report's `retrievalMode` (default `lexical`), which also appears in the file name.
The label only names the run. Switch the actual backend through its own configuration before running.
For hybrid hadith search, run `HADITH_SEARCH_MODE=hybrid npm run eval:retrieval -- --label hybrid`. The script then
defaults `HADITH_MCP_EMBEDDINGS_PATH` to `hadith-embeddings.sqlite` next to `HADITH_MCP_DB_PATH`.

Each question runs through `searchSources`, which calls the OpenRouter router and hadith planner models.
With flash-lite the full set costs a few cents. It also starts the local Hadith MCP and Tafsir MCP.
When the `HADITH_MCP_*` variables are unset, the script points at a sibling `../hadith-mcp` checkout.

Rebuild the dataset after editing the spec or the source databases:

```bash
npm run eval:build-dataset
```

## Scoring

- A hadith hit means the returned record's `collection` and `hadithNumber` match exactly (for example `bukhari` / `1:1`).
- A Quran hit means the record's `verseKey` matches. A tafsir record on the expected ayah also counts.
- Many questions accept several references, such as the same hadith in different collections.
- **recall@1**: the top record is relevant. **recall@5**: at least `minExpected` relevant records (default 1) are in the top 5.
- **MRR**: mean of 1 / rank of the first relevant record. **any-hit**: something relevant came back at any rank.

## Tags

Every question has `tags = [kind, ...modifiers, corpus]`. The same values also appear as `kind` and `corpus` fields.

| Tag | Meaning |
|---|---|
| `exact-quote` | The question quotes the source text (matn or ayah wording) |
| `reference` | A verse reference or named verse ("2:255", "Ayat al-Kursi") |
| `paraphrase` | Restates one specific text in other words |
| `topical` | Names only a topic. Many records can be correct |
| `cross-lingual` | English question, with ground truth identified from the Arabic text |
| `source-limited` | The question explicitly limits the source (hadith/Sunnah, or Quran/verse/tafsir) |
| `hadith` / `quran` / `mixed` | Where the ground truth lives |

`eval:compare` reports recall@1, recall@5, MRR and latency for each tag and language. It compares only the questions
both runs answered, taking tags from the current dataset. It also lists questions that were fixed, regressed or re-ranked.
`paraphrase`, `topical` and `cross-lingual` are where lexical search is weakest and semantic retrieval should help most.

## Limits

- Ground truth only covers records that contain the chosen fragments. A relevant hadith with different wording counts as a miss. Add an extra rule to the spec when you find one.
- Model calls make runs slightly nondeterministic. Compare runs with the same models, and rerun outliers.
