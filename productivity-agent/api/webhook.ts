import type { VercelRequest, VercelResponse } from "@vercel/node";
import { config } from "../src/config.js";
import { fetchMyIssues } from "../src/linear/issues.js";
import { analyzeForOneThing, handleFollowUp } from "../src/ai/analyzer.js";
import * as store from "../src/conversation/store.js";
import { sendMessage, answerCallbackQuery } from "../src/telegram/sender.js";
import { formatAnalysis, formatTaskList, markdownToHTML } from "../src/telegram/formatters.js";
import { analysisKeyboard, disagreeKeyboard } from "../src/telegram/keyboards.js";
import type { TelegramUpdate } from "../src/types.js";

const MAX_TURNS = 20;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only accept POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const update = req.body as TelegramUpdate;

  // Route to the appropriate handler
  try {
    if (update.message) {
      await handleMessage(update);
    } else if (update.callback_query) {
      await handleCallbackQuery(update);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    // Always return 200 to Telegram so it doesn't retry
  }

  res.status(200).json({ ok: true });
}

// ─────────────────────────────────────────────────────────────
// Message handler
// ─────────────────────────────────────────────────────────────

async function handleMessage(update: TelegramUpdate): Promise<void> {
  const message = update.message!;
  const chatId = String(message.chat.id);
  const text = message.text ?? "";

  // Security: only respond to the authorized user
  if (chatId !== config.telegramChatId) return;

  // Route by command or treat as conversation
  if (text.startsWith("/")) {
    await handleCommand(text.split(" ")[0]?.toLowerCase() ?? "", chatId);
  } else {
    await handleConversation(text, chatId);
  }
}

async function handleCommand(command: string, chatId: string): Promise<void> {
  switch (command) {
    case "/start":
    case "/help":
      await sendMessage(
        `<b>The ONE Thing — Productivity Agent</b>\n\n` +
          `Every morning I analyze your Linear tasks and identify the single most important thing to focus on today.\n\n` +
          `<i>"What's the ONE Thing I can do such that by doing it everything else will be easier or unnecessary?"</i>\n\n` +
          `<b>Commands:</b>\n` +
          `/onething — Get today's ONE thing\n` +
          `/tasks — List your current Linear tasks\n` +
          `/refresh — Re-fetch tasks and re-analyze\n` +
          `/reset — Clear today's conversation\n` +
          `/help — Show this message`,
        { chatId }
      );
      break;

    case "/onething":
      await runAnalysis(chatId);
      break;

    case "/tasks":
      await listTasks(chatId);
      break;

    case "/refresh":
      await store.resetToday();
      await runAnalysis(chatId);
      break;

    case "/reset":
      await store.resetToday();
      await sendMessage(
        "Conversation cleared. Use /onething to start fresh.",
        { chatId }
      );
      break;

    default:
      await sendMessage(
        `Unknown command. Use /help to see available commands.`,
        { chatId }
      );
  }
}

async function handleConversation(
  userText: string,
  chatId: string
): Promise<void> {
  const messages = await store.getMessages();
  const issues = await store.getIssues();

  // No conversation started yet — prompt to run analysis
  if (messages.length === 0) {
    await sendMessage(
      `No analysis for today yet. Use /onething to get started.`,
      { chatId }
    );
    return;
  }

  // Enforce turn limit
  if (messages.length >= MAX_TURNS) {
    await sendMessage(
      `We've had a long conversation today! Use /refresh to start a new analysis.`,
      { chatId }
    );
    return;
  }

  await store.addMessage("user", userText);

  const reply = await handleFollowUp(messages, issues, userText);
  await store.addMessage("assistant", reply);

  await sendMessage(markdownToHTML(reply), { chatId });
}

// ─────────────────────────────────────────────────────────────
// Callback query handler (inline keyboard buttons)
// ─────────────────────────────────────────────────────────────

async function handleCallbackQuery(update: TelegramUpdate): Promise<void> {
  const query = update.callback_query!;
  const chatId = String(query.from.id);
  const data = query.data ?? "";

  if (chatId !== config.telegramChatId) {
    await answerCallbackQuery(query.id);
    return;
  }

  await answerCallbackQuery(query.id);

  const messages = await store.getMessages();
  const issues = await store.getIssues();

  let followUpPrompt: string;

  switch (data) {
    case "elaborate":
      followUpPrompt =
        "Can you elaborate on why this is the lead domino? Give me more depth on the reasoning.";
      break;

    case "runner_up":
      followUpPrompt =
        "Tell me more about the runner-up task. When should I consider switching to it instead?";
      break;

    case "disagree":
      await sendMessage(
        "What's your concern? Choose one or just reply with your reasoning:",
        { chatId, replyMarkup: disagreeKeyboard() }
      );
      return;

    case "disagree_blocked":
      followUpPrompt =
        "I'm currently blocked on the suggested task and can't make progress on it today. Given that, what should my ONE thing be?";
      break;

    case "disagree_new":
      followUpPrompt =
        "Something else has come up since this morning. I'll explain in my next message — please hold the recommendation and wait for my context.";
      await sendMessage(
        "Go ahead — tell me what came up and I'll reconsider.",
        { chatId }
      );
      return;

    case "disagree_done":
      followUpPrompt =
        "I've actually already completed the suggested task. What should my ONE thing be now?";
      break;

    case "disagree_freeform":
      await sendMessage(
        "Tell me why you disagree and I'll reconsider with your input.",
        { chatId }
      );
      return;

    case "refresh":
      await store.resetToday();
      await runAnalysis(chatId);
      return;

    default:
      return;
  }

  await store.addMessage("user", followUpPrompt);
  const reply = await handleFollowUp(messages, issues, followUpPrompt);
  await store.addMessage("assistant", reply);

  await sendMessage(markdownToHTML(reply), { chatId });
}

// ─────────────────────────────────────────────────────────────
// Core actions
// ─────────────────────────────────────────────────────────────

async function runAnalysis(chatId: string): Promise<void> {
  await sendMessage("Fetching your Linear tasks...", { chatId });

  const issues = await fetchMyIssues();

  if (issues.length === 0) {
    await sendMessage(
      "No active Linear tasks found. Enjoy a focused day! ✨",
      { chatId }
    );
    return;
  }

  const analysis = await analyzeForOneThing(issues);
  await store.startNewDay(issues, analysis);

  // Find the chosen issue URL from the analysis text (best-effort)
  const firstIssue = issues[0];
  const chosenUrl = firstIssue?.url ?? "";

  const formattedMessage = formatAnalysis(analysis, chosenUrl);

  await sendMessage(formattedMessage, {
    chatId,
    replyMarkup: analysisKeyboard(),
  });
}

async function listTasks(chatId: string): Promise<void> {
  // Try cached issues first to avoid redundant API calls
  let issues = await store.getIssues();

  if (issues.length === 0) {
    await sendMessage("Fetching your Linear tasks...", { chatId });
    issues = await fetchMyIssues();
  }

  await sendMessage(formatTaskList(issues), { chatId });
}
