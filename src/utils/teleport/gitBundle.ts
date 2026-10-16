/**
 * Git bundle creation + upload for CCR seed-bundle seeding.
 *
 * Flow:
 *   1. git stash create → update-ref refs/seed/stash (makes it reachable)
 *   2. git bundle create --all (packs refs/seed/stash + its objects)
 *   3. Upload to /v1/files
 *   4. Cleanup refs/seed/stash (don't pollute user's repo)
 *   5. Caller sets seed_bundle_file_id on SessionContext
 */

import { stat, unlink } from 'fs/promises'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from 'src/services/analytics/index.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { type FilesApiConfig, uploadFile } from '../../services/api/filesApi.js'
import { getCwd } from '../cwd.js'
import { logForDebugging } from '../debug.js'
import { execFileNoThrowWithCwd } from '../execFileNoThrow.js'
import { findGitRoot, gitExe } from '../git.js'
import { generateTempFilePath } from '../tempfile.js'

// Tunable via tengu_ccr_bundle_max_bytes.
const DEFAULT_BUNDLE_MAX_BYTES = 100 * 1024 * 1024

type BundleScope = 'all' | 'head' | 'squashed'

export type BundleUploadResult =
  | {
      success: true
      fileId: string
      bundleSizeBytes: number
      scope: BundleScope
      hasWip: boolean
    }
  | { success: false; error: string; failReason?: BundleFailReason }

type BundleFailReason = 'git_error' | 'too_large' | 'empty_repo'

type BundleCreateResult =
  | { ok: true; size: number; scope: BundleScope }
  | { ok: false; error: string; failReason: BundleFailReason }

// Bundle --all → HEAD → squashed-root. HEAD drops side branches/tags but
// keeps full current-branch history. Squashed-root is a single parentless
// commit of HEAD's tree (or the stash tree if WIP exists) — no history,
// just the snapshot. Receiver needs refs/seed/root handling for that tier.
async function _bundleWithFallback(
  gitRoot: string,
  bundlePath: string,
  maxBytes: number,
  hasStash: boolean,
  signal: AbortSignal | undefined,
): Promise<BundleCreateResult> {
  // --all picks up refs/seed/stash; HEAD needs it explicit.
  const extra = hasStash ? ['refs/seed/stash'] : []
  const mkBundle = (base: string) =>
    execFileNoThrowWithCwd(
      gitExe(),
      ['bundle', 'create', bundlePath, base, ...extra],
      { cwd: gitRoot, abortSignal: signal },
    )

  const allResult = await mkBundle('--all')
  if (allResult.code !== 0) {
    return {
      ok: false,
      error: `git bundle create --all failed (${allResult.code}): ${allResult.stderr.slice(0, 200)}`,
      failReason: 'git_error',
    }
  }

  const { size: allSize } = await stat(bundlePath)
  if (allSize <= maxBytes) {
    return { ok: true, size: allSize, scope: 'all' }
  }

  // bundle create overwrites in place.
  logForDebugging(
    `[gitBundle] --all bundle is ${(allSize / 1024 / 1024).toFixed(1)}MB (> ${(maxBytes / 1024 / 1024).toFixed(0)}MB), retrying HEAD-only`,
  )
  const headResult = await mkBundle('HEAD')
  if (headResult.code !== 0) {
    return {
      ok: false,
      error: `git bundle create HEAD failed (${headResult.code}): ${headResult.stderr.slice(0, 200)}`,
      failReason: 'git_error',
    }
  }

  const { size: headSize } = await stat(bundlePath)
  if (headSize <= maxBytes) {
    return { ok: true, size: headSize, scope: 'head' }
  }

  // Last resort: squash to a single parentless commit. Uses the stash tree
  // when WIP exists (bakes uncommitted changes in — can't bundle the stash
  // ref separately since its parents would drag history back).
  logForDebugging(
    `[gitBundle] HEAD bundle is ${(headSize / 1024 / 1024).toFixed(1)}MB, retrying squashed-root`,
  )
  const treeRef = hasStash ? 'refs/seed/stash^{tree}' : 'HEAD^{tree}'
  const commitTree = await execFileNoThrowWithCwd(
    gitExe(),
    ['commit-tree', treeRef, '-m', 'seed'],
    { cwd: gitRoot, abortSignal: signal },
  )
  if (commitTree.code !== 0) {
    return {
      ok: false,
      error: `git commit-tree failed (${commitTree.code}): ${commitTree.stderr.slice(0, 200)}`,
      failReason: 'git_error',
    }
  }
  const squashedSha = commitTree.stdout.trim()
  await execFileNoThrowWithCwd(
    gitExe(),
    ['update-ref', 'refs/seed/root', squashedSha],
    { cwd: gitRoot },
  )
  const squashResult = await execFileNoThrowWithCwd(
    gitExe(),
    ['bundle', 'create', bundlePath, 'refs/seed/root'],
    { cwd: gitRoot, abortSignal: signal },
  )
  if (squashResult.code !== 0) {
    return {
      ok: false,
      error: `git bundle create refs/seed/root failed (${squashResult.code}): ${squashResult.stderr.slice(0, 200)}`,
      failReason: 'git_error',
    }
  }
  const { size: squashSize } = await stat(bundlePath)
  if (squashSize <= maxBytes) {
    return { ok: true, size: squashSize, scope: 'squashed' }
  }

  return {
    ok: false,
    error:
      'Repo is too large to bundle. Please setup GitHub on https://claude.ai/code',
    failReason: 'too_large',
  }
}

// Bundle the repo and upload to Files API; return file_id for
// seed_bundle_file_id. --all → HEAD → squashed-root fallback chain.
// Tracked WIP via stash create → refs/seed/stash (or baked into the
// squashed tree); untracked not captured.
export async function createAndUploadGitBundle(
  config: FilesApiConfig,
  opts?: { cwd?: string; signal?: AbortSignal },
): Promise<BundleUploadResult> {
  const workdir = opts?.cwd ?? getCwd()
  const gitRoot = findGitRoot(workdir)
  if (!gitRoot) {
    return { success: false, error: 'Not in a git repository' }
  }

  // Sweep stale refs from a crashed prior run before --all bundles them.
  // Runs before the empty-repo check so it's never skipped by an early return.
  for (const ref of ['refs/seed/stash', 'refs/seed/root']) {
    await execFileNoThrowWithCwd(gitExe(), ['update-ref', '-d', ref], {
      cwd: gitRoot,
    })
  }

  // `git bundle create` refuses to create an empty bundle (exit 128), and
  // `stash create` fails with "You do not have the initial commit yet".
  // Check for any refs (not just HEAD) so orphan branches with commits
  // elsewhere still bundle — `--all` packs those refs regardless of HEAD.
  const refCheck = await execFileNoThrowWithCwd(
    gitExe(),
    ['for-each-ref', '--count=1', 'refs/'],
    { cwd: gitRoot },
  )
  if (refCheck.code === 0 && refCheck.stdout.trim() === '') {
    logEvent('tengu_ccr_bundle_upload', {
      outcome:
        'empty_repo' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return {
      success: false,
      error: 'Repository has no commits yet',
      failReason: 'empty_repo',
    }
  }

  // stash create writes a dangling commit — doesn't touch refs/stash or
  // the working tree. Untracked files intentionally excluded.
  const stashResult = await execFileNoThrowWithCwd(
    gitExe(),
    ['stash', 'create'],
    { cwd: gitRoot, abortSignal: opts?.signal },
  )
  // exit 0 + empty stdout = nothing to stash. Nonzero is rare; non-fatal.
  const wipStashSha = stashResult.code === 0 ? stashResult.stdout.trim() : ''
  const hasWip = wipStashSha !== ''
  if (stashResult.code !== 0) {
    logForDebugging(
      `[gitBundle] git stash create failed (${stashResult.code}), proceeding without WIP: ${stashResult.stderr.slice(0, 200)}`,
    )
  } else if (hasWip) {
    logForDebugging(`[gitBundle] Captured WIP as stash ${wipStashSha}`)
    // env-runner reads the SHA via bundle list-heads refs/seed/stash.
    await execFileNoThrowWithCwd(
      gitExe(),
      ['update-ref', 'refs/seed/stash', wipStashSha],
      { cwd: gitRoot },
    )
  }

  const bundlePath = generateTempFilePath('ccr-seed', '.bundle')

  // git leaves a partial file on nonzero exit (e.g. empty-repo 128).
  try {
    const maxBytes =
      getFeatureValue_CACHED_MAY_BE_STALE<number | null>(
        'tengu_ccr_bundle_max_bytes',
        null,
      ) ?? DEFAULT_BUNDLE_MAX_BYTES

    const bundle = await _bundleWithFallback(
      gitRoot,
      bundlePath,
      maxBytes,
      hasWip,
      opts?.signal,
    )

    if (!bundle.ok) {
      logForDebugging(`[gitBundle] ${bundle.error}`)
      logEvent('tengu_ccr_bundle_upload', {
        outcome:
          bundle.failReason as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        max_bytes: maxBytes,
      })
      return {
        success: false,
        error: bundle.error,
        failReason: bundle.failReason,
      }
    }

    // Fixed relativePath so CCR can locate it.
    const upload = await uploadFile(bundlePath, '_source_seed.bundle', config, {
      signal: opts?.signal,
    })

    if (!upload.success) {
      logEvent('tengu_ccr_bundle_upload', {
        outcome:
          'failed' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      return { success: false, error: upload.error }
    }

    logForDebugging(
      `[gitBundle] Uploaded ${upload.size} bytes as file_id ${upload.fileId}`,
    )
    logEvent('tengu_ccr_bundle_upload', {
      outcome:
        'success' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      size_bytes: upload.size,
      scope:
        bundle.scope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      has_wip: hasWip,
    })
    return {
      success: true,
      fileId: upload.fileId,
      bundleSizeBytes: upload.size,
      scope: bundle.scope,
      hasWip,
    }
  } finally {
    try {
      await unlink(bundlePath)
    } catch {
      logForDebugging(`[gitBundle] Could not delete ${bundlePath} (non-fatal)`)
    }
    // Always delete — also sweeps a stale ref from a crashed prior run.
    // update-ref -d on a missing ref exits 0.
    for (const ref of ['refs/seed/stash', 'refs/seed/root']) {
      await execFileNoThrowWithCwd(gitExe(), ['update-ref', '-d', ref], {
        cwd: gitRoot,
      })
    }
  }
}
