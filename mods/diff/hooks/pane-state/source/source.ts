/**
 * What the pane lists: the repository's diff now, or one past turn's edits.
 */
export type Source = { kind: 'current' } | { kind: 'turn'; index: number }
