/**
 * A render tree flattened to one searchable string: its JSON, so a test
 * finds words, theme keys and element names alike.
 *
 * @param tree what `$.ui.render` resolved to
 * @returns the JSON text
 */
export const jsonOf = (tree: unknown) => JSON.stringify(tree)
