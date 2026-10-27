import type { PromptComposeInput } from 'claude-code'

/**
 * The facts of one render of the system prompt, as the engine raises them.
 */
export const COMPOSED: PromptComposeInput = {
  model: 'example-model-1',
  promptModel: 'example-model-1',
  surfaces: ['terminal'],
  tools: ['Bash'],
  outputStyle: null,
  traits: [],
}
