import chokidar, { type FSWatcher } from 'chokidar'
import { isAbsolute, join } from 'path'
import { registerCleanup } from '../cleanupRegistry.js'
import { logForDebugging } from '../debug.js'
import { errorMessage } from '../errors.js'
import {
  executeCwdChangedHooks,
  executeFileChangedHooks,
  type HookOutsideReplResult,
} from '../hooks.js'
import { clearCwdEnvFiles } from '../sessionEnvironment.js'
import { getHooksConfigFromSnapshot } from './hooksConfigSnapshot.js'

let watcher: FSWatcher | null = null
let currentCwd: string
let dynamicWatchPaths: string[] = []
let dynamicWatchPathsSorted: string[] = []
let initialized = false
let hasEnvHooks = false
let notifyCallback: ((text: string, isError: boolean) => void) | null = null

export function setEnvHookNotifier(
  cb: ((text: string, isError: boolean) => void) | null,
): void {
  notifyCallback = cb
}

export function initializeFileChangedWatcher(cwd: string): void {
  if (initialized) return
  initialized = true
  currentCwd = cwd

  const config = getHooksConfigFromSnapshot()
  hasEnvHooks =
    (config?.CwdChanged?.length ?? 0) > 0 ||
    (config?.FileChanged?.length ?? 0) > 0

  if (hasEnvHooks) {
    registerCleanup(async () => dispose())
  }

  const paths = resolveWatchPaths(config)
  if (paths.length === 0) return

  startWatching(paths)
}

function resolveWatchPaths(
  config?: ReturnType<typeof getHooksConfigFromSnapshot>,
): string[] {
  const matchers = (config ?? getHooksConfigFromSnapshot())?.FileChanged ?? []

  // Matcher field: filenames to watch in cwd, pipe-separated (e.g. ".envrc|.env")
  const staticPaths: string[] = []
  for (const m of matchers) {
    if (!m.matcher) continue
    for (const name of m.matcher.split('|').map(s => s.trim())) {
      if (!name) continue
      staticPaths.push(isAbsolute(name) ? name : join(currentCwd, name))
    }
  }

  // Combine static matcher paths with dynamic paths from hook output
  return [...new Set([...staticPaths, ...dynamicWatchPaths])]
}

function startWatching(paths: string[]): void {
  logForDebugging(`FileChanged: watching ${paths.length} paths`)
  watcher = chokidar.watch(paths, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 200 },
    ignorePermissionErrors: true,
  })
  watcher.on('change', p => handleFileEvent(p, 'change'))
  watcher.on('add', p => handleFileEvent(p, 'add'))
  watcher.on('unlink', p => handleFileEvent(p, 'unlink'))
}

function handleFileEvent(
  path: string,
  event: 'change' | 'add' | 'unlink',
): void {
  logForDebugging(`FileChanged: ${event} ${path}`)
  void executeFileChangedHooks(path, event)
    .then(({ results, watchPaths, systemMessages }) => {
      if (watchPaths.length > 0) {
        updateWatchPaths(watchPaths)
      }
      for (const msg of systemMessages) {
        notifyCallback?.(msg, false)
      }
      for (const r of results) {
        if (!r.succeeded && r.output) {
          notifyCallback?.(r.output, true)
        }
      }
    })
    .catch(e => {
      const msg = errorMessage(e)
      logForDebugging(`FileChanged hook failed: ${msg}`, {
        level: 'error',
      })
      notifyCallback?.(msg, true)
    })
}

export function updateWatchPaths(paths: string[]): void {
  if (!initialized) return
  const sorted = paths.slice().sort()
  if (
    sorted.length === dynamicWatchPathsSorted.length &&
    sorted.every((p, i) => p === dynamicWatchPathsSorted[i])
  ) {
    return
  }
  dynamicWatchPaths = paths
  dynamicWatchPathsSorted = sorted
  restartWatching()
}

function restartWatching(): void {
  if (watcher) {
    void watcher.close()
    watcher = null
  }
  const paths = resolveWatchPaths()
  if (paths.length > 0) {
    startWatching(paths)
  }
}

export async function onCwdChangedForHooks(
  oldCwd: string,
  newCwd: string,
): Promise<void> {
  if (oldCwd === newCwd) return

  // Re-evaluate from the current snapshot so mid-session hook changes are picked up
  const config = getHooksConfigFromSnapshot()
  const currentHasEnvHooks =
    (config?.CwdChanged?.length ?? 0) > 0 ||
    (config?.FileChanged?.length ?? 0) > 0
  if (!currentHasEnvHooks) return
  currentCwd = newCwd

  await clearCwdEnvFiles()
  const hookResult = await executeCwdChangedHooks(oldCwd, newCwd).catch(e => {
    const msg = errorMessage(e)
    logForDebugging(`CwdChanged hook failed: ${msg}`, {
      level: 'error',
    })
    notifyCallback?.(msg, true)
    return {
      results: [] as HookOutsideReplResult[],
      watchPaths: [] as string[],
      systemMessages: [] as string[],
    }
  })
  dynamicWatchPaths = hookResult.watchPaths
  dynamicWatchPathsSorted = hookResult.watchPaths.slice().sort()
  for (const msg of hookResult.systemMessages) {
    notifyCallback?.(msg, false)
  }
  for (const r of hookResult.results) {
    if (!r.succeeded && r.output) {
      notifyCallback?.(r.output, true)
    }
  }

  // Re-resolve matcher paths against the new cwd
  if (initialized) {
    restartWatching()
  }
}

function dispose(): void {
  if (watcher) {
    void watcher.close()
    watcher = null
  }
  dynamicWatchPaths = []
  dynamicWatchPathsSorted = []
  initialized = false
  hasEnvHooks = false
  notifyCallback = null
}

export function resetFileChangedWatcherForTesting(): void {
  dispose()
}
