import type { Settings } from 'claude-code'

/**
 * What the world beneath a repository session holds and answers besides
 * git: the store, the settings, the environment, whether a pane is seated.
 */
export type Beneath = {
  /**
   * What the plugin's store holds at the start; nothing when not given.
   */
  stored?: Readonly<Record<string, unknown>>

  /**
   * What `$.settings.read` answers; empty when not given.
   */
  settings?: Settings

  /**
   * The variables `$.env.get` answers from; none set when not given.
   */
  env?: Readonly<Record<string, string>>

  /**
   * Whether an open made now is left waiting undrawn (LEFT_WAITING), as an
   * engine leaves an unasked open on a narrow terminal; placed when not given.
   */
  isLeftWaiting?: () => boolean
}
