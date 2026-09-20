/**
 * What the plugin reads of the environment before each batch: the
 * build's user type and every switch that turns the CLI's analytics off.
 *
 * Each field is the variable's value as `$.env.get` answers it, undefined
 * when unset; is-analytics-off/ decides what they mean together.
 */
export type Environment = {
  readonly userType: string | undefined
  readonly nodeEnv: string | undefined
  readonly disableTelemetry: string | undefined
  readonly disableNonessentialTraffic: string | undefined
  readonly doNotTrack: string | undefined
  readonly customOauthUrl: string | undefined
  readonly useGateway: string | undefined
  readonly providerManagedByHost: string | undefined
  readonly useBedrock: string | undefined
  readonly useVertex: string | undefined
  readonly useFoundry: string | undefined
  readonly useAnthropicAws: string | undefined
  readonly useAnthropicGoogleCloud: string | undefined
  readonly useMantle: string | undefined
}
