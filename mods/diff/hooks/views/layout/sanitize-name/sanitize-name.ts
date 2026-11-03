import { sanitizeLine } from '../sanitize-line'

/**
 * A path, preview or message made safe to draw as a name: sanitizeLine's
 * rule, which already drops every control, format and invisible character.
 *
 * Kept as its own word so a name's rule can tighten without touching the
 * diff body's.
 *
 * @param text the name as git, the transcript or an error gave it
 * @returns the drawable name
 */
export const sanitizeName = (text: string) => sanitizeLine(text)
