/**
 * File names (lowercase) that are lockfiles or shrinkwraps, never hand
 * written, so their churn is noise in a diff.
 */
export const GENERATED_FILENAMES: ReadonlySet<string> = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'composer.lock',
  'gemfile.lock',
  'cargo.lock',
  'poetry.lock',
  'pipfile.lock',
  'shrinkwrap.json',
  'npm-shrinkwrap.json',
])
