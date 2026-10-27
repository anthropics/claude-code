import type { PromptSectionInput } from 'claude-code'

/**
 * The system prompt's memory section, as the engine asks for it.
 */
export const MEMORY: PromptSectionInput = {
  name: 'memory',
  text: 'the org says hi',
}
