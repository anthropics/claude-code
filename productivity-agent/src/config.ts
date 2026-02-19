function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  // Linear
  linearApiKey: requireEnv("LINEAR_API_KEY"),

  // Telegram
  telegramBotToken: requireEnv("TELEGRAM_BOT_TOKEN"),
  telegramChatId: requireEnv("TELEGRAM_CHAT_ID"),

  // Anthropic
  anthropicApiKey: requireEnv("ANTHROPIC_API_KEY"),
  claudeModel: optionalEnv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929"),

  // Cron security
  cronSecret: process.env["CRON_SECRET"],

  // Timezone for display purposes
  timezone: optionalEnv("TIMEZONE", "America/New_York"),
} as const;
