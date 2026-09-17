/**
 * One `$.ui.toast` call as the plugin made it: the text and, when it named
 * one, how long the bar keeps it.
 */
export type ToastAsked = {
  text: string
  timeoutMs?: number
}
