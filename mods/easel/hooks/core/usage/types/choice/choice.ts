/**
 * One word out of a closed list, as the host's log takes a choice.
 */
export type Choice = {
  /**
   * The word chosen.
   */
  value: string

  /**
   * Every word the choice could be.
   */
  of: readonly string[]
}
