import { kv } from "@vercel/kv";
import type { DailyConversation, NormalizedIssue, ConversationMessage } from "../types.js";

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function todayKey(): string {
  return `conversation:${new Date().toISOString().split("T")[0]}`;
}

export async function getToday(): Promise<DailyConversation | null> {
  return kv.get<DailyConversation>(todayKey());
}

export async function startNewDay(
  issues: NormalizedIssue[],
  analysisText: string
): Promise<void> {
  const conversation: DailyConversation = {
    date: new Date().toISOString().split("T")[0] as string,
    issues,
    messages: [
      {
        role: "assistant",
        content: analysisText,
        timestamp: Date.now(),
      },
    ],
    createdAt: Date.now(),
  };
  await kv.set(todayKey(), conversation, { ex: TTL_SECONDS });
}

export async function addMessage(
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const conversation = await getToday();
  if (!conversation) return;

  conversation.messages.push({ role, content, timestamp: Date.now() });
  await kv.set(todayKey(), conversation, { ex: TTL_SECONDS });
}

export async function resetToday(): Promise<void> {
  await kv.del(todayKey());
}

export async function getMessages(): Promise<ConversationMessage[]> {
  const conversation = await getToday();
  return conversation?.messages ?? [];
}

export async function getIssues(): Promise<NormalizedIssue[]> {
  const conversation = await getToday();
  return conversation?.issues ?? [];
}
