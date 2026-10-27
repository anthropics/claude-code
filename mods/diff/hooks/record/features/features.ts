/**
 * The feature names the plugin marks, kept as the built-in panel's so the
 * feature surface keeps one series across the swap.
 *
 * `read` per fetch round, `tabSwitch` per `/diff` open or close and per
 * close by the pane's own control, `baseSwitch` per base pick, `baseResolve`
 * on the first resolve and the first failure, `selectionAttach` per diff
 * asked.
 */
export const FEATURES = {
  read: 'repl_diff_read',
  tabSwitch: 'repl_tab_switch',
  baseSwitch: 'repl_diff_base_switch',
  baseResolve: 'diff_base_resolve',
  selectionAttach: 'diff_selection_attach',
} as const
