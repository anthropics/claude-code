/**
 * A `tool.check` verdict, read for the plugin that made its ask.
 *
 * `decision` keeps the type from being all-optional, which a verdict fails.
 */
export type StampedVerdict = {
  decision: string
  plugin?: string
}
