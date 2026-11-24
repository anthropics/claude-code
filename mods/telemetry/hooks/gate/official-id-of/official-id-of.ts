import type { NextOrigin } from 'claude-code'

/**
 * The id of the installed plugin that made a call, where the host holds the
 * load that made it as official.
 *
 * @param origin who raised the call, as the host stamped it
 * @returns the id its rows are stamped with; undefined for any other caller
 */
export const officialIdOf = (origin: NextOrigin) =>
  origin.isOfficial === true ? origin.pluginId : undefined
