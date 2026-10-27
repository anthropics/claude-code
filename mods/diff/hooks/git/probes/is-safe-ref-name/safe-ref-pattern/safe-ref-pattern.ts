/**
 * The refnames the HEAD poll will touch on disk: under `refs/`, of plain
 * name characters only, `/` between components.
 */
export const SAFE_REF_PATTERN = /^refs(?:\/[A-Za-z0-9_@+-][A-Za-z0-9._@+-]*)+$/
