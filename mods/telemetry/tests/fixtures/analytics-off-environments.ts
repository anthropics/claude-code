/**
 * One environment per switch that turns Claude Code's analytics off: the
 * plugin sends nothing under any of them.
 */
export const ANALYTICS_OFF_ENVIRONMENTS: readonly Readonly<
  Record<string, string>
>[] = [
  { DISABLE_TELEMETRY: '0' },
  { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
  { DO_NOT_TRACK: 'true' },
  { CLAUDE_CODE_USE_BEDROCK: '1' },
  { CLAUDE_CODE_USE_VERTEX: 'yes' },
  { CLAUDE_CODE_USE_FOUNDRY: 'on' },
  { CLAUDE_CODE_USE_ANTHROPIC_AWS: 'TRUE' },
  { CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD: '1' },
  { CLAUDE_CODE_USE_MANTLE: '1' },
  { CLAUDE_CODE_CUSTOM_OAUTH_URL: 'https://auth.example.invalid' },
]
