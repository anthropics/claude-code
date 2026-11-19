import { describe, expect, test, tier } from 'claude-code/testing'

import Backend from '../../hooks/backend'
import Fixtures from '../fixtures'

tier('builtin')

describe('backend-of', () => {
  const NONE = new Map<string, Backend.BackendProbe>()

  const bySlug = (...probes: Backend.BackendProbe[]) =>
    new Map(probes.map((probe, at) => [`installed-${at}`, probe]))

  test('as published: no probes, so git or nothing', async () => {
    const inGit = Fixtures.gitHostOf()
    const outside = Fixtures.recordingBackendHostOf({})

    const backend = await Backend.backendOf(inGit.host, NONE)

    expect(backend?.words.lister).toBe('git')
    expect(await Backend.backendOf(outside.host, NONE)).toBeNull()

    expect(
      [inGit.programs, outside.programs],
      'pinning spawns the one rev-parse and walks nothing',
    ).toEqual([['git'], ['git']])
  })

  test('a declining probe leaves a git working tree to git', async () => {
    const declining = Fixtures.recordingProbeOf(null)
    const inGit = Fixtures.gitHostOf()
    const probes = bySlug(declining.probe)
    const backend = await Backend.backendOf(inGit.host, probes)

    expect(backend?.words.lister).toBe('git')
    expect(backend?.baseModes).toEqual(['session', 'uncommitted', 'branch'])
    expect(declining.asked).toEqual([inGit.host])
    expect(inGit.programs).toEqual(['git'])
  })

  test('a probe that answers pins before git is asked', async () => {
    const inGit = Fixtures.gitHostOf()

    const backend = await Backend.backendOf(
      inGit.host,
      bySlug(Fixtures.recordingProbeOf('/home/me/src').probe),
    )

    expect(backend?.repository).toEqual({ toplevel: '/home/me/src' })
    expect(inGit.programs).toEqual([])
  })

  test('the probes are asked in order and the first answer pins', async () => {
    const declining = Fixtures.recordingProbeOf(null)
    const first = Fixtures.recordingProbeOf('/first')
    const second = Fixtures.recordingProbeOf('/second')
    const { host } = Fixtures.recordingBackendHostOf({})

    const backend = await Backend.backendOf(
      host,
      bySlug(declining.probe, first.probe, second.probe),
    )

    expect(backend?.repository).toEqual({ toplevel: '/first' })

    expect([
      declining.asked.length,
      first.asked.length,
      second.asked.length,
    ]).toEqual([1, 1, 0])

    expect(declining.asked[0]).toBe(host)
  })

  test('a system vcs.detect names pins with no probe asked and no git run', async () => {
    const inGit = Fixtures.gitHostOf()
    const installed = Fixtures.recordingProbeOf('/installed')

    const backend = await Backend.backendOf(
      {
        ...inGit.host,
        detect: () => Promise.resolve(Fixtures.ACME_COPY),
        diff: () => Promise.resolve({ unknown: 'offline' }),
      },
      bySlug(installed.probe),
    )

    expect(backend?.repository).toEqual({ toplevel: Fixtures.ACME_COPY.root })
    expect(backend?.words.lister).toBe('acme')
    expect([inGit.programs, installed.asked]).toEqual([[], []])
  })

  test('a system no hook serves leaves the folder to git, or to none', async () => {
    const detect = () => Promise.resolve(Fixtures.ACME_COPY)
    const inGit = Fixtures.gitHostOf()
    const outside = Fixtures.recordingBackendHostOf({})
    const backend = await Backend.backendOf({ ...inGit.host, detect }, NONE)

    expect(backend?.words.lister).toBe('git')
    expect(await Backend.backendOf({ ...outside.host, detect }, NONE)).toBeNull()
    expect([inGit.programs, outside.programs]).toEqual([['git'], ['git']])
  })

  test('git, and a slug a probe is installed for, keep their own reader', async () => {
    const listerOf = async (vcs: string, toplevel: string | null) => {
      const backend = await Backend.backendOf(
        {
          ...Fixtures.gitHostOf().host,
          detect: () => Promise.resolve({ ...Fixtures.ACME_COPY, vcs }),
          diff: () => Promise.resolve({ base: 'r7', files: [] }),
        },
        bySlug(Fixtures.recordingProbeOf(toplevel).probe),
      )

      return backend?.words.lister
    }

    expect([
      await listerOf('git', null),
      await listerOf('installed-0', '/installed'),
      await listerOf('installed-0', null),
    ]).toEqual(['git', '/installed', 'git'])
  })
})
