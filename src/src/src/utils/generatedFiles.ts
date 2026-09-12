import { basename, extname, posix, sep } from 'path'

/**
 * File patterns that should be excluded from attribution.
 * Based on GitHub Linguist vendored patterns and common generated file patterns.
 */

// Exact file name matches (case-insensitive)
const EXCLUDED_FILENAMES = new Set([
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

// File extension patterns (case-insensitive)
const EXCLUDED_EXTENSIONS = new Set([
  '.lock',
  '.min.js',
  '.min.css',
  '.min.html',
  '.bundle.js',
  '.bundle.css',
  '.generated.ts',
  '.generated.js',
  '.d.ts', // TypeScript declaration files
])

// Directory patterns that indicate generated/vendored content
const EXCLUDED_DIRECTORIES = [
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
]

// Filename patterns using regex for more complex matching
const EXCLUDED_FILENAME_PATTERNS = [
  /^.*\.min\.[a-z]+$/i, // *.min.*
  /^.*-min\.[a-z]+$/i, // *-min.*
  /^.*\.bundle\.[a-z]+$/i, // *.bundle.*
  /^.*\.generated\.[a-z]+$/i, // *.generated.*
  /^.*\.gen\.[a-z]+$/i, // *.gen.*
  /^.*\.auto\.[a-z]+$/i, // *.auto.*
  /^.*_generated\.[a-z]+$/i, // *_generated.*
  /^.*_gen\.[a-z]+$/i, // *_gen.*
  /^.*\.pb\.(go|js|ts|py|rb)$/i, // Protocol buffer generated files
  /^.*_pb2?\.py$/i, // Python protobuf files
  /^.*\.pb\.h$/i, // C++ protobuf headers
  /^.*\.grpc\.[a-z]+$/i, // gRPC generated files
  /^.*\.swagger\.[a-z]+$/i, // Swagger generated files
  /^.*\.openapi\.[a-z]+$/i, // OpenAPI generated files
]

/**
 * Check if a file should be excluded from attribution based on Linguist-style rules.
 *
 * @param filePath - Relative file path from repository root
 * @returns true if the file should be excluded from attribution
 */
export function isGeneratedFile(filePath: string): boolean {
  // Normalize path separators for consistent pattern matching (patterns use posix-style /)
  const normalizedPath =
    posix.sep + filePath.split(sep).join(posix.sep).replace(/^\/+/, '')
  const fileName = basename(filePath).toLowerCase()
  const ext = extname(filePath).toLowerCase()

  // Check exact filename matches
  if (EXCLUDED_FILENAMES.has(fileName)) {
    return true
  }

  // Check extension matches
  if (EXCLUDED_EXTENSIONS.has(ext)) {
    return true
  }

  // Check for compound extensions like .min.js
  const parts = fileName.split('.')
  if (parts.length > 2) {
    const compoundExt = '.' + parts.slice(-2).join('.')
    if (EXCLUDED_EXTENSIONS.has(compoundExt)) {
      return true
    }
  }

  // Check directory patterns
  for (const dir of EXCLUDED_DIRECTORIES) {
    if (normalizedPath.includes(dir)) {
      return true
    }
  }

  // Check filename patterns
  for (const pattern of EXCLUDED_FILENAME_PATTERNS) {
    if (pattern.test(fileName)) {
      return true
    }
  }

  return false
}

/**
 * Filter a list of files to exclude generated files.
 *
 * @param files - Array of file paths
 * @returns Array of files that are not generated
 */
export function filterGeneratedFiles(files: string[]): string[] {
  return files.filter(file => !isGeneratedFile(file))
}
