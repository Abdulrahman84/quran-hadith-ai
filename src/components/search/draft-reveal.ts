/**
 * The answer model writes a short answer in well under a second and sends it in a few large
 * chunks, so showing chunks as they arrive looks like the text simply appears. The draft is
 * instead revealed word by word at a steady reading pace, a little faster when far behind.
 */
export const DRAFT_REVEAL_TICK_MS = 35;

/** Longest the final answer waits for the draft to finish revealing. */
export const DRAFT_REVEAL_MAX_WAIT_MS = 4000;

const BACKLOG_FOR_DOUBLE_SPEED = 160;
const BACKLOG_FOR_TRIPLE_SPEED = 480;

function wordsPerTick(backlog: number) {
  if (backlog > BACKLOG_FOR_TRIPLE_SPEED) {
    return 3;
  }

  return backlog > BACKLOG_FOR_DOUBLE_SPEED ? 2 : 1;
}

/** End index of the next word in `target` after `from`, including the whitespace that follows it. */
function nextWordEnd(target: string, from: number) {
  let index = from;

  while (index < target.length && /\s/.test(target[index]!)) {
    index += 1;
  }

  while (index < target.length && !/\s/.test(target[index]!)) {
    index += 1;
  }

  while (index < target.length && /\s/.test(target[index]!)) {
    index += 1;
  }

  return index;
}

/** How many characters of `target` should be visible after the next tick, given `shown` are now. */
export function nextRevealLength(target: string, shown: number) {
  let length = Math.min(Math.max(0, shown), target.length);
  const words = wordsPerTick(target.length - length);

  for (let word = 0; word < words && length < target.length; word += 1) {
    length = nextWordEnd(target, length);
  }

  return length;
}
