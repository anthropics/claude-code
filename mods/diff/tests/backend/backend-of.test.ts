import { describe, expect, test, tier } from 'claude-code/testing'

import Backend from '../../hooks/backend'
import Fixtures from '../fixtures'

tier('builtin')

describe('backend-of', () => {
  test('as published: no probes, so git or nothing', async () => {
    const inGit = Fixtures.gitHostOf()
    const outside = Fixtures.recordingBackendHostOf({})

    expect((await Backend.backendOf(inGit.host, []))?.words.lister).toBe('git')
    expect(await Backend.backendOf(outside.host, [])).toBeNull()
    expect([inGit.programs, outside.programs]).toEqual([['git'], ['git']])
  })

  test('a declining probe leaves a git working tree to git', async () => {
    const declining = Fixtures.recordingProbeOf(null)
    const inGit = Fixtures.gitHostOf()
    const backend = await Backend.backendOf(inGit.host, [declining.probe])

    expect(backend?.words.lister).toBe('git')
    expect(backend?.baseModes).toEqual(['session', 'uncommitted', 'branch'])
    expect(declining.asked).toEqual([inGit.host])
    expect(inGit.programs).toEqual(['git'])
  })

  test('a probe that answers pins before git is asked', async () => {
    const inGit = Fixtures.gitHostOf()

    const backend = await Backend.backendOf(inGit.host, [
      Fixtures.recordingProbeOf('/home/me/src').probe,
    ])

    expect(backend?.repository).toEqual({ toplevel: '/home/me/src' })
    expect(inGit.programs).toEqual([])
  })

  test('the probes are asked in order and the first answer pins', async () => {
    const declining = Fixtures.recordingProbeOf(null)
    const first = Fixtures.recordingProbeOf('/first')
    const second = Fixtures.recordingProbeOf('/second')
    const { host } = Fixtures.recordingBackendHostOf({})

    const backend = await Backend.backendOf(host, [
      declining.probe,
      first.probe,
      second.probe,
    ])

    expect(backend?.repository).toEqual({ toplevel: '/first' })

    expect([
      declining.asked.length,
      first.asked.length,
      second.asked.length,
    ]).toEqual([1, 1, 0])

    expect(declining.asked[0]).toBe(host)
  })
})
