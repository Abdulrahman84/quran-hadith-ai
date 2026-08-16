import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const runStatus = v.union(
  v.literal("completed"),
  v.literal("needs_review"),
  v.literal("failed"),
);

const runLanguage = v.union(v.literal("arabic"), v.literal("english"));

const runKind = v.union(v.literal("general"), v.literal("check"));
const checkType = v.union(v.literal("ayah"), v.literal("hadith"));
const checkOutcome = v.union(
  v.literal("exact"),
  v.literal("similar"),
  v.literal("not_found"),
);

export default defineSchema({
  ...authTables,
  questionRuns: defineTable({
    runId: v.string(),
    question: v.string(),
    language: runLanguage,
    runKind: v.optional(runKind),
    checkType: v.optional(checkType),
    checkOutcome: v.optional(checkOutcome),
    status: runStatus,
    answerText: v.union(v.string(), v.null()),
    citationCount: v.number(),
    sourceCount: v.number(),
    quranCount: v.number(),
    tafsirCount: v.number(),
    hadithCount: v.number(),
    warningCount: v.number(),
    durationMs: v.number(),
    occurredAt: v.number(),
    isDemo: v.boolean(),
  })
    .index("by_run_id", ["runId"])
    .index("by_occurred_at", ["occurredAt"])
    .index("by_status_and_occurred_at", ["status", "occurredAt"])
    .index("by_is_demo_and_occurred_at", ["isDemo", "occurredAt"])
    .index("by_is_demo_status_and_occurred_at", ["isDemo", "status", "occurredAt"])
    .searchIndex("search_question", {
      searchField: "question",
      filterFields: ["isDemo", "status"],
    }),
});
