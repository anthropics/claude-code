import { Ajv } from 'ajv'
import { z } from 'zod/v4'
import type { Tool, ToolInputJSONSchema } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../utils/errors.js'
import { lazySchema } from '../../utils/lazySchema.js'
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js'
import { jsonStringify } from '../../utils/slowOperations.js'

// Allow any input object since the schema is provided dynamically
const inputSchema = lazySchema(() => z.object({}).passthrough())
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.string().describe('Structured output tool result'),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const SYNTHETIC_OUTPUT_TOOL_NAME = 'StructuredOutput'

export function isSyntheticOutputToolEnabled(opts: {
  isNonInteractiveSession: boolean
}): boolean {
  return opts.isNonInteractiveSession
}

export const SyntheticOutputTool = buildTool({
  isMcp: false,
  isEnabled() {
    // This tool is only created when conditions are met (see main.tsx where
    // isSyntheticOutputToolEnabled() gates tool creation). Once created, always enabled.
    return true
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  isOpenWorld() {
    return false
  },
  name: SYNTHETIC_OUTPUT_TOOL_NAME,
  searchHint: 'return the final response as structured JSON',
  maxResultSizeChars: 100_000,
  async description(): Promise<string> {
    return 'Return structured output in the requested format'
  },
  async prompt(): Promise<string> {
    return `Use this tool to return your final response in the requested structured format. You MUST call this tool exactly once at the end of your response to provide the structured output.`
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  async call(input) {
    // The tool just validates and returns the input as the structured output
    return {
      data: 'Structured output provided successfully',
      structured_output: input,
    }
  },
  async checkPermissions(input): Promise<PermissionResult> {
    // Always allow this tool - it's just returning data
    return {
      behavior: 'allow',
      updatedInput: input,
    }
  },
  // Minimal UI implementations - this tool is for non-interactive SDK/CLI use
  renderToolUseMessage(input: Record<string, unknown>) {
    const keys = Object.keys(input)
    if (keys.length === 0) return null
    if (keys.length <= 3) {
      return keys.map(k => `${k}: ${jsonStringify(input[k])}`).join(', ')
    }
    return `${keys.length} fields: ${keys.slice(0, 3).join(', ')}…`
  },
  renderToolUseRejectedMessage() {
    return 'Structured output rejected'
  },
  renderToolUseErrorMessage() {
    return 'Structured output error'
  },
  renderToolUseProgressMessage() {
    return null
  },
  renderToolResultMessage(output: string) {
    return output
  },
  mapToolResultToToolResultBlockParam(content: string, toolUseID: string) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content,
    }
  },
} satisfies ToolDef<InputSchema, Output>)

type CreateResult = { tool: Tool<InputSchema> } | { error: string }

// Workflow scripts call agent({schema: BUGS_SCHEMA}) 30-80 times per run with
// the same schema object reference. Without caching, each call does
// new Ajv() + validateSchema() + compile() (~1.4ms of JIT codegen). Identity
// cache brings 80-call workflows from ~110ms to ~4ms Ajv overhead.
const toolCache = new WeakMap<object, CreateResult>()

/**
 * Create a SyntheticOutputTool configured with the given JSON schema.
 * Returns {tool} on success or {error} with Ajv's diagnostic message
 * (e.g. "data/properties/bugs should be object") on invalid schema.
 */
export function createSyntheticOutputTool(
  jsonSchema: Record<string, unknown>,
): CreateResult {
  const cached = toolCache.get(jsonSchema)
  if (cached) return cached

  const result = buildSyntheticOutputTool(jsonSchema)
  toolCache.set(jsonSchema, result)
  return result
}

function buildSyntheticOutputTool(
  jsonSchema: Record<string, unknown>,
): CreateResult {
  try {
    const ajv = new Ajv({ allErrors: true })
    const isValidSchema = ajv.validateSchema(jsonSchema)
    if (!isValidSchema) {
      return { error: ajv.errorsText(ajv.errors) }
    }
    const validateSchema = ajv.compile(jsonSchema)

    return {
      tool: {
        ...SyntheticOutputTool,
        inputJSONSchema: jsonSchema as ToolInputJSONSchema,
        async call(input) {
          const isValid = validateSchema(input)
          if (!isValid) {
            const errors = validateSchema.errors
              ?.map(e => `${e.instancePath || 'root'}: ${e.message}`)
              .join(', ')
            throw new TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS(
              `Output does not match required schema: ${errors}`,
              `StructuredOutput schema mismatch: ${(errors ?? '').slice(0, 150)}`,
            )
          }
          return {
            data: 'Structured output provided successfully',
            structured_output: input,
          }
        },
      },
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
