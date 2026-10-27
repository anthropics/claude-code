import type { DeploymentSignal } from './deployment-signal'
import { DEPLOYMENTS } from './deployments'

/**
 * The row's `deployment_environment`: the first deployment in the CLI's
 * order whose signal holds, else `unknown-<platform>` as it names none.
 *
 * @param signals each deployment read, with whether its signal holds
 * @param platform the row's platform, for the fallback
 * @returns the deployment's name
 */
export const deploymentOf = (
  signals: readonly DeploymentSignal[],
  platform: string,
) =>
  DEPLOYMENTS.find(deployment =>
    signals.some(([name, isHeld]) => isHeld && name === deployment),
  ) ?? `unknown-${platform}`
