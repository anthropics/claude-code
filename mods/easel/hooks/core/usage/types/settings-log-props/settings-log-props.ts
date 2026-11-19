import type { Choice } from '../choice'

/**
 * The one entry of the event of a changed setting.
 */
export type SettingsLogProps = {
  /**
   * What the user changed about charts that nobody asks for.
   */
  auto_charts: Choice
}
