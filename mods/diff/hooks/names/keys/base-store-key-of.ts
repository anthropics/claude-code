/**
 * The `$.store` key of a working tree's chosen comparison base, one per
 * `--show-toplevel` so a linked worktree keeps its own.
 *
 * @param toplevel the working tree's top-level path
 * @returns the key
 */
export const baseStoreKeyOf = (toplevel: string) => `base:${toplevel}`
