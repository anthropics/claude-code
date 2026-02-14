/**
 * Tool Cache Adapter for the Claude Agent SDK.
 *
 * Intercepts PreToolUse/PostToolUse hooks to cache results from
 * idempotent tools (Read, Glob, Grep, WebSearch, WebFetch) while
 * automatically invalidating when mutating tools (Write, Edit, Bash)
 * execute.
 *
 * @example
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { ToolCacheAdapter } from "./lib/cache";
 *
 * const cache = new ToolCacheAdapter({ debug: true });
 *
 * for await (const message of query({
 *   prompt: "Analyze this codebase",
 *   options: {
 *     allowedTools: ["Read", "Glob", "Grep"],
 *     hooks: cache.hooks(),
 *   }
 * })) {
 *   console.log(message);
 * }
 * ```
 */

export { ToolCacheAdapter } from "./adapter";
export { MemoryCacheStore } from "./memory-store";
export { NeonCacheStore } from "./neon-store";

export type {
  CacheStore,
  CacheEntry,
  CacheEntryMeta,
  CacheStats,
  ToolCachePolicy,
  ToolCacheAdapterOptions,
  ToolName,
  BuiltInToolName,
  ToolInput,
  CacheStrategy,
  BashToolInput,
  ReadToolInput,
  WriteToolInput,
  EditToolInput,
  GlobToolInput,
  GrepToolInput,
  WebSearchToolInput,
  WebFetchToolInput,
  TaskToolInput,
} from "./types";

export { DEFAULT_TOOL_POLICIES } from "./types";
