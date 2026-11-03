import type { DEPLOYMENTS } from '../deployments'

/**
 * One of the deployments a row can name (DEPLOYMENTS).
 */
export type DeploymentName = (typeof DEPLOYMENTS)[number]
