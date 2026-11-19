import type { VcsDiffInput, VcsDiffResult, VcsWorkingCopy } from 'claude-code'

import Git from '../../git'
import Limits from '../../limits'
import { messageOf } from '../../message-of'
import type { Backend, BackendHost } from '../types'

const UNSEEN =
  /(?![\t\n])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu

const seenOf = (text: string) => text.replace(UNSEEN, '')

/**
 * The backend over `$.vcs.detect` and `$.vcs.diff`, for any system a mod
 * defines: rows from a stat-only answer, bodies asked by path.
 *
 * An answer is cut to the caps git's is and dated by the same walk down from
 * the root, so no name it holds is looked up outside. Branch mode is offered
 * where the copy names a default branch, unless `default` answers unknown
 * when pinned; an ask cut short says nothing of it. What nobody can see is
 * dropped from names and labels, and a name holding it is not told the model.
 *
 * @param host the bound host's calls and file probes
 * @param copy the working copy `vcs.detect` named
 * @returns the backend, or null where no hook answers for the system
 */
export async function vcsBackendOf(
  host: BackendHost,
  copy: VcsWorkingCopy,
): Promise<Backend | null> {
  const repository = { toplevel: copy.root }

  const ask = (
    mode: Git.BaseMode,
    narrowed: Pick<VcsDiffInput, 'paths' | 'isStatOnly'>,
  ): Promise<VcsDiffResult> =>
    host.diff({
      path: copy.root,
      vcs: copy.vcs,
      base: mode === 'branch' ? 'default' : 'head',
      ...narrowed,
    })

  const first = await ask('session', { isStatOnly: true }).catch(() => null)

  if (first?.unknown === null) {
    return null
  }

  const baseline = first?.files
    ? new Set(first.files.map(file => file.path))
    : null

  const hasDefault =
    copy.defaultBranch !== null &&
    (await ask('branch', { paths: [], isStatOnly: true }).then(
      answer => answer.unknown === undefined,
      () => true,
    ))

  let polled = {
    atMs: await host.nowMs(),
    key: Promise.resolve(String(copy.revision)),
  }

  async function fetchDiff(mode: Git.BaseMode): Promise<Git.FetchOutcome> {
    const answer = await ask(mode, { isStatOnly: true }).catch(
      (error: unknown): VcsDiffResult => ({ unknown: messageOf(error) }),
    )

    if (answer.unknown !== undefined) {
      const reason = seenOf(answer.unknown ?? 'no mod answered')

      return { kind: 'unavailable', reason }
    }

    const { files } = answer
    const base = seenOf(answer.base)
    const known = files.filter(file => !file.isUntracked)
    const isSession = mode === 'session'
    const isBranch = mode === 'branch'

    const dating: Git.DatingContext = {
      deps: { sessionStartMs: host.sessionStartMsOf(), baseline },
      stamps: Git.stampProbeOf(host, copy.root, Limits.MAX_LISTED_DIRECTORIES),
    }

    const stats = {
      filesCount: known.length,
      linesAdded: known.reduce((sum, file) => sum + file.added, 0),
      linesRemoved: known.reduce((sum, file) => sum + file.removed, 0),
    }

    const isCountedAlone = Git.isPastDetails({ stats, files: [] })

    const rows = known
      .slice(0, isCountedAlone ? 0 : Limits.MAX_FILES)
      .map(({ patch: _unasked, ...file }) => ({ ...file, isPreSession: false }))

    const dated = isSession ? await Git.tagPreSession(dating, rows) : rows
    const slots = isCountedAlone ? 0 : Limits.MAX_FILES - rows.length
    const untracked = files.filter(file => file.isUntracked && slots > 0)

    const merged = Git.mergedWithUntracked(
      { stats, files: dated },
      await Git.untrackedRowsOf(
        dating,
        untracked.map(file => file.path),
        { slots, scope: isSession ? 'with-pre-session' : 'session-only' },
      ),
    )

    return {
      kind: 'data',
      data: {
        ...merged,
        repository,
        mode,
        source: isBranch
          ? { kind: 'branch', baseBranch: base, baseRef: base }
          : { kind: 'working-tree', base },
        baseRef: `${isBranch}|${base}`,
        isUnborn: false,
        stalePaths: [],
      },
    }
  }

  const fetchHunks: Backend['fetchHunks'] = async (data, files) => {
    const bodied = files.filter(file => !file.isUntracked && !file.isBinary)

    const paths = bodied.flatMap(({ renamedFrom, path }) =>
      renamedFrom === null ? [path] : [renamedFrom, path],
    )

    const asked = paths.length > 0 ? ask(data.mode, { paths }) : null
    const answer = await asked?.catch(() => null)
    const patches = new Map(answer?.files?.map(one => [one.path, one.patch]))

    return new Map(
      files.map(file => [
        file.path,
        !bodied.includes(file)
          ? Git.EMPTY_FILE_HUNKS
          : answer?.files
            ? Git.parseFileDiff(patches.get(file.path) ?? '')
            : null,
      ]),
    )
  }

  async function headKeyOf(): Promise<string> {
    const atMs = await host.nowMs()

    if (atMs - polled.atMs >= Limits.REVISION_POLL_MS) {
      const asked = polled.key.then(host.detect)

      polled = { atMs, key: asked.then(now => String(now?.revision)) }
    }

    return polled.key
  }

  return {
    repository,
    baseModes: Git.GIT_BASE_MODES.filter(
      mode => hasDefault || mode !== 'branch',
    ),
    words: {
      base: 'checkout',
      diffCommand: `${copy.vcs} diff`,
      lister: copy.vcs,
      untrackedNoteOf: () => ['New file not yet tracked.'],
      subtitleOf: base => `(vs ${base})`,
      drawnOf: seenOf,
      toldOf: path =>
        seenOf(path) === path && !/[\t\n<>]/.test(path) ? path : 'a file',
    },
    fetchDiff,
    fetchHunks,
    headKeyOf,
    expireHeadKey: () => {
      polled = { ...polled, atMs: Number.NEGATIVE_INFINITY }
    },
  }
}
