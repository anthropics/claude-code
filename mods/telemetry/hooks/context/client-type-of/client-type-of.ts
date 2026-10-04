import type { Facts } from '../../facts'
import IsAnalyticsOff from '../../is-analytics-off'
import { CLIENT_TYPE_BY_ENTRYPOINT } from './client-type-by-entrypoint'

/**
 * The row's `client_type` as the CLI decides it at start: a GitHub Action,
 * an SDK or host by entrypoint, `remote` with an ingress token, else `cli`.
 *
 * @param facts the variables as read once for the session
 * @returns the client type
 */
export function clientTypeOf(facts: Facts) {
  const isRemote =
    facts.entrypoint === 'remote' ||
    facts.hasSessionAccessToken ||
    facts.hasSessionIngressTokenFile ||
    facts.hasWebsocketAuthFileDescriptor ||
    IsAnalyticsOff.isEnvTruthy(facts.claudeCodeRemote)

  const isGithubAction = IsAnalyticsOff.isEnvTruthy(facts.githubActions)

  return isGithubAction
    ? 'github-action'
    : (CLIENT_TYPE_BY_ENTRYPOINT[facts.entrypoint ?? ''] ??
        (isRemote ? 'remote' : 'cli'))
}
