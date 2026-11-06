import memoize from 'lodash-es/memoize.js'

export type DebugFilter = {
  include: string[]
  exclude: string[]
  isExclusive: boolean
}

/**
 * Parse debug filter string into a filter configuration
 * Examples:
 * - "api,hooks" -> include only api and hooks categories
 * - "!1p,!file" -> exclude logging and file categories
 * - undefined/empty -> no filtering (show all)
 */
export const parseDebugFilter = memoize(
  (filterString?: string): DebugFilter | null => {
    if (!filterString || filterString.trim() === '') {
      return null
    }

    const filters = filterString
      .split(',')
      .map(f => f.trim())
      .filter(Boolean)

    // If no valid filters remain, return null
    if (filters.length === 0) {
      return null
    }

    // Check for mixed inclusive/exclusive filters
    const hasExclusive = filters.some(f => f.startsWith('!'))
    const hasInclusive = filters.some(f => !f.startsWith('!'))

    if (hasExclusive && hasInclusive) {
      // For now, we'll treat this as an error case and show all messages
      // Log error using logForDebugging to avoid console.error lint rule
      // We'll import and use it later when the circular dependency is resolved
      // For now, just return null silently
      return null
    }

    // Clean up filters (remove ! prefix) and normalize
    const cleanFilters = filters.map(f => f.replace(/^!/, '').toLowerCase())

    return {
      include: hasExclusive ? [] : cleanFilters,
      exclude: hasExclusive ? cleanFilters : [],
      isExclusive: hasExclusive,
    }
  },
)

/**
 * Extract debug categories from a message
 * Supports multiple patterns:
 * - "category: message" -> ["category"]
 * - "[CATEGORY] message" -> ["category"]
 * - "MCP server \"name\": message" -> ["mcp", "name"]
 * - "[ANT-ONLY] 1P event: tengu_timer" -> ["ant-only", "1p"]
 *
 * Returns lowercase categories for case-insensitive matching
 */
export function extractDebugCategories(message: string): string[] {
  const categories: string[] = []

  // Pattern 3: MCP server "servername" - Check this first to avoid false positives
  const mcpMatch = message.match(/^MCP server ["']([^"']+)["']/)
  if (mcpMatch && mcpMatch[1]) {
    categories.push('mcp')
    categories.push(mcpMatch[1].toLowerCase())
  } else {
    // Pattern 1: "category: message" (simple prefix) - only if not MCP pattern
    const prefixMatch = message.match(/^([^:[]+):/)
    if (prefixMatch && prefixMatch[1]) {
      categories.push(prefixMatch[1].trim().toLowerCase())
    }
  }

  // Pattern 2: [CATEGORY] at the start
  const bracketMatch = message.match(/^\[([^\]]+)]/)
  if (bracketMatch && bracketMatch[1]) {
    categories.push(bracketMatch[1].trim().toLowerCase())
  }

  // Pattern 4: Check for additional categories in the message
  // e.g., "[ANT-ONLY] 1P event: tengu_timer" should match both "ant-only" and "1p"
  if (message.toLowerCase().includes('1p event:')) {
    categories.push('1p')
  }

  // Pattern 5: Look for secondary categories after the first pattern
  // e.g., "AutoUpdaterWrapper: Installation type: development"
  const secondaryMatch = message.match(
    /:\s*([^:]+?)(?:\s+(?:type|mode|status|event))?:/,
  )
  if (secondaryMatch && secondaryMatch[1]) {
    const secondary = secondaryMatch[1].trim().toLowerCase()
    // Only add if it's a reasonable category name (not too long, no spaces)
    if (secondary.length < 30 && !secondary.includes(' ')) {
      categories.push(secondary)
    }
  }

  // If no categories found, return empty array (uncategorized)
  return Array.from(new Set(categories)) // Remove duplicates
}

/**
 * Check if debug message should be shown based on filter
 * @param categories - Categories extracted from the message
 * @param filter - Parsed filter configuration
 * @returns true if message should be shown
 */
export function shouldShowDebugCategories(
  categories: string[],
  filter: DebugFilter | null,
): boolean {
  // No filter means show everything
  if (!filter) {
    return true
  }

  // If no categories found, handle based on filter mode
  if (categories.length === 0) {
    // In exclusive mode, uncategorized messages are excluded by default for security
    // In inclusive mode, uncategorized messages are excluded (must match a category)
    return false
  }

  if (filter.isExclusive) {
    // Exclusive mode: show if none of the categories are in the exclude list
    return !categories.some(cat => filter.exclude.includes(cat))
  } else {
    // Inclusive mode: show if any of the categories are in the include list
    return categories.some(cat => filter.include.includes(cat))
  }
}

/**
 * Main function to check if a debug message should be shown
 * Combines extraction and filtering
 */
export function shouldShowDebugMessage(
  message: string,
  filter: DebugFilter | null,
): boolean {
  // Fast path: no filter means show everything
  if (!filter) {
    return true
  }

  // Only extract categories if we have a filter
  const categories = extractDebugCategories(message)
  return shouldShowDebugCategories(categories, filter)
}
