import { posix, win32 } from 'path'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { logForDebugging } from './debug.js'
import { isEnvTruthy } from './envUtils.js'
import { getPlatform } from './platform.js'

// Track warnings to avoid spam — bounded to prevent unbounded memory growth
export const MAX_WARNING_KEYS = 1000
const warningCounts = new Map<string, number>()

// Check if running from a build directory (development mode)
// This is a sync version of the logic in getCurrentInstallationType()
function isRunningFromBuildDirectory(): boolean {
  let invokedPath = process.argv[1] || ''
  let execPath = process.execPath || process.argv[0] || ''

  // On Windows, convert backslashes to forward slashes for consistent path matching
  if (getPlatform() === 'windows') {
    invokedPath = invokedPath.split(win32.sep).join(posix.sep)
    execPath = execPath.split(win32.sep).join(posix.sep)
  }

  const pathsToCheck = [invokedPath, execPath]
  const buildDirs = [
    '/build-ant/',
    '/build-external/',
    '/build-external-native/',
    '/build-ant-native/',
  ]

  return pathsToCheck.some(path => buildDirs.some(dir => path.includes(dir)))
}

// Warnings we know about and want to suppress from users
const INTERNAL_WARNINGS = [
  /MaxListenersExceededWarning.*AbortSignal/,
  /MaxListenersExceededWarning.*EventTarget/,
]

function isInternalWarning(warning: Error): boolean {
  const warningStr = `${warning.name}: ${warning.message}`
  return INTERNAL_WARNINGS.some(pattern => pattern.test(warningStr))
}

// Store reference to our warning handler so we can detect if it's already installed
let warningHandler: ((warning: Error) => void) | null = null

// For testing only - allows resetting the warning handler state
export function resetWarningHandler(): void {
  if (warningHandler) {
    process.removeListener('warning', warningHandler)
  }
  warningHandler = null
  warningCounts.clear()
}

export function initializeWarningHandler(): void {
  // Only set up handler once - check if our handler is already installed
  const currentListeners = process.listeners('warning')
  if (warningHandler && currentListeners.includes(warningHandler)) {
    return
  }

  // For external users, remove default Node.js handler to suppress stderr output
  // For internal users, only keep default warnings for development builds
  // Check development mode directly to avoid async call in init
  // This preserves the same logic as getCurrentInstallationType() without async
  const isDevelopment =
    process.env.NODE_ENV === 'development' || isRunningFromBuildDirectory()
  if (!isDevelopment) {
    process.removeAllListeners('warning')
  }

  // Create and store our warning handler
  warningHandler = (warning: Error) => {
    try {
      const warningKey = `${warning.name}: ${warning.message.slice(0, 50)}`
      const count = warningCounts.get(warningKey) || 0

      // Bound the map to prevent unbounded memory growth from unique warning keys.
      // Once the cap is reached, new unique keys are not tracked — their
      // occurrence_count will always be reported as 1 in analytics.
      if (
        warningCounts.has(warningKey) ||
        warningCounts.size < MAX_WARNING_KEYS
      ) {
        warningCounts.set(warningKey, count + 1)
      }

      const isInternal = isInternalWarning(warning)

      // Always log to Statsig for monitoring
      // Include full details for ant users only, since they may contain code or filepaths
      logEvent('tengu_node_warning', {
        is_internal: isInternal ? 1 : 0,
        occurrence_count: count + 1,
        classname:
          warning.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ...(process.env.USER_TYPE === 'ant' && {
          message:
            warning.message as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        }),
      })

      // In debug mode, show all warnings with context
      if (isEnvTruthy(process.env.CLAUDE_DEBUG)) {
        const prefix = isInternal ? '[Internal Warning]' : '[Warning]'
        logForDebugging(`${prefix} ${warning.toString()}`, { level: 'warn' })
      }
      // Hide all warnings from users - they are only logged to Statsig for monitoring
    } catch {
      // Fail silently - we don't want the warning handler to cause issues
    }
  }

  // Install the warning handler
  process.on('warning', warningHandler)
}
