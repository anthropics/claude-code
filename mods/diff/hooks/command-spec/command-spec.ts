import Names from '../names'

/**
 * What `session.start` hands `$.command.register`: `/diff` typed during a
 * turn waits for the turn to end.
 */
export const COMMAND_SPEC = {
  name: Names.COMMAND_NAME,
  description: Names.COMMAND_DESCRIPTION,
} as const
