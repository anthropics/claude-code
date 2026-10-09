/**
 * The events whose subject names who provides it: the hook on each lets an
 * organization's subject continue past the user tier.
 */
export const SUBJECT_EVENTS = Object.freeze([
  'tool.describe',
  'command.describe',
  'agent.offer',
  'agent.spawn',
] as const)
