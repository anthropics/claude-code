/**
 * Marketplace reconciler — makes known_marketplaces.json consistent with
 * declared intent in settings.
 *
 * Two layers:
 * - diffMarketplaces(): comparison (reads .git for worktree canonicalization, memoized)
 * - reconcileMarketplaces(): bundled diff + install (I/O, idempotent, additive)
 */

import isEqual from 'lodash-es/isEqual.js'
import { isAbsolute, resolve } from 'path'
import { getOriginalCwd } from '../../bootstrap/state.js'
import { logForDebugging } from '../debug.js'
import { errorMessage } from '../errors.js'
import { pathExists } from '../file.js'
import { findCanonicalGitRoot } from '../git.js'
import { logError } from '../log.js'
import {
  addMarketplaceSource,
  type DeclaredMarketplace,
  getDeclaredMarketplaces,
  loadKnownMarketplacesConfig,
} from './marketplaceManager.js'
import {
  isLocalMarketplaceSource,
  type KnownMarketplacesFile,
  type MarketplaceSource,
} from './schemas.js'

export type MarketplaceDiff = {
  /** Declared in settings, absent from known_marketplaces.json */
  missing: string[]
  /** Present in both, but settings source ≠ JSON source (settings wins) */
  sourceChanged: Array<{
    name: string
    declaredSource: MarketplaceSource
    materializedSource: MarketplaceSource
  }>
  /** Present in both, sources match */
  upToDate: string[]
}

/**
 * Compare declared intent (settings) against materialized state (JSON).
 *
 * Resolves relative directory/file paths in `declared` before comparing,
 * so project settings with `./path` match JSON's absolute path. Path
 * resolution reads `.git` to canonicalize worktree paths (memoized).
 */
export function diffMarketplaces(
  declared: Record<string, DeclaredMarketplace>,
  materialized: KnownMarketplacesFile,
  opts?: { projectRoot?: string },
): MarketplaceDiff {
  const missing: string[] = []
  const sourceChanged: MarketplaceDiff['sourceChanged'] = []
  const upToDate: string[] = []

  for (const [name, intent] of Object.entries(declared)) {
    const state = materialized[name]
    const normalizedIntent = normalizeSource(intent.source, opts?.projectRoot)

    if (!state) {
      missing.push(name)
    } else if (intent.sourceIsFallback) {
      // Fallback: presence suffices. Don't compare sources — the declared source
      // is only a default for the `missing` branch. If seed/prior-install/mirror
      // materialized this marketplace under ANY source, leave it alone. Comparing
      // would report sourceChanged → re-clone → stomp the materialized content.
      upToDate.push(name)
    } else if (!isEqual(normalizedIntent, state.source)) {
      sourceChanged.push({
        name,
        declaredSource: normalizedIntent,
        materializedSource: state.source,
      })
    } else {
      upToDate.push(name)
    }
  }

  return { missing, sourceChanged, upToDate }
}

export type ReconcileOptions = {
  /** Skip a declared marketplace. Used by zip-cache mode for unsupported source types. */
  skip?: (name: string, source: MarketplaceSource) => boolean
  onProgress?: (event: ReconcileProgressEvent) => void
}

export type ReconcileProgressEvent =
  | {
      type: 'installing'
      name: string
      action: 'install' | 'update'
      index: number
      total: number
    }
  | { type: 'installed'; name: string; alreadyMaterialized: boolean }
  | { type: 'failed'; name: string; error: string }

export type ReconcileResult = {
  installed: string[]
  updated: string[]
  failed: Array<{ name: string; error: string }>
  upToDate: string[]
  skipped: string[]
}

/**
 * Make known_marketplaces.json consistent with declared intent.
 * Idempotent. Additive only (never deletes). Does not touch AppState.
 */
export async function reconcileMarketplaces(
  opts?: ReconcileOptions,
): Promise<ReconcileResult> {
  const declared = getDeclaredMarketplaces()
  if (Object.keys(declared).length === 0) {
    return { installed: [], updated: [], failed: [], upToDate: [], skipped: [] }
  }

  let materialized: KnownMarketplacesFile
  try {
    materialized = await loadKnownMarketplacesConfig()
  } catch (e) {
    logError(e)
    materialized = {}
  }

  const diff = diffMarketplaces(declared, materialized, {
    projectRoot: getOriginalCwd(),
  })

  type WorkItem = {
    name: string
    source: MarketplaceSource
    action: 'install' | 'update'
  }
  const work: WorkItem[] = [
    ...diff.missing.map(
      (name): WorkItem => ({
        name,
        source: normalizeSource(declared[name]!.source),
        action: 'install',
      }),
    ),
    ...diff.sourceChanged.map(
      ({ name, declaredSource }): WorkItem => ({
        name,
        source: declaredSource,
        action: 'update',
      }),
    ),
  ]

  const skipped: string[] = []
  const toProcess: WorkItem[] = []
  for (const item of work) {
    if (opts?.skip?.(item.name, item.source)) {
      skipped.push(item.name)
      continue
    }
    // For sourceChanged local-path entries, skip if the declared path doesn't
    // exist. Guards multi-checkout scenarios where normalizeSource can't
    // canonicalize and produces a dead path — the materialized entry may still
    // be valid; addMarketplaceSource would fail anyway, so skipping avoids a
    // noisy "failed" event and preserves the working entry. Missing entries
    // are NOT skipped (nothing to preserve; the user should see the error).
    if (
      item.action === 'update' &&
      isLocalMarketplaceSource(item.source) &&
      !(await pathExists(item.source.path))
    ) {
      logForDebugging(
        `[reconcile] '${item.name}' declared path does not exist; keeping materialized entry`,
      )
      skipped.push(item.name)
      continue
    }
    toProcess.push(item)
  }

  if (toProcess.length === 0) {
    return {
      installed: [],
      updated: [],
      failed: [],
      upToDate: diff.upToDate,
      skipped,
    }
  }

  logForDebugging(
    `[reconcile] ${toProcess.length} marketplace(s): ${toProcess.map(w => `${w.name}(${w.action})`).join(', ')}`,
  )

  const installed: string[] = []
  const updated: string[] = []
  const failed: ReconcileResult['failed'] = []

  for (let i = 0; i < toProcess.length; i++) {
    const { name, source, action } = toProcess[i]!
    opts?.onProgress?.({
      type: 'installing',
      name,
      action,
      index: i + 1,
      total: toProcess.length,
    })

    try {
      // addMarketplaceSource is source-idempotent — same source returns
      // alreadyMaterialized:true without cloning. For 'update' (source
      // changed), the new source won't match existing → proceeds with clone
      // and overwrites the old JSON entry.
      const result = await addMarketplaceSource(source)

      if (action === 'install') installed.push(name)
      else updated.push(name)
      opts?.onProgress?.({
        type: 'installed',
        name,
        alreadyMaterialized: result.alreadyMaterialized,
      })
    } catch (e) {
      const error = errorMessage(e)
      failed.push({ name, error })
      opts?.onProgress?.({ type: 'failed', name, error })
      logError(e)
    }
  }

  return { installed, updated, failed, upToDate: diff.upToDate, skipped }
}

/**
 * Resolve relative directory/file paths for stable comparison.
 * Settings declared at project scope may use project-relative paths;
 * JSON stores absolute paths.
 *
 * For git worktrees, resolve against the main checkout (canonical root)
 * instead of the worktree cwd. Project settings are checked into git,
 * so `./foo` means "relative to this repo" — but known_marketplaces.json is
 * user-global with one entry per marketplace name. Resolving against the
 * worktree cwd means each worktree session overwrites the shared entry with
 * its own absolute path, and deleting the worktree leaves a dead
 * installLocation. The canonical root is stable across all worktrees.
 */
function normalizeSource(
  source: MarketplaceSource,
  projectRoot?: string,
): MarketplaceSource {
  if (
    (source.source === 'directory' || source.source === 'file') &&
    !isAbsolute(source.path)
  ) {
    const base = projectRoot ?? getOriginalCwd()
    const canonicalRoot = findCanonicalGitRoot(base)
    return {
      ...source,
      path: resolve(canonicalRoot ?? base, source.path),
    }
  }
  return source
}
