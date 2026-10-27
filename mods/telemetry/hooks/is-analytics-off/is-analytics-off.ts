import type { Environment } from '../environment'
import type { PolicyPins } from '../policy-pins'
import { isEnvSet } from './is-env-set'
import { isEnvTruthy } from './is-env-truthy'

/**
 * Whether the CLI's own analytics would be off here, read off the
 * environment and the managed policy: then the plugin sends nothing either.
 *
 * Off under test, when DISABLE_TELEMETRY or the nonessential-traffic switch
 * is set at all or DO_NOT_TRACK is on, on a third-party provider the host
 * does not manage, on a gateway, and on a deployment with its own OAuth URL.
 *
 * @param environment the switches as read for this batch
 * @param policy the managed settings' gateway pins
 * @returns true when no row may be sent
 */
export function isAnalyticsOff(environment: Environment, policy: PolicyPins) {
  const isPrivate =
    environment.nodeEnv === 'test' ||
    isEnvSet(environment.disableTelemetry) ||
    isEnvSet(environment.disableNonessentialTraffic) ||
    isEnvTruthy(environment.doNotTrack)

  const isThirdParty =
    !isEnvTruthy(environment.providerManagedByHost) &&
    [
      environment.useBedrock,
      environment.useVertex,
      environment.useFoundry,
      environment.useAnthropicAws,
      environment.useAnthropicGoogleCloud,
      environment.useMantle,
    ].some(isEnvTruthy)

  const isGateway =
    isEnvTruthy(environment.useGateway) ||
    policy.forceLoginMethod === 'gateway' ||
    policy.forceLoginGatewayUrl !== undefined

  const isCustomDeployment = isEnvSet(environment.customOauthUrl?.trim())

  return isPrivate || isThirdParty || isGateway || isCustomDeployment
}
