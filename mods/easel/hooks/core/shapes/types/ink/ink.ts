import type Records from '../../records'

/**
 * Shapes name an ink, never a colour, so each surface picks its own value.
 */
export type Ink = keyof typeof Records.PALETTE
