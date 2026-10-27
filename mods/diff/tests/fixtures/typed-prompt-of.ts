import type { PromptSubmitInput } from 'claude-code'

/**
 * A prompt as the person submits it from the composer with a plain Enter,
 * carrying the context given, if any.
 *
 * @param text what the person typed
 * @param context what already rides beside the prompt
 * @returns the `prompt.submit` input
 */
export const typedPromptOf = (
  text: string,
  context?: readonly string[],
): PromptSubmitInput => ({
  text,
  ...(context && { context }),
  wait: false,
  origin: { kind: 'composer' },
})
