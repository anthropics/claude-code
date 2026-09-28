import type { ApiContentBlock } from 'claude-code'

/**
 * The text block the organization's own plugin adds to a row it keeps.
 */
export const COUNTERSIGNATURE: ApiContentBlock = {
  type: 'text',
  text: '(countersigned)',
}
