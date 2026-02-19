// Normalized Linear issue -- only fields needed by the AI
export interface NormalizedIssue {
  id: string;
  identifier: string;       // e.g. "ENG-1234"
  title: string;
  description: string | null;
  priority: number;         // 0=none, 1=urgent, 2=high, 3=medium, 4=low
  priorityLabel: string;    // "Urgent", "High", "Medium", "Low", "No priority"
  state: string;            // "In Progress", "Todo", "Backlog", etc.
  dueDate: string | null;   // ISO date string YYYY-MM-DD
  estimate: number | null;  // story points
  labels: string[];
  projectName: string | null;
  url: string;
  createdAt: string;
  updatedAt: string;
}

// A single message in the conversation history
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// Full conversation state for one day, stored in Vercel KV
export interface DailyConversation {
  date: string;                      // YYYY-MM-DD
  issues: NormalizedIssue[];         // Issues fetched that morning
  messages: ConversationMessage[];   // Full conversation history (first message is the analysis)
  createdAt: number;
}

// Telegram Update types (minimal -- only what we use)
export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; first_name: string };
  chat: { id: number };
  text?: string;
  date: number;
}

export interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message?: TelegramMessage;
  data?: string;
}

// Inline keyboard types
export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}
