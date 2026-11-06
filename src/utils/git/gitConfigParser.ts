/**
 * Lightweight parser for .git/config files.
 *
 * Verified against git's config.c:
 *   - Section names: case-insensitive, alphanumeric + hyphen
 *   - Subsection names (quoted): case-sensitive, backslash escapes (\\ and \")
 *   - Key names: case-insensitive, alphanumeric + hyphen
 *   - Values: optional quoting, inline comments (# or ;), backslash escapes
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * Parse a single value from .git/config.
 * Finds the first matching key under the given section/subsection.
 */
export async function parseGitConfigValue(
  gitDir: string,
  section: string,
  subsection: string | null,
  key: string,
): Promise<string | null> {
  try {
    const config = await readFile(join(gitDir, 'config'), 'utf-8')
    return parseConfigString(config, section, subsection, key)
  } catch {
    return null
  }
}

/**
 * Parse a config value from an in-memory config string.
 * Exported for testing.
 */
export function parseConfigString(
  config: string,
  section: string,
  subsection: string | null,
  key: string,
): string | null {
  const lines = config.split('\n')
  const sectionLower = section.toLowerCase()
  const keyLower = key.toLowerCase()

  let inSection = false
  for (const line of lines) {
    const trimmed = line.trim()

    // Skip empty lines and comment-only lines
    if (trimmed.length === 0 || trimmed[0] === '#' || trimmed[0] === ';') {
      continue
    }

    // Section header
    if (trimmed[0] === '[') {
      inSection = matchesSectionHeader(trimmed, sectionLower, subsection)
      continue
    }

    if (!inSection) {
      continue
    }

    // Key-value line: find the key name
    const parsed = parseKeyValue(trimmed)
    if (parsed && parsed.key.toLowerCase() === keyLower) {
      return parsed.value
    }
  }

  return null
}

/**
 * Parse a key = value line. Returns null if the line doesn't contain a valid key.
 */
function parseKeyValue(line: string): { key: string; value: string } | null {
  // Read key: alphanumeric + hyphen, starting with alpha
  let i = 0
  while (i < line.length && isKeyChar(line[i]!)) {
    i++
  }
  if (i === 0) {
    return null
  }
  const key = line.slice(0, i)

  // Skip whitespace
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i++
  }

  // Must have '='
  if (i >= line.length || line[i] !== '=') {
    // Boolean key with no value — not relevant for our use cases
    return null
  }
  i++ // skip '='

  // Skip whitespace after '='
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i++
  }

  const value = parseValue(line, i)
  return { key, value }
}

/**
 * Parse a config value starting at position i.
 * Handles quoted strings, escape sequences, and inline comments.
 */
function parseValue(line: string, start: number): string {
  let result = ''
  let inQuote = false
  let i = start

  while (i < line.length) {
    const ch = line[i]!

    // Inline comments outside quotes end the value
    if (!inQuote && (ch === '#' || ch === ';')) {
      break
    }

    if (ch === '"') {
      inQuote = !inQuote
      i++
      continue
    }

    if (ch === '\\' && i + 1 < line.length) {
      const next = line[i + 1]!
      if (inQuote) {
        // Inside quotes: recognize escape sequences
        switch (next) {
          case 'n':
            result += '\n'
            break
          case 't':
            result += '\t'
            break
          case 'b':
            result += '\b'
            break
          case '"':
            result += '"'
            break
          case '\\':
            result += '\\'
            break
          default:
            // Git silently drops the backslash for unknown escapes
            result += next
            break
        }
        i += 2
        continue
      }
      // Outside quotes: backslash at end of line = continuation (we don't
      // handle multi-line since we split on \n, but handle \\ and others)
      if (next === '\\') {
        result += '\\'
        i += 2
        continue
      }
      // Fallthrough — treat backslash literally outside quotes
    }

    result += ch
    i++
  }

  // Trim trailing whitespace from unquoted portions.
  // Git trims trailing whitespace that isn't inside quotes, but since we
  // process char-by-char and quotes toggle, the simplest correct approach
  // for single-line values is to trim the result when not ending in a quote.
  if (!inQuote) {
    result = trimTrailingWhitespace(result)
  }

  return result
}

function trimTrailingWhitespace(s: string): string {
  let end = s.length
  while (end > 0 && (s[end - 1] === ' ' || s[end - 1] === '\t')) {
    end--
  }
  return s.slice(0, end)
}

/**
 * Check if a config line like `[remote "origin"]` matches the given section/subsection.
 * Section matching is case-insensitive; subsection matching is case-sensitive.
 */
function matchesSectionHeader(
  line: string,
  sectionLower: string,
  subsection: string | null,
): boolean {
  // line starts with '['
  let i = 1

  // Read section name
  while (
    i < line.length &&
    line[i] !== ']' &&
    line[i] !== ' ' &&
    line[i] !== '\t' &&
    line[i] !== '"'
  ) {
    i++
  }
  const foundSection = line.slice(1, i).toLowerCase()

  if (foundSection !== sectionLower) {
    return false
  }

  if (subsection === null) {
    // Simple section: must end with ']'
    return i < line.length && line[i] === ']'
  }

  // Skip whitespace before subsection quote
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) {
    i++
  }

  // Must have opening quote
  if (i >= line.length || line[i] !== '"') {
    return false
  }
  i++ // skip opening quote

  // Read subsection — case-sensitive, handle \\ and \" escapes
  let foundSubsection = ''
  while (i < line.length && line[i] !== '"') {
    if (line[i] === '\\' && i + 1 < line.length) {
      const next = line[i + 1]!
      if (next === '\\' || next === '"') {
        foundSubsection += next
        i += 2
        continue
      }
      // Git drops the backslash for other escapes in subsections
      foundSubsection += next
      i += 2
      continue
    }
    foundSubsection += line[i]
    i++
  }

  // Must have closing quote followed by ']'
  if (i >= line.length || line[i] !== '"') {
    return false
  }
  i++ // skip closing quote

  if (i >= line.length || line[i] !== ']') {
    return false
  }

  return foundSubsection === subsection
}

function isKeyChar(ch: string): boolean {
  return (
    (ch >= 'a' && ch <= 'z') ||
    (ch >= 'A' && ch <= 'Z') ||
    (ch >= '0' && ch <= '9') ||
    ch === '-'
  )
}
