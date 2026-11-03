/**
 * A plain Button's face and what pressing it does.
 */
export type Pressable = {
  label: string

  /**
   * Runs on a click or Enter.
   */
  onPress: () => void
}
