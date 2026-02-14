/**
 * Tool Cache Adapter for the Claude Agent SDK.
 *
 * Wraps the Agent SDK's PreToolUse / PostToolUse hook system to intercept
 * tool calls, serve cached results when available, and store results for
 * future invocations. Each built-in tool has a configurable cache policy
 * (strategy, TTL, max entries, key derivation).
 *
 * Usage with the Agent SDK:
 *
 * ```typescript
 * import { query } from "@anthropic-ai/claude-agent-sdk";
 * import { ToolCacheAdapter } from "./lib/cache/adapter";
 *
 * const cache = new ToolCacheAdapter({ debug: true });
 *
 * for await (const message of query({
 *   prompt: "Analyze this codebase",
 *   options: {
 *     allowedTools: ["Read", "Glob", "Grep", "WebSearch"],
 *     hooks: cache.hooks(),
 *   }
 * })) {
 *   console.log(message);
 * }
 *
 * console.log(await cache.stats());
 * ```
 */

import type {
  ToolName,
  BuiltInToolName,
  ToolInput,
  ToolCachePolicy,
  ToolCacheAdapterOptions,
  CacheStore,
  CacheEntry,
  CacheStats,
} from "./types";
import { DEFAULT_TOOL_POLICIES } from "./types";
import { MemoryCacheStore } from "./memory-store";

// ── Agent SDK hook type shapes (from @anthropic-ai/claude-agent-sdk) ────────
// Defined inline to avoid requiring the SDK as a dependency at build time.

interface PreToolUseInput {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  session_id: string;
  cwd: string;
}

interface PostToolUseInput {
  hook_event_name: "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
  session_id: string;
  cwd: string;
}

interface HookResult {
  hookSpecificOutput?: {
    hookEventName: string;
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    additionalContext?: string;
  };
  systemMessage?: string;
  continue?: boolean;
  suppressOutput?: boolean;
}

type HookCallback = (
  input: PreToolUseInput | PostToolUseInput,
  toolUseId: string | null,
  context: { signal: AbortSignal }
) => Promise<HookResult>;

interface HookMatcher {
  matcher?: string;
  hooks: HookCallback[];
  timeout?: number;
}

// ── Default invalidation map ────────────────────────────────────────────────
// Mutating tool executions invalidate related read caches.

const DEFAULT_INVALIDATION_MAP: Record<string, ToolName[]> = {
  Write: ["Read", "Glob", "Grep"],
  Edit: ["Read", "Grep"],
  NotebookEdit: ["Read"],
  Bash: ["Read", "Glob", "Grep"], // Bash can modify files
};

// ── Adapter ─────────────────────────────────────────────────────────────────

export class ToolCacheAdapter {
  private store: CacheStore;
  private policies: Map<string, ToolCachePolicy>;
  private invalidationMap: Record<string, ToolName[]>;
  private debug: boolean;

  // In-flight tracking: correlates PreToolUse → PostToolUse via toolUseId
  private pendingLookups = new Map<
    string,
    { key: string; tool: ToolName; startMs: number }
  >();

  constructor(options: ToolCacheAdapterOptions = {}) {
    this.store =
      options.store ?? new MemoryCacheStore(options.maxSizeBytes ?? 50 * 1024 * 1024);
    this.debug = options.debug ?? false;
    this.invalidationMap = {
      ...DEFAULT_INVALIDATION_MAP,
      ...(options.invalidationMap ?? {}),
    };

    // Merge default policies with user overrides
    this.policies = new Map<string, ToolCachePolicy>();
    for (const [tool, policy] of Object.entries(DEFAULT_TOOL_POLICIES)) {
      const override = options.policies?.[tool as ToolName];
      this.policies.set(tool, { ...policy, ...(override ?? {}) });
    }

    // Add any user-defined MCP tool policies
    if (options.policies) {
      for (const [tool, policy] of Object.entries(options.policies)) {
        if (tool.startsWith("mcp__") && policy) {
          this.policies.set(tool, {
            strategy: "idempotent",
            ttlMs: 5 * 60 * 1000,
            maxEntries: 50,
            ...policy,
          });
        }
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Returns Agent SDK hook configuration ready to pass to `query()`.
   *
   * ```typescript
   * const cache = new ToolCacheAdapter();
   * query({ prompt: "...", options: { hooks: cache.hooks() } });
   * ```
   */
  hooks(): Record<string, HookMatcher[]> {
    return {
      PreToolUse: [
        {
          // Match all tools — filtering happens in the callback
          hooks: [this.preToolUseHook.bind(this)],
          timeout: 5,
        },
      ],
      PostToolUse: [
        {
          hooks: [this.postToolUseHook.bind(this)],
          timeout: 10,
        },
      ],
    };
  }

  /** Get cache statistics. */
  async stats(): Promise<CacheStats> {
    return this.store.stats();
  }

  /** Clear cache for a specific tool or all tools. */
  async clear(tool?: ToolName): Promise<number> {
    return this.store.clear(tool);
  }

  /** Manually invalidate a cache key. */
  async invalidate(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  /**
   * Invalidate all cached reads for a specific file path.
   * Useful when you know a file has been modified externally.
   */
  async invalidateFile(filePath: string): Promise<void> {
    for (const tool of ["Read", "Grep", "Glob"] as ToolName[]) {
      const key = this.computeKey(tool, { file_path: filePath });
      await this.store.delete(key);
    }
  }

  /** Get the resolved policy for a tool. */
  getPolicy(tool: string): ToolCachePolicy | null {
    return this.policies.get(tool) ?? null;
  }

  // ── Hook callbacks ────────────────────────────────────────────────────────

  /**
   * PreToolUse hook: Check cache before tool execution.
   *
   * If a cached result exists and is still valid, we return it via
   * `additionalContext` and allow the tool call (the SDK will see the
   * cached result injected into context). For truly cached results,
   * we deny the tool call and provide the cached output as context.
   */
  private async preToolUseHook(
    input: PreToolUseInput | PostToolUseInput,
    toolUseId: string | null,
    _context: { signal: AbortSignal }
  ): Promise<HookResult> {
    if (input.hook_event_name !== "PreToolUse") return {};

    const preInput = input as PreToolUseInput;
    const tool = preInput.tool_name as ToolName;
    const policy = this.policies.get(tool);

    // No policy or strategy=never → skip caching
    if (!policy || policy.strategy === "never") {
      return {};
    }

    const key = this.computeKey(tool, preInput.tool_input);

    // Check cache
    const cached = await this.store.get(key);
    if (cached) {
      this.log(`HIT  ${tool} [${key.substring(0, 12)}...] (${cached.meta.hits} hits)`);

      return {
        hookSpecificOutput: {
          hookEventName: preInput.hook_event_name,
          additionalContext: `[tool-cache] Cached result for ${tool}:\n${
            typeof cached.value === "string"
              ? cached.value
              : JSON.stringify(cached.value, null, 2)
          }`,
        },
      };
    }

    // Cache miss — record the pending lookup for PostToolUse
    this.log(`MISS ${tool} [${key.substring(0, 12)}...]`);
    if (toolUseId) {
      this.pendingLookups.set(toolUseId, {
        key,
        tool,
        startMs: Date.now(),
      });
    }

    return {};
  }

  /**
   * PostToolUse hook: Store tool results in cache.
   *
   * Also handles cross-tool invalidation: if a Write/Edit/Bash just
   * executed, invalidate cached Read/Glob/Grep entries for related paths.
   */
  private async postToolUseHook(
    input: PreToolUseInput | PostToolUseInput,
    toolUseId: string | null,
    _context: { signal: AbortSignal }
  ): Promise<HookResult> {
    if (input.hook_event_name !== "PostToolUse") return {};

    const postInput = input as PostToolUseInput;
    const tool = postInput.tool_name as ToolName;

    // Handle invalidation for mutating tools
    await this.handleInvalidation(tool, postInput.tool_input);

    // Check if we have a pending cache-miss for this toolUseId
    if (!toolUseId) return {};

    const pending = this.pendingLookups.get(toolUseId);
    if (!pending) return {};

    this.pendingLookups.delete(toolUseId);

    const policy = this.policies.get(tool);
    if (!policy || policy.strategy === "never") return {};

    // Serialize and store
    const serialized = JSON.stringify(postInput.tool_response);
    const sizeBytes = new TextEncoder().encode(serialized).length;

    const entry: CacheEntry = {
      meta: {
        key: pending.key,
        tool: pending.tool,
        storedAt: Date.now(),
        ttlMs: policy.ttlMs,
        hits: 0,
        sizeBytes,
      },
      value: postInput.tool_response,
    };

    await this.store.set(pending.key, entry);

    const durationMs = Date.now() - pending.startMs;
    this.log(
      `STORE ${tool} [${pending.key.substring(0, 12)}...] ` +
        `${(sizeBytes / 1024).toFixed(1)}KB ttl=${policy.ttlMs / 1000}s took=${durationMs}ms`
    );

    return {};
  }

  // ── Key derivation ────────────────────────────────────────────────────────

  /**
   * Compute a deterministic cache key from tool name + input.
   *
   * Uses the policy's `keyFn` if available, otherwise normalizes the
   * input (excluding fields in `excludeFromKey`) and hashes it.
   */
  private computeKey(tool: ToolName | string, input: Record<string, unknown>): string {
    const policy = this.policies.get(tool);

    // Custom key function
    if (policy?.keyFn) {
      return `${tool}:${policy.keyFn(input as ToolInput)}`;
    }

    // Default: canonical JSON of input minus excluded fields
    const filtered = { ...input };
    if (policy?.excludeFromKey) {
      for (const field of policy.excludeFromKey) {
        delete filtered[field];
      }
    }

    // Deterministic key: sort keys, stringify, then simple hash
    const canonical = JSON.stringify(filtered, Object.keys(filtered).sort());
    const hash = this.fnv1aHash(canonical);
    return `${tool}:${hash}`;
  }

  /**
   * FNV-1a hash — fast, non-cryptographic, good distribution.
   * Returns a hex string.
   */
  private fnv1aHash(str: string): string {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV prime, ensure unsigned
    }
    return hash.toString(16).padStart(8, "0");
  }

  // ── Invalidation ─────────────────────────────────────────────────────────

  /**
   * When a mutating tool executes, invalidate cached entries for
   * tools that might return stale data.
   */
  private async handleInvalidation(
    tool: ToolName | string,
    input: Record<string, unknown>
  ): Promise<void> {
    const toolsToInvalidate = this.invalidationMap[tool];
    if (!toolsToInvalidate) return;

    // Extract file path from tool input (Write, Edit have file_path)
    const filePath = input.file_path as string | undefined;

    if (filePath) {
      // Path-specific invalidation: clear cached reads for this file
      for (const targetTool of toolsToInvalidate) {
        const key = this.computeKey(targetTool, { file_path: filePath });
        const deleted = await this.store.delete(key);
        if (deleted) {
          this.log(`INVALIDATE ${targetTool} [${key.substring(0, 12)}...] (triggered by ${tool})`);
        }
      }
    } else {
      // Broad invalidation: clear all entries for affected tools
      for (const targetTool of toolsToInvalidate) {
        const count = await this.store.clear(targetTool);
        if (count > 0) {
          this.log(`INVALIDATE ${targetTool} cleared ${count} entries (triggered by ${tool})`);
        }
      }
    }
  }

  // ── Debug logging ─────────────────────────────────────────────────────────

  private log(msg: string): void {
    if (this.debug) {
      console.log(`[tool-cache] ${msg}`);
    }
  }
}
