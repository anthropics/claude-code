export const TARGET_AIS = ["ChatGPT", "Claude", "Gemini", "Midjourney"] as const;
export type TargetAI = (typeof TARGET_AIS)[number];

export const GOALS = ["Write", "Code", "Design", "Research", "Brainstorm"] as const;
export type Goal = (typeof GOALS)[number];

export type Mode = "quick" | "deep";

export type OptimiseResponse = {
  optimised: string;
  explanation: string;
};

export type QuestionsResponse = {
  questions: string[];
};

export type ApiError = {
  error: string;
};

export type UsageRecord = {
  count: number;
  date: string; // YYYY-MM-DD (UTC)
};

export const DAILY_LIMIT = 3;
