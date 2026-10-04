/**
 * What the pane's Buttons and Selects do, each closing over the plugin's
 * state in its register function.
 */
export type PaneActions = {
  /**
   * Docked, scrolls the body to this file's hunks; inline, picks the file
   * and opens its detail.
   */
  selectFile: (path: string) => void

  /**
   * Moves the docked list's window by so many files, clamped to the list.
   */
  scrollList: (delta: number) => void

  /**
   * Shows or hides the tests and generated files.
   */
  toggleNoise: () => void

  /**
   * Opens or closes the pre-session section.
   */
  togglePreSession: () => void

  /**
   * Moves the comparison base on to the next mode, round to the first.
   */
  cycleBase: () => void

  /**
   * Picks the source by its Select value: `current` or a turn's number.
   */
  chooseSource: (value: string) => void

  /**
   * Arms this file's diff for the next prompt, or disarms it.
   */
  toggleAsk: (path: string) => void
}
