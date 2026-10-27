import Layout from '../../../layout'

/**
 * A hunk line made safe for a `Code` source: its marker and its tabs kept,
 * the engine laying tabs out as it does every diff it draws.
 *
 * Between the tabs sanitizeLine's rule holds: every control, format and
 * invisible character dropped, so nothing can reorder or hide the line.
 *
 * @param line a body line, its `+`, `-` or space marker first
 * @returns the drawable line
 */
export const drawnLineOf = (line: string) =>
  line.slice(0, 1) +
  line.slice(1).split('\t').map(Layout.sanitizeLine).join('\t')
