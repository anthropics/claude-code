import { readFile } from 'fs/promises'
import memoize from 'lodash-es/memoize.js'
import type { ToolPermissionContext } from '../Tool.js'
import { jsonStringify } from '../utils/slowOperations.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from './analytics/index.js'

/**
 * Get the current Kubernetes namespace:
 * Returns null on laptops/local development,
 * "default" for devboxes in default namespace,
 * "ts" for devboxes in ts namespace,
 * ...
 */
const getKubernetesNamespace = memoize(async (): Promise<string | null> => {
  if (process.env.USER_TYPE !== 'ant') {
    return null
  }
  const namespacePath =
    '/var/run/secrets/kubernetes.io/serviceaccount/namespace'
  const namespaceNotFound = 'namespace not found'
  try {
    const content = await readFile(namespacePath, { encoding: 'utf8' })
    return content.trim()
  } catch {
    return namespaceNotFound
  }
})

/**
 * Get the OCI container ID from within a running container
 */
export const getContainerId = memoize(async (): Promise<string | null> => {
  if (process.env.USER_TYPE !== 'ant') {
    return null
  }
  const containerIdPath = '/proc/self/mountinfo'
  const containerIdNotFound = 'container ID not found'
  const containerIdNotFoundInMountinfo = 'container ID not found in mountinfo'
  try {
    const mountinfo = (
      await readFile(containerIdPath, { encoding: 'utf8' })
    ).trim()

    // Pattern to match both Docker and containerd/CRI-O container IDs
    // Docker: /docker/containers/[64-char-hex]
    // Containerd: /sandboxes/[64-char-hex]
    const containerIdPattern =
      /(?:\/docker\/containers\/|\/sandboxes\/)([0-9a-f]{64})/

    const lines = mountinfo.split('\n')

    for (const line of lines) {
      const match = line.match(containerIdPattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    return containerIdNotFoundInMountinfo
  } catch {
    return containerIdNotFound
  }
})

/**
 * Logs an event with the current namespace and tool permission context
 */
export async function logPermissionContextForAnts(
  toolPermissionContext: ToolPermissionContext | null,
  moment: 'summary' | 'initialization',
): Promise<void> {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  void logEvent('tengu_internal_record_permission_context', {
    moment:
      moment as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    namespace:
      (await getKubernetesNamespace()) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    toolPermissionContext: jsonStringify(
      toolPermissionContext,
    ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    containerId:
      (await getContainerId()) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
}
