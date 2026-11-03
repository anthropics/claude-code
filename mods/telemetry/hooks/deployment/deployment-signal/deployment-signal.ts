import type { DeploymentName } from '../deployment-name'

/**
 * One deployment and whether its signal holds: a variable set, on, or
 * holding the value the CLI looks for, or one of the two marker files.
 */
export type DeploymentSignal = readonly [DeploymentName, boolean]
