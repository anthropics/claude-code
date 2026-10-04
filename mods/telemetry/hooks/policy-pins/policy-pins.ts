/**
 * The two managed-settings keys that pin a session to a cloud gateway, as
 * `$.settings.read({ source: "policy" })` answers them.
 *
 * A session so pinned sends its rows nowhere, as the CLI's own analytics do.
 */
export type PolicyPins = {
  readonly forceLoginMethod?: unknown
  readonly forceLoginGatewayUrl?: unknown
}
