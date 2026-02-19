import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SYSTEM_PROMPT, buildAnalysisPrompt } from "./prompts.js";
import type { NormalizedIssue, ConversationMessage } from "../types.js";

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export async function analyzeForOneThing(
  issues: NormalizedIssue[]
): Promise<string> {
  const userMessage = buildAnalysisPrompt(issues);

  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  return extractText(response);
}

export async function handleFollowUp(
  history: ConversationMessage[],
  issues: NormalizedIssue[],
  userMessage: string
): Promise<string> {
  // Build a concise issue index for context
  const issueIndex = issues
    .map(
      (i) =>
        `[${i.identifier}] ${i.title} — ${i.priorityLabel}, ${i.state}${i.dueDate ? `, due ${i.dueDate}` : ""}`
    )
    .join("\n");

  // Synthetic opener to give Claude the task context
  const syntheticHistory: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `My current Linear tasks:\n${issueIndex}`,
    },
    {
      role: "assistant",
      content:
        "Got it. I have your task list and I'm applying The One Thing methodology.",
    },
  ];

  // Replay stored conversation
  const conversationMessages: Anthropic.MessageParam[] = history.map(
    (msg) => ({
      role: msg.role,
      content: msg.content,
    })
  );

  const response = await anthropic.messages.create({
    model: config.claudeModel,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      ...syntheticHistory,
      ...conversationMessages,
      { role: "user", content: userMessage },
    ],
  });

  return extractText(response);
}

function extractText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}
