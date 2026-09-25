import type { PromptComposeInput } from 'claude-code'

/**
 * The facts of one render of the system prompt, as the engine raises them.
 */
export const COMPOSED: PromptComposeInput = {
  model: 'claude-sonnet-5',
  promptModel: 'claude-sonnet-5',
  surfaces: ['terminal'],
  tools: ['Bash'],
  outputStyle: null,
  traits: [],
}
