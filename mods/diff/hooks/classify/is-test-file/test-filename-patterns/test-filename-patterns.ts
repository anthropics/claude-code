/**
 * File-name shapes of test files and snapshots, the engine's test file-name
 * patterns.
 */
export const TEST_FILENAME_PATTERNS: readonly RegExp[] = Object.freeze([
  /\.test\.[a-z]+$/i,
  /\.spec\.[a-z]+$/i,
  /_test\.[a-z]+$/i,
  /_spec\.[a-z]+$/i,
  /\.snap$/i,
])
