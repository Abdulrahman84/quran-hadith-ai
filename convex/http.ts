import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

type RunStatus = "completed" | "needs_review" | "failed";
type RunLanguage = "arabic" | "english";
type RunKind = "general" | "check";
type CheckType = "ayah" | "hadith";
type CheckOutcome = "exact" | "similar" | "not_found";

function boundedCount(value: unknown, maximum = 1000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), maximum);
}

function isStatus(value: unknown): value is RunStatus {
  return value === "completed" || value === "needs_review" || value === "failed";
}

function isLanguage(value: unknown): value is RunLanguage {
  return value === "arabic" || value === "english";
}

function isRunKind(value: unknown): value is RunKind {
  return value === "general" || value === "check";
}

function isCheckType(value: unknown): value is CheckType {
  return value === "ayah" || value === "hadith";
}

function isCheckOutcome(value: unknown): value is CheckOutcome {
  return value === "exact" || value === "similar" || value === "not_found";
}

function parseRun(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const runId = typeof value.runId === "string" ? value.runId.trim().slice(0, 100) : "";
  const question = typeof value.question === "string" ? value.question.trim().slice(0, 500) : "";
  const answerText = value.answerText === null
    ? null
    : typeof value.answerText === "string"
      ? value.answerText.trim().slice(0, 2000)
      : null;
  const citationCount = boundedCount(value.citationCount);
  const quranCount = boundedCount(value.quranCount);
  const tafsirCount = boundedCount(value.tafsirCount);
  const hadithCount = boundedCount(value.hadithCount);
  const warningCount = boundedCount(value.warningCount);
  const durationMs = boundedCount(value.durationMs, 10 * 60 * 1000);
  const runKind: RunKind = value.runKind === undefined ? "general" : isRunKind(value.runKind) ? value.runKind : "general";
  const checkType = isCheckType(value.checkType) ? value.checkType : undefined;
  const checkOutcome = isCheckOutcome(value.checkOutcome) ? value.checkOutcome : undefined;

  if (
    runId.length === 0 ||
    question.length === 0 ||
    !isLanguage(value.language) ||
    !isStatus(value.status) ||
    citationCount === null ||
    quranCount === null ||
    tafsirCount === null ||
    hadithCount === null ||
    warningCount === null ||
    durationMs === null
  ) {
    return null;
  }


  if (value.runKind !== undefined && !isRunKind(value.runKind)) return null;
  if (value.checkType !== undefined && !isCheckType(value.checkType)) return null;
  if (value.checkOutcome !== undefined && !isCheckOutcome(value.checkOutcome)) return null;
  if (runKind === "general" && (checkType || checkOutcome)) return null;
  if (runKind === "check" && !checkType) return null;
  if (runKind === "check" && value.status !== "failed" && !checkOutcome) return null;
  if (runKind === "check" && value.status === "failed" && checkOutcome) return null;

  return {
    runId,
    question,
    language: value.language,
    runKind,
    ...(checkType ? { checkType } : {}),
    ...(checkOutcome ? { checkOutcome } : {}),
    status: value.status,
    answerText,
    citationCount,
    quranCount,
    tafsirCount,
    hadithCount,
    warningCount,
    durationMs,
  };
}

const recordAnalytics = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.DASHBOARD_INGEST_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const run = parseRun(body);
  if (!run) return new Response("Invalid payload", { status: 400 });

  await ctx.runMutation(internal.questionRuns.recordRun, run);
  return new Response(null, { status: 202 });
});

const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/analytics/record", method: "POST", handler: recordAnalytics });

export default http;
