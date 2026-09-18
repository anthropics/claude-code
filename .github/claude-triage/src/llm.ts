import Anthropic from "@anthropic-ai/sdk";

// Cost-optimized model selection:
// Haiku for per-issue triage (~$0.001/issue at volume)
// Sonnet for weekly digest synthesis (~$0.05/week)
const TRIAGE_MODEL =
  process.env.TRIAGE_MODEL ?? "claude-haiku-4-5-20251001";
const DIGEST_MODEL =
  process.env.DIGEST_MODEL ?? "claude-sonnet-4-6";

// ANTHROPIC_BASE_URL handled natively by SDK — Kimi swap = 1 env var
function createClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_BASE_URL
      ? { baseURL: process.env.ANTHROPIC_BASE_URL }
      : {}),
  });
}

export async function triageIssue(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const client = createClient();
  const message = await client.messages.create({
    model: TRIAGE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response");
  return block.text;
}

export async function generateDigest(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const client = createClient();
  const message = await client.messages.create({
    model: DIGEST_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  });
  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected non-text response");
  return block.text;
}
