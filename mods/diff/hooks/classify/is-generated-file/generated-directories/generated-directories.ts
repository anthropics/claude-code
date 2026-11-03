/**
 * Path segments of build output, vendored code, caches and snapshots, the
 * engine's excluded directories, matched against `/<path>`.
 */
export const GENERATED_DIRECTORIES = [
  '/dist/',
  '/build/',
  '/out/',
  '/output/',
  '/node_modules/',
  '/vendor/',
  '/vendored/',
  '/third_party/',
  '/third-party/',
  '/external/',
  '/.next/',
  '/.nuxt/',
  '/.svelte-kit/',
  '/coverage/',
  '/__pycache__/',
  '/.tox/',
  '/venv/',
  '/.venv/',
  '/target/release/',
  '/target/debug/',
  '.generated/',
  '/__snapshots__/',
] as const
