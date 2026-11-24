import type { GroundedAnswer } from "@/lib/retrieval/types";

import { completeLlmText, streamLlmText, type LlmCompletionResult } from "../provider";
import { createAnswerDraftForwarder, stripThinkingBlocks } from "./draft";
import { answerGuardFailure } from "./guardrails";
import { repairInstruction, systemPrompt, userPrompt } from "./prompts";
import { citationLabelsForText } from "./record-labels";
import type { AnswerDraftEvent, GenerateGroundedAnswerInput } from "./types";

export { answerReplacedWarningCode, createAnswerDraftForwarder, visibleDraftText } from "./draft";
export type { AnswerDraftEvent, GenerateGroundedAnswerInput } from "./types";

export type GenerateGroundedAnswerOptions = {
  /** Receives the model's draft as it streams. The returned answer stays authoritative. */
  onDraft?: (event: AnswerDraftEvent) => void;
  signal?: AbortSignal;
};

function disabledAnswer(): GroundedAnswer {
  return {
    status: "disabled",
    text: null,
    citations: [],
    warnings: [{ code: "openrouter_disabled", message: "OpenRouter answer generation is not configured." }],
  };
}

export function fallbackGroundedSummary(input: GenerateGroundedAnswerInput): GroundedAnswer {
  void input;

  return {
    status: "error",
    text: null,
    citations: [],
    warnings: [{ code: "llm_guardrail_fallback", message: "The model output was rejected without repeating source text." }],
  };
}

async function repairGroundedAnswer(
  input: GenerateGroundedAnswerInput,
  rejectedText: string,
  guardFailure: string,
  rejectedModel: string,
) {
  const completion = await completeLlmText({
    task: "answer",
    maxTokens: 420,
    temperature: 0.05,
    deprioritizeModels: [rejectedModel],
    acceptText: (candidateText) => {
      const text = stripThinkingBlocks(candidateText);

      return Boolean(text) && !answerGuardFailure(text, input);
    },
    messages: [
      { role: "system", content: systemPrompt(input.language) },
      { role: "user", content: userPrompt(input) },
      { role: "assistant", content: rejectedText },
      { role: "user", content: repairInstruction(guardFailure, input.language) },
    ],
  });

  if (completion.status !== "ok") {
    return { text: null, guardFailure: `repair_${completion.status}` };
  }

  const text = stripThinkingBlocks(completion.text);

  if (!text) {
    return { text: null, guardFailure: "repair_empty" };
  }

  const repairedGuardFailure = answerGuardFailure(text, input);

  return {
    text: repairedGuardFailure ? null : text,
    guardFailure: repairedGuardFailure,
  };
}

function readyGroundedAnswer(
  input: GenerateGroundedAnswerInput,
  text: string,
): GroundedAnswer {
  return {
    status: "ready",
    text,
    citations: citationLabelsForText(input.records, input.language, text),
    warnings: [],
  };
}

export async function generateGroundedAnswer(
  input: GenerateGroundedAnswerInput,
  options: GenerateGroundedAnswerOptions = {},
): Promise<GroundedAnswer> {
  if (input.records.length === 0) {
    return {
      status: "insufficient_sources",
      text: null,
      citations: [],
      warnings: [{ code: "insufficient_sources", message: "No retrieved records were available for answer generation." }],
    };
  }

  const request = {
    task: "answer" as const,
    maxTokens: 420,
    temperature: 0.3,
    messages: [
      { role: "system" as const, content: systemPrompt(input.language) },
      { role: "user" as const, content: userPrompt(input) },
    ],
  };

  if (!options.onDraft) {
    return composeGroundedAnswer(input, await completeLlmText(request));
  }

  const forwarder = createAnswerDraftForwarder(input, options.onDraft);
  const completion = await streamLlmText({ ...request, onDelta: forwarder.push, signal: options.signal });

  return forwarder.finalize(await composeGroundedAnswer(input, completion));
}

async function composeGroundedAnswer(
  input: GenerateGroundedAnswerInput,
  completion: LlmCompletionResult,
): Promise<GroundedAnswer> {
  if (completion.status === "disabled") {
    return disabledAnswer();
  }

  if (completion.status === "error") {
    const answer = fallbackGroundedSummary(input);

    return {
      ...answer,
      warnings: [{ code: "llm_error", message: completion.error }, ...answer.warnings],
    };
  }

  const text = stripThinkingBlocks(completion.text);

  if (!text) {
    return {
      status: "error",
      text: null,
      citations: [],
      warnings: [{ code: "llm_empty_answer", message: "The configured LLM provider returned an empty grounded answer." }],
    };
  }

  const guardFailure = answerGuardFailure(text, input);

  if (guardFailure) {
    const repair = await repairGroundedAnswer(input, text, guardFailure, completion.model);
    console.warn(
      `[grounded-answer] ${input.language} draft failed the ${guardFailure} guard; repair ${repair.text ? "succeeded" : `failed (${repair.guardFailure})`}.`,
    );

    if (repair.text) {
      return readyGroundedAnswer(input, repair.text);
    }

    const fallback = fallbackGroundedSummary(input);

    return {
      ...fallback,
      warnings: [{
        code: "llm_guardrail_fallback",
        message: `The model output failed the ${guardFailure} guard, and the repair ended with ${repair.guardFailure || "an unknown guard failure"}.`,
      }],
    };
  }

  return readyGroundedAnswer(input, text);
}
