/**
 * Minimal module for firing MDM subprocess reads without blocking the event loop.
 * Has minimal imports — only child_process, fs, and mdmConstants (which only imports os).
 *
 * Two usage patterns:
 * 1. Startup: startMdmRawRead() fires at main.tsx module evaluation, results consumed later via getMdmRawReadPromise()
 * 2. Poll/fallback: fireRawRead() creates a fresh read on demand (used by changeDetector and SDK entrypoint)
 *
 * Raw stdout is consumed by mdmSettings.ts via consumeRawReadResult().
 */

import { execFile } from 'child_process'
import { existsSync } from 'fs'
import {
  getMacOSPlistPaths,
  MDM_SUBPROCESS_TIMEOUT_MS,
  PLUTIL_ARGS_PREFIX,
  PLUTIL_PATH,
  WINDOWS_REGISTRY_KEY_PATH_HKCU,
  WINDOWS_REGISTRY_KEY_PATH_HKLM,
  WINDOWS_REGISTRY_VALUE_NAME,
} from './constants.js'

export type RawReadResult = {
  plistStdouts: Array<{ stdout: string; label: string }> | null
  hklmStdout: string | null
  hkcuStdout: string | null
}

let rawReadPromise: Promise<RawReadResult> | null = null

function execFilePromise(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; code: number | null }> {
  return new Promise(resolve => {
    execFile(
      cmd,
      args,
      { encoding: 'utf-8', timeout: MDM_SUBPROCESS_TIMEOUT_MS },
      (err, stdout) => {
        // biome-ignore lint/nursery/noFloatingPromises: resolve() is not a floating promise
        resolve({ stdout: stdout ?? '', code: err ? 1 : 0 })
      },
    )
  })
}

/**
 * Fire fresh subprocess reads for MDM settings and return raw stdout.
 * On macOS: spawns plutil for each plist path in parallel, picks first winner.
 * On Windows: spawns reg query for HKLM and HKCU in parallel.
 * On Linux: returns empty (no MDM equivalent).
 */
export function fireRawRead(): Promise<RawReadResult> {
  return (async (): Promise<RawReadResult> => {
    if (process.platform === 'darwin') {
      const plistPaths = getMacOSPlistPaths()

      const allResults = await Promise.all(
        plistPaths.map(async ({ path, label }) => {
          // Fast-path: skip the plutil subprocess if the plist file does not
          // exist. Spawning plutil takes ~5ms even for an immediate ENOENT,
          // and non-MDM machines never have these files.
          // Uses synchronous existsSync to preserve the spawn-during-imports
          // invariant: execFilePromise must be the first await so plutil
          // spawns before the event loop polls (see main.tsx:3-4).
          if (!existsSync(path)) {
            return { stdout: '', label, ok: false }
          }
          const { stdout, code } = await execFilePromise(PLUTIL_PATH, [
            ...PLUTIL_ARGS_PREFIX,
            path,
          ])
          return { stdout, label, ok: code === 0 && !!stdout }
        }),
      )

      // First source wins (array is in priority order)
      const winner = allResults.find(r => r.ok)
      return {
        plistStdouts: winner
          ? [{ stdout: winner.stdout, label: winner.label }]
          : [],
        hklmStdout: null,
        hkcuStdout: null,
      }
    }

    if (process.platform === 'win32') {
      const [hklm, hkcu] = await Promise.all([
        execFilePromise('reg', [
          'query',
          WINDOWS_REGISTRY_KEY_PATH_HKLM,
          '/v',
          WINDOWS_REGISTRY_VALUE_NAME,
        ]),
        execFilePromise('reg', [
          'query',
          WINDOWS_REGISTRY_KEY_PATH_HKCU,
          '/v',
          WINDOWS_REGISTRY_VALUE_NAME,
        ]),
      ])
      return {
        plistStdouts: null,
        hklmStdout: hklm.code === 0 ? hklm.stdout : null,
        hkcuStdout: hkcu.code === 0 ? hkcu.stdout : null,
      }
    }

    return { plistStdouts: null, hklmStdout: null, hkcuStdout: null }
  })()
}

/**
 * Fire raw subprocess reads once for startup. Called at main.tsx module evaluation.
 * Results are consumed via getMdmRawReadPromise().
 */
export function startMdmRawRead(): void {
  if (rawReadPromise) return
  rawReadPromise = fireRawRead()
}

/**
 * Get the startup promise. Returns null if startMdmRawRead() wasn't called.
 */
export function getMdmRawReadPromise(): Promise<RawReadResult> | null {
  return rawReadPromise
}
