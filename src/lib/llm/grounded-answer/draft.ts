import type { GroundedAnswer } from "@/lib/retrieval/types";

import { removeFillerSentences } from "./filler";
import { draftGuardFailure } from "./guardrails";
import type { AnswerDraftEvent, GenerateGroundedAnswerInput } from "./types";

export const answerReplacedWarningCode = "answer_replaced_after_check";

export function stripThinkingBlocks(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

/** Draft text safe to show while streaming: no thinking blocks or half-written tags and citation markers. */
export function visibleDraftText(rawText: string) {
  let text = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const openThinkIndex = text.search(/<think>/i);

  if (openThinkIndex >= 0) {
    text = text.slice(0, openThinkIndex);
  }

  return text
    .replace(/<(?:\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?)?$/i, "")
    .replace(/\[\d*$/, "")
    .trimStart();
}

export function createAnswerDraftForwarder(input: GenerateGroundedAnswerInput, onDraft: (event: AnswerDraftEvent) => void) {
  let rawText = "";
  let shownText = "";
  let withdrawn = false;
  let everShown = false;

  const withdraw = () => {
    if (shownText) {
      onDraft({ type: "reset" });
      shownText = "";
    }
  };

  return {
    push(delta: string) {
      rawText += delta;

      if (withdrawn) {
        return;
      }

      const visibleText = visibleDraftText(rawText);

      if (draftGuardFailure(visibleText, input)) {
        withdrawn = true;
        withdraw();
        return;
      }

      if (!visibleText.startsWith(shownText)) {
        withdraw();
      }

      const addition = visibleText.slice(shownText.length);

      if (addition) {
        onDraft({ type: "delta", text: addition });
        shownText = visibleText;
        everShown = true;
      }
    },
    /** Marks the final answer as a replacement when it differs from what the reader saw. */
    finalize(answer: GroundedAnswer): GroundedAnswer {
      // Dropping filler sentences is cleanup, not a correction against the sources, so it doesn't count as replacing the draft.
      const keptDraft = answer.status === "ready"
        && !withdrawn
        && answer.text === removeFillerSentences(shownText.trim(), input.language);

      if (!everShown || keptDraft) {
        return answer;
      }

      withdraw();

      return {
        ...answer,
        warnings: [
          ...answer.warnings,
          { code: answerReplacedWarningCode, message: "The streamed draft was replaced after checking it against the sources." },
        ],
      };
    },
  };
}
