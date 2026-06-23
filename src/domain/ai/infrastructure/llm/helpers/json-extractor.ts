export function cleanJsonString(str: string): string {
  const trimmed = str.trim();
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) {
    return trimmed;
  }

  const startIdx =
    firstBrace === -1
      ? firstBracket
      : firstBracket === -1
        ? firstBrace
        : Math.min(firstBrace, firstBracket);
  const charStack: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = startIdx; i < trimmed.length; i += 1) {
    const char = trimmed[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{" || char === "[") {
        charStack.push(char);
      } else if (char === "}") {
        if (charStack.length > 0 && charStack[charStack.length - 1] === "{") {
          charStack.pop();
        }
      } else if (char === "]") {
        if (charStack.length > 0 && charStack[charStack.length - 1] === "[") {
          charStack.pop();
        }
      }

      if (charStack.length === 0) {
        return trimmed.substring(startIdx, i + 1);
      }
    }
  }

  return trimmed.substring(startIdx);
}

export function extractJson(text: string): string {
  const trimmed = text.trim();
  let candidate = trimmed;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    candidate = match?.[1]?.trim() ?? trimmed;
  }
  return cleanJsonString(candidate);
}
