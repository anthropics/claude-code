import { FILE_HEADER_START } from '../file-header-start'

/**
 * How a patch's opening line starts when git quoted the name in it: a name
 * holding a double quote, a backslash or a control character.
 */
export const QUOTED_HEADER_START = `${FILE_HEADER_START}"`
