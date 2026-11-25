import { Fragment } from "react";

// Isolates Latin runs inside Arabic text, such as "(Embeddings)" or
// "meeAtif on Hugging Face" names, or domains like "openrouter.ai", so words,
// dots and brackets keep left-to-right order.
const latinTermInParentheses =
  /(\([A-Za-z][A-Za-z.\s-]*\)|[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*(?:\s+[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)*)*)/;

export function LtrTerms({ text }: { text: string }) {
  return text.split(latinTermInParentheses).map((part, index) =>
    latinTermInParentheses.test(part) ? (
      <bdi dir="ltr" key={index}>
        {part}
      </bdi>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
