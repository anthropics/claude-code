export class ClaudeJsonError extends Error {
  constructor(message: string, public raw: string) {
    super(message);
    this.name = "ClaudeJsonError";
  }
}

/**
 * Robustly extract a JSON object from a Claude text response.
 *
 * Tries, in order:
 *   1. Direct JSON.parse of the trimmed text
 *   2. Stripping ```json / ``` code fences, then parse
 *   3. Bracket-counting the first balanced {...} substring, then parse
 *
 * Throws ClaudeJsonError if nothing parses.
 */
export function parseJson<T>(text: string): T {
  const trimmed = text.trim();

  // 1) Direct parse
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through
  }

  // 2) Strip fenced code blocks
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {
      // fall through
    }
  }

  // 3) Balanced-brace extraction of the first JSON object
  const extracted = extractFirstJsonObject(trimmed);
  if (extracted) {
    try {
      return JSON.parse(extracted) as T;
    } catch {
      // fall through
    }
  }

  throw new ClaudeJsonError("Failed to parse JSON from Claude response", text);
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}
