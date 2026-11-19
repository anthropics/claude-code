import type { EngineInterface } from 'claude-code'

/**
 * The person's settings as the host hands them to a plugin.
 */
export type SettingsRead = Awaited<
  ReturnType<EngineInterface['settings']['read']>
>
