import type { MessageParam as APIUserMessage } from '@anthropic-ai/sdk/resources';
import type { BetaMessage as APIAssistantMessage, BetaUsage as Usage, BetaRawMessageStreamEvent as RawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs';
import type { UUID } from 'crypto';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { type z, type ZodRawShape, type ZodObject } from 'zod';
export type NonNullableUsage = {
    [K in keyof Usage]: NonNullable<Usage[K]>;
};
export type ModelUsage = {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
};
export type ApiKeySource = 'user' | 'project' | 'org' | 'temporary';
export type ConfigScope = 'local' | 'user' | 'project';
export type McpStdioServerConfig = {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
};
export type McpSSEServerConfig = {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
};
export type McpHttpServerConfig = {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
};
export type McpSdkServerConfig = {
    type: 'sdk';
    name: string;
};
export type McpSdkServerConfigWithInstance = McpSdkServerConfig & {
    instance: McpServer;
};
export type McpServerConfig = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig | McpSdkServerConfigWithInstance;
export type McpServerConfigForProcessTransport = McpStdioServerConfig | McpSSEServerConfig | McpHttpServerConfig | McpSdkServerConfig;
type PermissionUpdateDestination = 'userSettings' | 'projectSettings' | 'localSettings' | 'session';
export type PermissionBehavior = 'allow' | 'deny' | 'ask';
export type PermissionUpdate = {
    type: 'addRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'replaceRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'removeRules';
    rules: PermissionRuleValue[];
    behavior: PermissionBehavior;
    destination: PermissionUpdateDestination;
} | {
    type: 'setMode';
    mode: PermissionMode;
    destination: PermissionUpdateDestination;
} | {
    type: 'addDirectories';
    directories: string[];
    destination: PermissionUpdateDestination;
} | {
    type: 'removeDirectories';
    directories: string[];
    destination: PermissionUpdateDestination;
};
export type PermissionResult = {
    behavior: 'allow';
    /**
     * Updated tool input to use, if any changes are needed.
     *
     * For example if the user was given the option to update the tool use
     * input before approving, then this would be the updated input which
     * would be executed by the tool.
     */
    updatedInput: Record<string, unknown>;
    /**
     * Permissions updates to be applied as part of accepting this tool use.
     *
     * Typically this is used as part of the 'always allow' flow and these
     * permission updates are from the `suggestions` field from the
     * CanUseTool callback.
     *
     * It is recommended that you use these suggestions rather than
     * attempting to re-derive them from the tool use input, as the
     * suggestions may include other permission changes such as adding
     * directories or incorporate complex tool-use logic such as bash
     * commands.
     */
    updatedPermissions?: PermissionUpdate[];
} | {
    behavior: 'deny';
    /**
     * Message indicating the reason for denial, or guidance of what the
     * model should do instead.
     */
    message: string;
    /**
     * If true, interrupt execution and do not continue.
     *
     * Typically this should be set to true when the user says 'no' with no
     * further guidance. Leave unset or false if the user provides guidance
     * which the model should incorporate and continue.
     */
    interrupt?: boolean;
};
export type PermissionRuleValue = {
    toolName: string;
    ruleContent?: string;
};
export type CanUseTool = (toolName: string, input: Record<string, unknown>, options: {
    /** Signaled if the operation should be aborted. */
    signal: AbortSignal;
    /**
     * Suggestions for updating permissions so that the user will not be
     * prompted again for this tool during this session.
     *
     * Typically if presenting the user an option 'always allow' or similar,
     * then this full set of suggestions should be returned as the
     * `updatedPermissions` in the PermissionResult.
     */
    suggestions?: PermissionUpdate[];
    /**
     * Unique identifier for this specific tool call within the assistant message.
     * Multiple tool calls in the same assistant message will have different toolUseIDs.
     */
    toolUseID: string;
}) => Promise<PermissionResult>;
export declare const HOOK_EVENTS: readonly ["PreToolUse", "PostToolUse", "Notification", "UserPromptSubmit", "SessionStart", "SessionEnd", "Stop", "SubagentStop", "PreCompact"];
export type HookEvent = (typeof HOOK_EVENTS)[number];
export type HookCallback = (input: HookInput, toolUseID: string | undefined, options: {
    signal: AbortSignal;
}) => Promise<HookJSONOutput>;
export interface HookCallbackMatcher {
    matcher?: string;
    hooks: HookCallback[];
}
export type BaseHookInput = {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
};
export type PreToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
};
export type PostToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
};
export type NotificationHookInput = BaseHookInput & {
    hook_event_name: 'Notification';
    message: string;
    title?: string;
};
export type UserPromptSubmitHookInput = BaseHookInput & {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
};
export type SessionStartHookInput = BaseHookInput & {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear' | 'compact';
};
export type StopHookInput = BaseHookInput & {
    hook_event_name: 'Stop';
    stop_hook_active: boolean;
};
export type SubagentStopHookInput = BaseHookInput & {
    hook_event_name: 'SubagentStop';
    stop_hook_active: boolean;
};
export type PreCompactHookInput = BaseHookInput & {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions: string | null;
};
export declare const EXIT_REASONS: string[];
export type ExitReason = (typeof EXIT_REASONS)[number];
export type SessionEndHookInput = BaseHookInput & {
    hook_event_name: 'SessionEnd';
    reason: ExitReason;
};
export type HookInput = PreToolUseHookInput | PostToolUseHookInput | NotificationHookInput | UserPromptSubmitHookInput | SessionStartHookInput | SessionEndHookInput | StopHookInput | SubagentStopHookInput | PreCompactHookInput;
export type AsyncHookJSONOutput = {
    async: true;
    asyncTimeout?: number;
};
export type SyncHookJSONOutput = {
    continue?: boolean;
    suppressOutput?: boolean;
    stopReason?: string;
    decision?: 'approve' | 'block';
    systemMessage?: string;
    reason?: string;
    hookSpecificOutput?: {
        hookEventName: 'PreToolUse';
        permissionDecision?: 'allow' | 'deny' | 'ask';
        permissionDecisionReason?: string;
        updatedInput?: Record<string, unknown>;
    } | {
        hookEventName: 'UserPromptSubmit';
        additionalContext?: string;
    } | {
        hookEventName: 'SessionStart';
        additionalContext?: string;
    } | {
        hookEventName: 'PostToolUse';
        additionalContext?: string;
    };
};
export type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;
export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
export type SlashCommand = {
    name: string;
    description: string;
    argumentHint: string;
};
export type ModelInfo = {
    value: string;
    displayName: string;
    description: string;
};
/** Information about the logged in user's account. */
export type AccountInfo = {
    email?: string;
    organization?: string;
    subscriptionType?: string;
    tokenSource?: string;
    apiKeySource?: string;
};
export type McpServerStatus = {
    name: string;
    status: 'connected' | 'failed' | 'needs-auth' | 'pending';
    serverInfo?: {
        name: string;
        version: string;
    };
};
type SDKUserMessageContent = {
    type: 'user';
    message: APIUserMessage;
    parent_tool_use_id: string | null;
    /**
     * True if this is a 'synthetic' user message which did not originate from
     * the user directly, but instead was generated by the system.
     */
    isSynthetic?: boolean;
};
export type SDKUserMessage = SDKUserMessageContent & {
    uuid?: UUID;
    session_id: string;
};
export type SDKUserMessageReplay = SDKUserMessageContent & {
    uuid: UUID;
    session_id: string;
    /**
     * True if this is a replay/acknowledgment of a user message that was already
     * added to the messages array. Used internally to prevent duplicate messages.
     */
    isReplay: true;
};
export type SDKAssistantMessage = {
    type: 'assistant';
    message: APIAssistantMessage;
    parent_tool_use_id: string | null;
    uuid: UUID;
    session_id: string;
};
export type SDKPermissionDenial = {
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
};
export type SDKResultMessage = {
    type: 'result';
    subtype: 'success';
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    result: string;
    total_cost_usd: number;
    usage: NonNullableUsage;
    modelUsage: {
        [modelName: string]: ModelUsage;
    };
    permission_denials: SDKPermissionDenial[];
    uuid: UUID;
    session_id: string;
} | {
    type: 'result';
    subtype: 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd';
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    total_cost_usd: number;
    usage: NonNullableUsage;
    modelUsage: {
        [modelName: string]: ModelUsage;
    };
    permission_denials: SDKPermissionDenial[];
    errors: string[];
    uuid: UUID;
    session_id: string;
};
export type SDKSystemMessage = {
    type: 'system';
    subtype: 'init';
    agents?: string[];
    apiKeySource: ApiKeySource;
    claude_code_version: string;
    cwd: string;
    tools: string[];
    mcp_servers: {
        name: string;
        status: string;
    }[];
    model: string;
    permissionMode: PermissionMode;
    slash_commands: string[];
    output_style: string;
    skills: string[];
    plugins: {
        name: string;
        path: string;
    }[];
    uuid: UUID;
    session_id: string;
};
export type SDKPartialAssistantMessage = {
    type: 'stream_event';
    event: RawMessageStreamEvent;
    parent_tool_use_id: string | null;
    uuid: UUID;
    session_id: string;
};
export type SDKCompactBoundaryMessage = {
    type: 'system';
    subtype: 'compact_boundary';
    compact_metadata: {
        trigger: 'manual' | 'auto';
        pre_tokens: number;
    };
    uuid: UUID;
    session_id: string;
};
export type SDKHookResponseMessage = {
    type: 'system';
    subtype: 'hook_response';
    hook_name: string;
    hook_event: string;
    stdout: string;
    stderr: string;
    exit_code?: number;
    uuid: UUID;
    session_id: string;
};
export type SDKToolProgressMessage = {
    type: 'tool_progress';
    tool_use_id: string;
    tool_name: string;
    parent_tool_use_id: string | null;
    elapsed_time_seconds: number;
    uuid: UUID;
    session_id: string;
};
export type SDKAuthStatusMessage = {
    type: 'auth_status';
    isAuthenticating: boolean;
    output: string[];
    error?: string;
    uuid: UUID;
    session_id: string;
};
export type SDKMessage = SDKAssistantMessage | SDKUserMessage | SDKUserMessageReplay | SDKResultMessage | SDKSystemMessage | SDKPartialAssistantMessage | SDKCompactBoundaryMessage | SDKHookResponseMessage | SDKToolProgressMessage | SDKAuthStatusMessage;
export interface Query extends AsyncGenerator<SDKMessage, void> {
    /**
     * Control Requests
     * The following methods are control requests, and are only supported when
     * streaming input/output is used.
     */
    interrupt(): Promise<void>;
    setPermissionMode(mode: PermissionMode): Promise<void>;
    setModel(model?: string): Promise<void>;
    /**
     * Set the maximum number of thinking tokens the model is allowed to use
     * when generating its response. This can be used to limit the amount of
     * tokens the model uses for its response, which can help control cost and
     * latency.
     *
     * Use `null` to clear any previously set limit and allow the model to
     * use the default maximum thinking tokens.
     */
    setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
    supportedCommands(): Promise<SlashCommand[]>;
    supportedModels(): Promise<ModelInfo[]>;
    mcpServerStatus(): Promise<McpServerStatus[]>;
    accountInfo(): Promise<AccountInfo>;
}
type SdkMcpToolDefinition<Schema extends ZodRawShape = ZodRawShape> = {
    name: string;
    description: string;
    inputSchema: Schema;
    handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>;
};
export declare function tool<Schema extends ZodRawShape>(_name: string, _description: string, _inputSchema: Schema, _handler: (args: z.infer<ZodObject<Schema>>, extra: unknown) => Promise<CallToolResult>): SdkMcpToolDefinition<Schema>;
type CreateSdkMcpServerOptions = {
    name: string;
    version?: string;
    tools?: Array<SdkMcpToolDefinition<any>>;
};
/**
 * Creates an MCP server instance that can be used with the SDK transport.
 * This allows SDK users to define custom tools that run in the same process.
 *
 * If your SDK MCP calls will run longer than 60s, override CLAUDE_CODE_STREAM_CLOSE_TIMEOUT
 */
export declare function createSdkMcpServer(_options: CreateSdkMcpServerOptions): McpSdkServerConfigWithInstance;
export declare class AbortError extends Error {
}
export type AgentDefinition = {
    description: string;
    tools?: string[];
    disallowedTools?: string[];
    prompt: string;
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
};
export type SettingSource = 'user' | 'project' | 'local';
export type SdkPluginConfig = {
    type: 'local';
    path: string;
};
export type Options = {
    abortController?: AbortController;
    additionalDirectories?: string[];
    agents?: Record<string, AgentDefinition>;
    allowedTools?: string[];
    canUseTool?: CanUseTool;
    continue?: boolean;
    cwd?: string;
    disallowedTools?: string[];
    env?: {
        [envVar: string]: string | undefined;
    };
    executable?: 'bun' | 'deno' | 'node';
    executableArgs?: string[];
    extraArgs?: Record<string, string | null>;
    fallbackModel?: string;
    /**
     * When true resumed sessions will fork to a new session ID rather than
     * continuing the previous session. Use with --resume.
     */
    forkSession?: boolean;
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    includePartialMessages?: boolean;
    maxThinkingTokens?: number;
    maxTurns?: number;
    maxBudgetUsd?: number;
    mcpServers?: Record<string, McpServerConfig>;
    model?: string;
    pathToClaudeCodeExecutable?: string;
    permissionMode?: PermissionMode;
    allowDangerouslySkipPermissions?: boolean;
    permissionPromptToolName?: string;
    /**
     * Load plugins for this session. Plugins provide custom commands, agents,
     * skills, and hooks that extend Claude Code's capabilities.
     *
     * Currently only local plugins are supported via the 'local' type.
     *
     * @example
     * ```typescript
     * plugins: [
     *   { type: 'local', path: './my-plugin' },
     *   { type: 'local', path: '/absolute/path/to/plugin' }
     * ]
     * ```
     */
    plugins?: SdkPluginConfig[];
    resume?: string;
    /**
     * When resuming, only resume messages up to and including the assistant
     * message with this message.id. Use with --resume.
     * This allows you to resume from a specific point in the conversation.
     * The message ID is expected to be from SDKAssistantMessage.message.id.
     */
    resumeSessionAt?: string;
    settingSources?: SettingSource[];
    stderr?: (data: string) => void;
    strictMcpConfig?: boolean;
    systemPrompt?: string | {
        type: 'preset';
        preset: 'claude_code';
        append?: string;
    };
};
export declare function query(_params: {
    prompt: string | AsyncIterable<SDKUserMessage>;
    options?: Options;
}): Query;
export {};
