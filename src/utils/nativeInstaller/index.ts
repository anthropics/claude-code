/**
 * Native Installer - Public API
 *
 * This is the barrel file that exports only the functions actually used by external modules.
 * External modules should only import from this file.
 */

// Re-export only the functions that are actually used
export {
  checkInstall,
  cleanupNpmInstallations,
  cleanupOldVersions,
  cleanupShellAliases,
  installLatest,
  lockCurrentVersion,
  removeInstalledSymlink,
  type SetupMessage,
} from './installer.js'
