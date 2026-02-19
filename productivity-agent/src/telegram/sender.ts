import { config } from "../config.js";
import type { InlineKeyboardMarkup } from "../types.js";
import { splitMessage } from "./formatters.js";

const BASE_URL = `https://api.telegram.org/bot${config.telegramBotToken}`;

async function callTelegramAPI(
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${BASE_URL}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API error [${method}]: ${data.description ?? "unknown"}`);
  }

  return data;
}

export async function sendMessage(
  text: string,
  options: {
    chatId?: string;
    parseMode?: "HTML" | "MarkdownV2";
    replyMarkup?: InlineKeyboardMarkup;
    disableWebPagePreview?: boolean;
  } = {}
): Promise<void> {
  const chatId = options.chatId ?? config.telegramChatId;
  const parseMode = options.parseMode ?? "HTML";

  // Handle messages that exceed Telegram's 4096 char limit
  const parts = splitMessage(text);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isLast = i === parts.length - 1;

    await callTelegramAPI("sendMessage", {
      chat_id: chatId,
      text: part,
      parse_mode: parseMode,
      disable_web_page_preview: options.disableWebPagePreview ?? true,
      // Only attach keyboard to the last message part
      ...(isLast && options.replyMarkup
        ? { reply_markup: options.replyMarkup }
        : {}),
    });
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  await callTelegramAPI("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function setWebhook(webhookUrl: string): Promise<void> {
  await callTelegramAPI("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
  });
}
