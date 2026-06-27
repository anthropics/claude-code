import Anthropic from "@anthropic-ai/sdk";
import { parseJson } from "./parseJson";

const DEFAULT_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (client) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your_key_here") {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to rafid-prompt-tool/.env.local and restart the dev server.",
    );
  }

  client = new Anthropic({ apiKey });
  return client;
}

export type CallClaudeOptions = {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
};

/**
 * Call Claude and return the response parsed as JSON of type T.
 * Uses the model from process.env.ANTHROPIC_MODEL if set, otherwise DEFAULT_MODEL.
 */
export async function callClaudeJSON<T>({
  system,
  user,
  maxTokens = 1024,
  temperature = 0.4,
}: CallClaudeOptions): Promise<T> {
  const anthropic = getClient();
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  return parseJson<T>(textBlock.text);
}
