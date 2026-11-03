import type { StampedVerdict } from './stamped-verdict.js'

/**
 * The plugin the engine names on a `tool.check` ask, as the hook that made it.
 *
 * The released declarations this mod is checked against name neither this key
 * nor `e.approver` until the next release, so it reads the shape it needs.
 *
 * @param verdict a verdict
 * @returns the plugin, or undefined on an ask no hook made
 */
export const pluginOf = (verdict: StampedVerdict): string | undefined =>
  verdict.plugin
