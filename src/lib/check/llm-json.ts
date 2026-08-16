export function parseLlmJson(value: string) {
  const stripped = value
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const objectMatch = stripped.match(/\{[\s\S]*\}/);

  if (!objectMatch) {
    return null;
  }

  try {
    return JSON.parse(objectMatch[0]) as unknown;
  } catch {
    return null;
  }
}
