import Names from '../names'

/**
 * What `session.start` hands `$.command.register`: the one place the
 * `/diff` spec is built, where a later CommandSpec field joins.
 */
export const COMMAND_SPEC = {
  name: Names.COMMAND_NAME,
  description: Names.COMMAND_DESCRIPTION,
} as const
