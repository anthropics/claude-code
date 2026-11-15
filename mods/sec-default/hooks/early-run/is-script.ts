import type { Call } from './call.js'
import { CODE_TOOLS } from './code-tools.js'

/**
 * Whether a call runs a script. The rules allow one as a whole because the
 * session checks each call it makes, which a mod's own run of it would skip.
 *
 * @param call any call
 * @returns true for the script tool, under either name
 */
export const isScript = ({ tool }: Call): boolean =>
  CODE_TOOLS.get(tool) === 'code'
