import { z } from 'zod/v4'
import type { ValidationResult } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { isENOENT } from '../../utils/errors.js'
import {
  FILE_NOT_FOUND_CWD_NOTE,
  suggestPathUnderCwd,
} from '../../utils/file.js'
import { getFsImplementation } from '../../utils/fsOperations.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { expandPath, toRelativePath } from '../../utils/path.js'
import {
  checkReadPermissionForTool,
  getFileReadIgnorePatterns,
  normalizePatternsToPath,
} from '../../utils/permissions/filesystem.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import { matchWildcardPattern } from '../../utils/permissions/shellRuleMatching.js'
import { getGlobExclusionsForPluginCache } from '../../utils/plugins/orphanedPluginFilter.js'
import { ripGrep } from '../../utils/ripgrep.js'
import { semanticBoolean } from '../../utils/semanticBoolean.js'
import { semanticNumber } from '../../utils/semanticNumber.js'
import { plural } from '../../utils/stringUtils.js'
import { GREP_TOOL_NAME, getDescription } from './prompt.js'
import {
  getToolUseSummary,
  renderToolResultMessage,
  renderToolUseErrorMessage,
  renderToolUseMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z
      .string()
      .describe(
        'The regular expression pattern to search for in file contents',
      ),
    path: z
      .string()
      .optional()
      .describe(
        'File or directory to search in (rg PATH). Defaults to current working directory.',
      ),
    glob: z
      .string()
      .optional()
      .describe(
        'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") - maps to rg --glob',
      ),
    output_mode: z
      .enum(['content', 'files_with_matches', 'count'])
      .optional()
      .describe(
        'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts (supports head_limit). Defaults to "files_with_matches".',
      ),
    '-B': semanticNumber(z.number().optional()).describe(
      'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
    ),
    '-A': semanticNumber(z.number().optional()).describe(
      'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
    ),
    '-C': semanticNumber(z.number().optional()).describe('Alias for context.'),
    context: semanticNumber(z.number().optional()).describe(
      'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
    ),
    '-n': semanticBoolean(z.boolean().optional()).describe(
      'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
    ),
    '-i': semanticBoolean(z.boolean().optional()).describe(
      'Case insensitive search (rg -i)',
    ),
    type: z
      .string()
      .optional()
      .describe(
        'File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than include for standard file types.',
      ),
    head_limit: semanticNumber(z.number().optional()).describe(
      'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes: content (limits output lines), files_with_matches (limits file paths), count (limits count entries). Defaults to 250 when unspecified. Pass 0 for unlimited (use sparingly — large result sets waste context).',
    ),
    offset: semanticNumber(z.number().optional()).describe(
      'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Works across all output modes. Defaults to 0.',
    ),
    multiline: semanticBoolean(z.boolean().optional()).describe(
      'Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.',
    ),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

// Version control system directories to exclude from searches
// These are excluded automatically because they create noise in search results
const VCS_DIRECTORIES_TO_EXCLUDE = [
  '.git',
  '.svn',
  '.hg',
  '.bzr',
  '.jj',
  '.sl',
] as const

// Default cap on grep results when head_limit is unspecified. Unbounded content-mode
// greps can fill up to the 20KB persist threshold (~6-24K tokens/grep-heavy session).
// 250 is generous enough for exploratory searches while preventing context bloat.
// Pass head_limit=0 explicitly for unlimited.
const DEFAULT_HEAD_LIMIT = 250

function applyHeadLimit<T>(
  items: T[],
  limit: number | undefined,
  offset: number = 0,
): { items: T[]; appliedLimit: number | undefined } {
  // Explicit 0 = unlimited escape hatch
  if (limit === 0) {
    return { items: items.slice(offset), appliedLimit: undefined }
  }
  const effectiveLimit = limit ?? DEFAULT_HEAD_LIMIT
  const sliced = items.slice(offset, offset + effectiveLimit)
  // Only report appliedLimit when truncation actually occurred, so the model
  // knows there may be more results and can paginate with offset.
  const wasTruncated = items.length - offset > effectiveLimit
  return {
    items: sliced,
    appliedLimit: wasTruncated ? effectiveLimit : undefined,
  }
}

// Format limit/offset information for display in tool results.
// appliedLimit is only set when truncation actually occurred (see applyHeadLimit),
// so it may be undefined even when appliedOffset is set — build parts conditionally
// to avoid "limit: undefined" appearing in user-visible output.
function formatLimitInfo(
  appliedLimit: number | undefined,
  appliedOffset: number | undefined,
): string {
  const parts: string[] = []
  if (appliedLimit !== undefined) parts.push(`limit: ${appliedLimit}`)
  if (appliedOffset) parts.push(`offset: ${appliedOffset}`)
  return parts.join(', ')
}

const outputSchema = lazySchema(() =>
  z.object({
    mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
    numFiles: z.number(),
    filenames: z.array(z.string()),
    content: z.string().optional(),
    numLines: z.number().optional(), // For content mode
    numMatches: z.number().optional(), // For count mode
    appliedLimit: z.number().optional(), // The limit that was applied (if any)
    appliedOffset: z.number().optional(), // The offset that was applied
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

type Output = z.infer<OutputSchema>

export const GrepTool = buildTool({
  name: GREP_TOOL_NAME,
  searchHint: 'search file contents with regex (ripgrep)',
  // 20K chars - tool result persistence threshold
  maxResultSizeChars: 20_000,
  strict: true,
  async description() {
    return getDescription()
  },
  userFacingName() {
    return 'Search'
  },
  getToolUseSummary,
  getActivityDescription(input) {
    const summary = getToolUseSummary(input)
    return summary ? `Searching for ${summary}` : 'Searching'
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return input.path ? `${input.pattern} in ${input.path}` : input.pattern
  },
  isSearchOrReadCommand() {
    return { isSearch: true, isRead: false }
  },
  getPath({ path }): string {
    return path || getCwd()
  },
  async preparePermissionMatcher({ pattern }) {
    return rulePattern => matchWildcardPattern(rulePattern, pattern)
  },
  async validateInput({ path }): Promise<ValidationResult> {
    // If path is provided, validate that it exists
    if (path) {
      const fs = getFsImplementation()
      const absolutePath = expandPath(path)

      // SECURITY: Skip filesystem operations for UNC paths to prevent NTLM credential leaks.
      if (absolutePath.startsWith('\\\\') || absolutePath.startsWith('//')) {
        return { result: true }
      }

      try {
        await fs.stat(absolutePath)
      } catch (e: unknown) {
        if (isENOENT(e)) {
          const cwdSuggestion = await suggestPathUnderCwd(absolutePath)
          let message = `Path does not exist: ${path}. ${FILE_NOT_FOUND_CWD_NOTE} ${getCwd()}.`
          if (cwdSuggestion) {
            message += ` Did you mean ${cwdSuggestion}?`
          }
          return {
            result: false,
            message,
            errorCode: 1,
          }
        }
        throw e
      }
    }

    return { result: true }
  },
  async checkPermissions(input, context): Promise<PermissionDecision> {
    const appState = context.getAppState()
    return checkReadPermissionForTool(
      GrepTool,
      input,
      appState.toolPermissionContext,
    )
  },
  async prompt() {
    return getDescription()
  },
  renderToolUseMessage,
  renderToolUseErrorMessage,
  renderToolResultMessage,
  // SearchResultSummary shows content (mode=content) or filenames.join.
  // numFiles/numLines/numMatches are chrome ("Found 3 files") — fine to
  // skip (under-count, not phantom). Glob reuses this via UI.tsx:65.
  extractSearchText({ mode, content, filenames }) {
    if (mode === 'content' && content) return content
    return filenames.join('\n')
  },
  mapToolResultToToolResultBlockParam(
    {
      mode = 'files_with_matches',
      numFiles,
      filenames,
      content,
      numLines: _numLines,
      numMatches,
      appliedLimit,
      appliedOffset,
    },
    toolUseID,
  ) {
    if (mode === 'content') {
      const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
      const resultContent = content || 'No matches found'
      const finalContent = limitInfo
        ? `${resultContent}\n\n[Showing results with pagination = ${limitInfo}]`
        : resultContent
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: finalContent,
      }
    }

    if (mode === 'count') {
      const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
      const rawContent = content || 'No matches found'
      const matches = numMatches ?? 0
      const files = numFiles ?? 0
      const summary = `\n\nFound ${matches} total ${matches === 1 ? 'occurrence' : 'occurrences'} across ${files} ${files === 1 ? 'file' : 'files'}.${limitInfo ? ` with pagination = ${limitInfo}` : ''}`
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: rawContent + summary,
      }
    }

    // files_with_matches mode
    const limitInfo = formatLimitInfo(appliedLimit, appliedOffset)
    if (numFiles === 0) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: 'No files found',
      }
    }
    // head_limit has already been applied in call() method, so just show all filenames
    const result = `Found ${numFiles} ${plural(numFiles, 'file')}${limitInfo ? ` ${limitInfo}` : ''}\n${filenames.join('\n')}`
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: result,
    }
  },
  async call(
    {
      pattern,
      path,
      glob,
      type,
      output_mode = 'files_with_matches',
      '-B': context_before,
      '-A': context_after,
      '-C': context_c,
      context,
      '-n': show_line_numbers = true,
      '-i': case_insensitive = false,
      head_limit,
      offset = 0,
      multiline = false,
    },
    { abortController, getAppState },
  ) {
    const absolutePath = path ? expandPath(path) : getCwd()
    const args = ['--hidden']

    // Exclude VCS directories to avoid noise from version control metadata
    for (const dir of VCS_DIRECTORIES_TO_EXCLUDE) {
      args.push('--glob', `!${dir}`)
    }

    // Limit line length to prevent base64/minified content from cluttering output
    args.push('--max-columns', '500')

    // Only apply multiline flags when explicitly requested
    if (multiline) {
      args.push('-U', '--multiline-dotall')
    }

    // Add optional flags
    if (case_insensitive) {
      args.push('-i')
    }

    // Add output mode flags
    if (output_mode === 'files_with_matches') {
      args.push('-l')
    } else if (output_mode === 'count') {
      args.push('-c')
    }

    // Add line numbers if requested
    if (show_line_numbers && output_mode === 'content') {
      args.push('-n')
    }

    // Add context flags (-C/context takes precedence over context_before/context_after)
    if (output_mode === 'content') {
      if (context !== undefined) {
        args.push('-C', context.toString())
      } else if (context_c !== undefined) {
        args.push('-C', context_c.toString())
      } else {
        if (context_before !== undefined) {
          args.push('-B', context_before.toString())
        }
        if (context_after !== undefined) {
          args.push('-A', context_after.toString())
        }
      }
    }

    // If pattern starts with dash, use -e flag to specify it as a pattern
    // This prevents ripgrep from interpreting it as a command-line option
    if (pattern.startsWith('-')) {
      args.push('-e', pattern)
    } else {
      args.push(pattern)
    }

    // Add type filter if specified
    if (type) {
      args.push('--type', type)
    }

    if (glob) {
      // Split on commas and spaces, but preserve patterns with braces
      const globPatterns: string[] = []
      const rawPatterns = glob.split(/\s+/)

      for (const rawPattern of rawPatterns) {
        // If pattern contains braces, don't split further
        if (rawPattern.includes('{') && rawPattern.includes('}')) {
          globPatterns.push(rawPattern)
        } else {
          // Split on commas for patterns without braces
          globPatterns.push(...rawPattern.split(',').filter(Boolean))
        }
      }

      for (const globPattern of globPatterns.filter(Boolean)) {
        args.push('--glob', globPattern)
      }
    }

    // Add ignore patterns
    const appState = getAppState()
    const ignorePatterns = normalizePatternsToPath(
      getFileReadIgnorePatterns(appState.toolPermissionContext),
      getCwd(),
    )
    for (const ignorePattern of ignorePatterns) {
      // Note: ripgrep only applies gitignore patterns relative to the working directory
      // So for non-absolute paths, we need to prefix them with '**'
      // See: https://github.com/BurntSushi/ripgrep/discussions/2156#discussioncomment-2316335
      //
      // We also need to negate the pattern with `!` to exclude it
      const rgIgnorePattern = ignorePattern.startsWith('/')
        ? `!${ignorePattern}`
        : `!**/${ignorePattern}`
      args.push('--glob', rgIgnorePattern)
    }

    // Exclude orphaned plugin version directories
    for (const exclusion of await getGlobExclusionsForPluginCache(
      absolutePath,
    )) {
      args.push('--glob', exclusion)
    }

    // WSL has severe performance penalty for file reads (3-5x slower on WSL2)
    // The timeout is handled by ripgrep itself via execFile timeout option
    // We don't use AbortController for timeout to avoid interrupting the agent loop
    // If ripgrep times out, it throws RipgrepTimeoutError which propagates up
    // so Claude knows the search didn't complete (rather than thinking there were no matches)
    const results = await ripGrep(args, absolutePath, abortController.signal)

    if (output_mode === 'content') {
      // For content mode, results are the actual content lines
      // Convert absolute paths to relative paths to save tokens

      // Apply head_limit first — relativize is per-line work, so
      // avoid processing lines that will be discarded (broad patterns can
      // return 10k+ lines with head_limit keeping only ~30-100).
      const { items: limitedResults, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      )

      const finalLines = limitedResults.map(line => {
        // Lines have format: /absolute/path:line_content or /absolute/path:num:content
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const filePath = line.substring(0, colonIndex)
          const rest = line.substring(colonIndex)
          return toRelativePath(filePath) + rest
        }
        return line
      })
      const output = {
        mode: 'content' as const,
        numFiles: 0, // Not applicable for content mode
        filenames: [],
        content: finalLines.join('\n'),
        numLines: finalLines.length,
        ...(appliedLimit !== undefined && { appliedLimit }),
        ...(offset > 0 && { appliedOffset: offset }),
      }
      return { data: output }
    }

    if (output_mode === 'count') {
      // For count mode, pass through raw ripgrep output (filename:count format)
      // Apply head_limit first to avoid relativizing entries that will be discarded.
      const { items: limitedResults, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      )

      // Convert absolute paths to relative paths to save tokens
      const finalCountLines = limitedResults.map(line => {
        // Lines have format: /absolute/path:count
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex > 0) {
          const filePath = line.substring(0, colonIndex)
          const count = line.substring(colonIndex)
          return toRelativePath(filePath) + count
        }
        return line
      })

      // Parse count output to extract total matches and file count
      let totalMatches = 0
      let fileCount = 0
      for (const line of finalCountLines) {
        const colonIndex = line.lastIndexOf(':')
        if (colonIndex > 0) {
          const countStr = line.substring(colonIndex + 1)
          const count = parseInt(countStr, 10)
          if (!isNaN(count)) {
            totalMatches += count
            fileCount += 1
          }
        }
      }

      const output = {
        mode: 'count' as const,
        numFiles: fileCount,
        filenames: [],
        content: finalCountLines.join('\n'),
        numMatches: totalMatches,
        ...(appliedLimit !== undefined && { appliedLimit }),
        ...(offset > 0 && { appliedOffset: offset }),
      }
      return { data: output }
    }

    // For files_with_matches mode (default)
    // Use allSettled so a single ENOENT (file deleted between ripgrep's scan
    // and this stat) does not reject the whole batch. Failed stats sort as mtime 0.
    const stats = await Promise.allSettled(
      results.map(_ => getFsImplementation().stat(_)),
    )
    const sortedMatches = results
      // Sort by modification time
      .map((_, i) => {
        const r = stats[i]!
        return [
          _,
          r.status === 'fulfilled' ? (r.value.mtimeMs ?? 0) : 0,
        ] as const
      })
      .sort((a, b) => {
        if (process.env.NODE_ENV === 'test') {
          // In tests, we always want to sort by filename, so that results are deterministic
          return a[0].localeCompare(b[0])
        }
        const timeComparison = b[1] - a[1]
        if (timeComparison === 0) {
          // Sort by filename as a tiebreaker
          return a[0].localeCompare(b[0])
        }
        return timeComparison
      })
      .map(_ => _[0])

    // Apply head_limit to sorted file list (like "| head -N")
    const { items: finalMatches, appliedLimit } = applyHeadLimit(
      sortedMatches,
      head_limit,
      offset,
    )

    // Convert absolute paths to relative paths to save tokens
    const relativeMatches = finalMatches.map(toRelativePath)

    const output = {
      mode: 'files_with_matches' as const,
      filenames: relativeMatches,
      numFiles: relativeMatches.length,
      ...(appliedLimit !== undefined && { appliedLimit }),
      ...(offset > 0 && { appliedOffset: offset }),
    }

    return {
      data: output,
    }
  },
} satisfies ToolDef<InputSchema, Output>)
