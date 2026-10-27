/**
 * Path segments of tests, specs, mocks and fixtures, the engine's test
 * directories, matched against `/<path>`.
 */
export const TEST_DIRECTORIES = [
  '/test/',
  '/tests/',
  '/spec/',
  '/specs/',
  '/__tests__/',
  '/__mocks__/',
  '/__snapshots__/',
  '/__fixtures__/',
  '/fixtures/',
  '/testdata/',
] as const
