import Words from './words'

/**
 * A session may list the tool late or never, and the prompt must not change
 * when it does, so the sentence names the tool on a condition the model can
 * check.
 */
export const SYSTEM_PROMPT_HINT =
  `If a tool named ${Words.TOOL_NAME} is ` +
  `available, call it when numbers over ` +
  `time or across categories would be ` +
  `clearer as a chart.`
