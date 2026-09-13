import { describe, expect, test, tier } from 'claude-code/testing'

import Classify from '../../hooks/classify'

tier('builtin')

describe('is-noise-file', () => {
  test('tests, fixtures and snapshots are noise', () => {
    for (const path of [
      'test/a.ts',
      'src/x/__tests__/y.ts',
      'lib/foo.test.tsx',
      'pkg/bar_test.go',
      'web/fixtures/data.json',
      'ui/__snapshots__/a.snap',
    ]) {
      expect(Classify.isNoiseFile(path), path).toBe(true)
    }
  })

  test('lockfiles, builds, minified and generated files are noise', () => {
    for (const path of [
      'bun.lock',
      'package-lock.json',
      'dist/index.js',
      'assets/app.min.js',
      'types/api.d.ts',
      'src/constants/prompts.generated/x.ts',
      'proto/service.pb.go',
    ]) {
      expect(Classify.isNoiseFile(path), path).toBe(true)
    }
  })

  test('source is not, even with test inside a longer word', () => {
    for (const path of ['src/contest/entry.ts', 'src/latest.ts', 'README.md']) {
      expect(Classify.isNoiseFile(path), path).toBe(false)
    }
  })
})
