import { feature } from 'bun:bundle';
import * as React from 'react';
import { buildTool, type ToolDef, toolMatchesName } from 'src/Tool.js';
import type { Message as MessageType, NormalizedUserMessage } from 'src/types/message.js';
import { getQuerySourceForAgent } from 'src/utils/promptCategory.js';
import { z } from 'zod/v4';
import { clearInvokedSkillsForAgent, getSdkAgentProgressSummariesEnabled } from '../../bootstrap/state.js';
import { enhanceSystemPromptWithEnvDetails, getSystemPrompt } from '../../constants/prompts.js';
import { isCoordinatorMode } from '../../coordinator/coordinatorMode.js';
import { startAgentSummarization } from '../../services/AgentSummary/agentSummary.js';
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../../services/analytics/index.js';
import { clearDumpState } from '../../services/api/dumpPrompts.js';
import { completeAgentTask as completeAsyncAgent, createActivityDescriptionResolver, createProgressTracker, enqueueAgentNotification, failAgentTask as failAsyncAgent, getProgressUpdate, getTokenCountFromTracker, isLocalAgentTask, killAsyncAgent, registerAgentForeground, registerAsyncAgent, unregisterAgentForeground, updateAgentProgress as updateAsyncAgentProgress, updateProgressFromMessage } from '../../tasks/LocalAgentTask/LocalAgentTask.js';
import { checkRemoteAgentEligibility, formatPreconditionError, getRemoteTaskSessionUrl, registerRemoteAgentTask } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js';
import { assembleToolPool } from '../../tools.js';
import { asAgentId } from '../../types/ids.js';
import { runWithAgentContext } from '../../utils/agentContext.js';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js';
import { getCwd, runWithCwdOverride } from '../../utils/cwd.js';
import { logForDebugging } from '../../utils/debug.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { AbortError, errorMessage, toError } from '../../utils/errors.js';
import type { CacheSafeParams } from '../../utils/forkedAgent.js';
import { lazySchema } from '../../utils/lazySchema.js';
import { createUserMessage, extractTextContent, isSyntheticMessage, normalizeMessages } from '../../utils/messages.js';
import { getAgentModel } from '../../utils/model/agent.js';
import { permissionModeSchema } from '../../utils/permissions/PermissionMode.js';
import type { PermissionResult } from '../../utils/permissions/PermissionResult.js';
import { filterDeniedAgents, getDenyRuleForAgent } from '../../utils/permissions/permissions.js';
import { enqueueSdkEvent } from '../../utils/sdkEventQueue.js';
import { writeAgentMetadata } from '../../utils/sessionStorage.js';
import { sleep } from '../../utils/sleep.js';
import { buildEffectiveSystemPrompt } from '../../utils/systemPrompt.js';
import { asSystemPrompt } from '../../utils/systemPromptType.js';
import { getTaskOutputPath } from '../../utils/task/diskOutput.js';
import { getParentSessionId, isTeammate } from '../../utils/teammate.js';
import { isInProcessTeammate } from '../../utils/teammateContext.js';
import { teleportToRemote } from '../../utils/teleport.js';
import { getAssistantMessageContentLength } from '../../utils/tokens.js';
import { createAgentId } from '../../utils/uuid.js';
import { createAgentWorktree, hasWorktreeChanges, removeAgentWorktree } from '../../utils/worktree.js';
import { BASH_TOOL_NAME } from '../BashTool/toolName.js';
import { BackgroundHint } from '../BashTool/UI.js';
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js';
import { spawnTeammate } from '../shared/spawnMultiAgent.js';
import { setAgentColor } from './agentColorManager.js';
import { agentToolResultSchema, classifyHandoffIfNeeded, emitTaskProgress, extractPartialResult, finalizeAgentTool, getLastToolUseName, runAsyncAgentLifecycle } from './agentToolUtils.js';
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js';
import { AGENT_TOOL_NAME, LEGACY_AGENT_TOOL_NAME, ONE_SHOT_BUILTIN_AGENT_TYPES } from './constants.js';
import { buildForkedMessages, buildWorktreeNotice, FORK_AGENT, isForkSubagentEnabled, isInForkChild } from './forkSubagent.js';
import type { AgentDefinition } from './loadAgentsDir.js';
import { filterAgentsByMcpRequirements, hasRequiredMcpServers, isBuiltInAgent } from './loadAgentsDir.js';
import { getPrompt } from './prompt.js';
import { runAgent } from './runAgent.js';
import { renderGroupedAgentToolUse, renderToolResultMessage, renderToolUseErrorMessage, renderToolUseMessage, renderToolUseProgressMessage, renderToolUseRejectedMessage, renderToolUseTag, userFacingName, userFacingNameBackgroundColor } from './UI.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const proactiveModule = feature('PROACTIVE') || feature('KAIROS') ? require('../../proactive/index.js') as typeof import('../../proactive/index.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

// Progress display constants (for showing background hint)
const PROGRESS_THRESHOLD_MS = 2000; // Show background hint after 2 seconds

// Check if background tasks are disabled at module load time
const isBackgroundTasksDisabled =
// eslint-disable-next-line custom-rules/no-process-env-top-level -- Intentional: schema must be defined at module load
isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS);

// Auto-background agent tasks after this many ms (0 = disabled)
// Enabled by env var OR GrowthBook gate (checked lazily since GB may not be ready at module load)
function getAutoBackgroundMs(): number {
  if (isEnvTruthy(process.env.CLAUDE_AUTO_BACKGROUND_TASKS) || getFeatureValue_CACHED_MAY_BE_STALE('tengu_auto_background_agents', false)) {
    return 120_000;
  }
  return 0;
}

// Multi-agent type constants are defined inline inside gated blocks to enable dead code elimination

// Base input schema without multi-agent parameters
const baseInputSchema = lazySchema(() => z.object({
  description: z.string().describe('A short (3-5 word) description of the task'),
  prompt: z.string().describe('The task for the agent to perform'),
  subagent_type: z.string().optional().describe('The type of specialized agent to use for this task'),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional().describe("Optional model override for this agent. Takes precedence over the agent definition's model frontmatter. If omitted, uses the agent definition's model, or inherits from the parent."),
  run_in_background: z.boolean().optional().describe('Set to true to run this agent in the background. You will be notified when it completes.')
}));

// Full schema combining base + multi-agent params + isolation
const fullInputSchema = lazySchema(() => {
  // Multi-agent parameters
  const multiAgentInputSchema = z.object({
    name: z.string().optional().describe('Name for the spawned agent. Makes it addressable via SendMessage({to: name}) while running.'),
    team_name: z.string().optional().describe('Team name for spawning. Uses current team context if omitted.'),
    mode: permissionModeSchema().optional().describe('Permission mode for spawned teammate (e.g., "plan" to require plan approval).')
  });
  return baseInputSchema().merge(multiAgentInputSchema).extend({
    isolation: ("external" === 'ant' ? z.enum(['worktree', 'remote']) : z.enum(['worktree'])).optional().describe("external" === 'ant' ? 'Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo. "remote" launches the agent in a remote CCR environment (always runs in background).' : 'Isolation mode. "worktree" creates a temporary git worktree so the agent works on an isolated copy of the repo.'),
    cwd: z.string().optional().describe('Absolute path to run the agent in. Overrides the working directory for all filesystem and shell operations within this agent. Mutually exclusive with isolation: "worktree".')
  });
});

// Strip optional fields from the schema when the backing feature is off so
// the model never sees them. Done via .omit() rather than conditional spread
// inside .extend() because the spread-ternary breaks Zod's type inference
// (field type collapses to `unknown`). The ternary return produces a union
// type, but call() destructures via the explicit AgentToolInput type below
// which always includes all optional fields.
export const inputSchema = lazySchema(() => {
  const schema = feature('KAIROS') ? fullInputSchema() : fullInputSchema().omit({
    cwd: true
  });

  // GrowthBook-in-lazySchema is acceptable here (unlike subagent_type, which
  // was removed in 906da6c723): the divergence window is one-session-per-
  // gate-flip via _CACHED_MAY_BE_STALE disk read, and worst case is either
  // "schema shows a no-op param" (gate flips on mid-session: param ignored
  // by forceAsync) or "schema hides a param that would've worked" (gate
  // flips off mid-session: everything still runs async via memoized
  // forceAsync). No Zod rejection, no crash — unlike required→optional.
  return isBackgroundTasksDisabled || isForkSubagentEnabled() ? schema.omit({
    run_in_background: true
  }) : schema;
});
type InputSchema = ReturnType<typeof inputSchema>;

// Explicit type widens the schema inference to always include all optional
// fields even when .omit() strips them for gating (cwd, run_in_background).
// subagent_type is optional; call() defaults it to general-purpose when the
// fork gate is off, or routes to the fork path when the gate is on.
type AgentToolInput = z.infer<ReturnType<typeof baseInputSchema>> & {
  name?: string;
  team_name?: string;
  mode?: z.infer<ReturnType<typeof permissionModeSchema>>;
  isolation?: 'worktree' | 'remote';
  cwd?: string;
};

// Output schema - multi-agent spawned schema added dynamically at runtime when enabled
export const outputSchema = lazySchema(() => {
  const syncOutputSchema = agentToolResultSchema().extend({
    status: z.literal('completed'),
    prompt: z.string()
  });
  const asyncOutputSchema = z.object({
    status: z.literal('async_launched'),
    agentId: z.string().describe('The ID of the async agent'),
    description: z.string().describe('The description of the task'),
    prompt: z.string().describe('The prompt for the agent'),
    outputFile: z.string().describe('Path to the output file for checking agent progress'),
    canReadOutputFile: z.boolean().optional().describe('Whether the calling agent has Read/Bash tools to check progress')
  });
  return z.union([syncOutputSchema, asyncOutputSchema]);
});
type OutputSchema = ReturnType<typeof outputSchema>;
type Output = z.input<OutputSchema>;

// Private type for teammate spawn results - excluded from exported schema for dead code elimination
// The 'teammate_spawned' status string is only included when ENABLE_AGENT_SWARMS is true
type TeammateSpawnedOutput = {
  status: 'teammate_spawned';
  prompt: string;
  teammate_id: string;
  agent_id: string;
  agent_type?: string;
  model?: string;
  name: string;
  color?: string;
  tmux_session_name: string;
  tmux_window_name: string;
  tmux_pane_id: string;
  team_name?: string;
  is_splitpane?: boolean;
  plan_mode_required?: boolean;
};

// Combined output type including both public and internal types
// Note: TeammateSpawnedOutput type is fine - TypeScript types are erased at compile time
// Private type for remote-launched results — excluded from exported schema
// like TeammateSpawnedOutput for dead code elimination purposes. Exported
// for UI.tsx to do proper discriminated-union narrowing instead of ad-hoc casts.
export type RemoteLaunchedOutput = {
  status: 'remote_launched';
  taskId: string;
  sessionUrl: string;
  description: string;
  prompt: string;
  outputFile: string;
};
type InternalOutput = Output | TeammateSpawnedOutput | RemoteLaunchedOutput;
import type { AgentToolProgress, ShellProgress } from '../../types/tools.js';
// AgentTool forwards both its own progress events and shell progress
// events from the sub-agent so the SDK receives tool_progress updates during bash/powershell runs.
export type Progress = AgentToolProgress | ShellProgress;
export const AgentTool = buildTool({
  async prompt({
    agents,
    tools,
    getToolPermissionContext,
    allowedAgentTypes
  }) {
    const toolPermissionContext = await getToolPermissionContext();

    // Get MCP servers that have tools available
    const mcpServersWithTools: string[] = [];
    for (const tool of tools) {
      if (tool.name?.startsWith('mcp__')) {
        const parts = tool.name.split('__');
        const serverName = parts[1];
        if (serverName && !mcpServersWithTools.includes(serverName)) {
          mcpServersWithTools.push(serverName);
        }
      }
    }

    // Filter agents: first by MCP requirements, then by permission rules
    const agentsWithMcpRequirementsMet = filterAgentsByMcpRequirements(agents, mcpServersWithTools);
    const filteredAgents = filterDeniedAgents(agentsWithMcpRequirementsMet, toolPermissionContext, AGENT_TOOL_NAME);

    // Use inline env check instead of coordinatorModule to avoid circular
    // dependency issues during test module loading.
    const isCoordinator = feature('COORDINATOR_MODE') ? isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE) : false;
    return await getPrompt(filteredAgents, isCoordinator, allowedAgentTypes);
  },
  name: AGENT_TOOL_NAME,
  searchHint: 'delegate work to a subagent',
  aliases: [LEGACY_AGENT_TOOL_NAME],
  maxResultSizeChars: 100_000,
  async description() {
    return 'Launch a new agent';
  },
  get inputSchema(): InputSchema {
    return inputSchema();
  },
  get outputSchema(): OutputSchema {
    return outputSchema();
  },
  async call({
    prompt,
    subagent_type,
    description,
    model: modelParam,
    run_in_background,
    name,
    team_name,
    mode: spawnMode,
    isolation,
    cwd
  }: AgentToolInput, toolUseContext, canUseTool, assistantMessage, onProgress?) {
    const startTime = Date.now();
    const model = isCoordinatorMode() ? undefined : modelParam;

    // Get app state for permission mode and agent filtering
    const appState = toolUseContext.getAppState();
    const permissionMode = appState.toolPermissionContext.mode;
    // In-process teammates get a no-op setAppState; setAppStateForTasks
    // reaches the root store so task registration/progress/kill stay visible.
    const rootSetAppState = toolUseContext.setAppStateForTasks ?? toolUseContext.setAppState;

    // Check if user is trying to use agent teams without access
    if (team_name && !isAgentSwarmsEnabled()) {
      throw new Error('Agent Teams is not yet available on your plan.');
    }

    // Teammates (in-process or tmux) passing `name` would trigger spawnTeammate()
    // below, but TeamFile.members is a flat array with one leadAgentId — nested
    // teammates land in the roster with no provenance and confuse the lead.
    const teamName = resolveTeamName({
      team_name
    }, appState);
    if (isTeammate() && teamName && name) {
      throw new Error('Teammates cannot spawn other teammates — the team roster is flat. To spawn a subagent instead, omit the `name` parameter.');
    }
    // In-process teammates cannot spawn background agents (their lifecycle is
    // tied to the leader's process). Tmux teammates are separate processes and
    // can manage their own background agents.
    if (isInProcessTeammate() && teamName && run_in_background === true) {
      throw new Error('In-process teammates cannot spawn background agents. Use run_in_background=false for synchronous subagents.');
    }

    // Check if this is a multi-agent spawn request
    // Spawn is triggered when team_name is set (from param or context) and name is provided
    if (teamName && name) {
      // Set agent definition color for grouped UI display before spawning
      const agentDef = subagent_type ? toolUseContext.options.agentDefinitions.activeAgents.find(a => a.agentType === subagent_type) : undefined;
      if (agentDef?.color) {
        setAgentColor(subagent_type!, agentDef.color);
      }
      const result = await spawnTeammate({
        name,
        prompt,
        description,
        team_name: teamName,
        use_splitpane: true,
        plan_mode_required: spawnMode === 'plan',
        model: model ?? agentDef?.model,
        agent_type: subagent_type,
        invokingRequestId: assistantMessage?.requestId
      }, toolUseContext);

      // Type assertion uses TeammateSpawnedOutput (defined above) instead of any.
      // This type is excluded from the exported outputSchema for dead code elimination.
      // Cast through unknown because TeammateSpawnedOutput is intentionally
      // not part of the exported Output union (for dead code elimination purposes).
      const spawnResult: TeammateSpawnedOutput = {
        status: 'teammate_spawned' as const,
        prompt,
        ...result.data
      };
      return {
        data: spawnResult
      } as unknown as {
        data: Output;
      };
    }

    // Fork subagent experiment routing:
    // - subagent_type set: use it (explicit wins)
    // - subagent_type omitted, gate on: fork path (undefined)
    // - subagent_type omitted, gate off: default general-purpose
    const effectiveType = subagent_type ?? (isForkSubagentEnabled() ? undefined : GENERAL_PURPOSE_AGENT.agentType);
    const isForkPath = effectiveType === undefined;
    let selectedAgent: AgentDefinition;
    if (isForkPath) {
      // Recursive fork guard: fork children keep the Agent tool in their
      // pool for cache-identical tool defs, so reject fork attempts at call
      // time. Primary check is querySource (compaction-resistant — set on
      // context.options at spawn time, survives autocompact's message
      // rewrite). Message-scan fallback catches any path where querySource
      // wasn't threaded.
      if (toolUseContext.options.querySource === `agent:builtin:${FORK_AGENT.agentType}` || isInForkChild(toolUseContext.messages)) {
        throw new Error('Fork is not available inside a forked worker. Complete your task directly using your tools.');
      }
      selectedAgent = FORK_AGENT;
    } else {
      // Filter agents to exclude those denied via Agent(AgentName) syntax
      const allAgents = toolUseContext.options.agentDefinitions.activeAgents;
      const {
        allowedAgentTypes
      } = toolUseContext.options.agentDefinitions;
      const agents = filterDeniedAgents(
      // When allowedAgentTypes is set (from Agent(x,y) tool spec), restrict to those types
      allowedAgentTypes ? allAgents.filter(a => allowedAgentTypes.includes(a.agentType)) : allAgents, appState.toolPermissionContext, AGENT_TOOL_NAME);
      const found = agents.find(agent => agent.agentType === effectiveType);
      if (!found) {
        // Check if the agent exists but is denied by permission rules
        const agentExistsButDenied = allAgents.find(agent => agent.agentType === effectiveType);
        if (agentExistsButDenied) {
          const denyRule = getDenyRuleForAgent(appState.toolPermissionContext, AGENT_TOOL_NAME, effectiveType);
          throw new Error(`Agent type '${effectiveType}' has been denied by permission rule '${AGENT_TOOL_NAME}(${effectiveType})' from ${denyRule?.source ?? 'settings'}.`);
        }
        throw new Error(`Agent type '${effectiveType}' not found. Available agents: ${agents.map(a => a.agentType).join(', ')}`);
      }
      selectedAgent = found;
    }

    // Same lifecycle constraint as the run_in_background guard above, but for
    // agent definitions that force background via `background: true`. Checked
    // here because selectedAgent is only now resolved.
    if (isInProcessTeammate() && teamName && selectedAgent.background === true) {
      throw new Error(`In-process teammates cannot spawn background agents. Agent '${selectedAgent.agentType}' has background: true in its definition.`);
    }

    // Capture for type narrowing — `let selectedAgent` prevents TS from
    // narrowing property types across the if-else assignment above.
    const requiredMcpServers = selectedAgent.requiredMcpServers;

    // Check if required MCP servers have tools available
    // A server that's connected but not authenticated won't have any tools
    if (requiredMcpServers?.length) {
      // If any required servers are still pending (connecting), wait for them
      // before checking tool availability. This avoids a race condition where
      // the agent is invoked before MCP servers finish connecting.
      const hasPendingRequiredServers = appState.mcp.clients.some(c => c.type === 'pending' && requiredMcpServers.some(pattern => c.name.toLowerCase().includes(pattern.toLowerCase())));
      let currentAppState = appState;
      if (hasPendingRequiredServers) {
        const MAX_WAIT_MS = 30_000;
        const POLL_INTERVAL_MS = 500;
        const deadline = Date.now() + MAX_WAIT_MS;
        while (Date.now() < deadline) {
          await sleep(POLL_INTERVAL_MS);
          currentAppState = toolUseContext.getAppState();

          // Early exit: if any required server has already failed, no point
          // waiting for other pending servers — the check will fail regardless.
          const hasFailedRequiredServer = currentAppState.mcp.clients.some(c => c.type === 'failed' && requiredMcpServers.some(pattern => c.name.toLowerCase().includes(pattern.toLowerCase())));
          if (hasFailedRequiredServer) break;
          const stillPending = currentAppState.mcp.clients.some(c => c.type === 'pending' && requiredMcpServers.some(pattern => c.name.toLowerCase().includes(pattern.toLowerCase())));
          if (!stillPending) break;
        }
      }

      // Get servers that actually have tools (meaning they're connected AND authenticated)
      const serversWithTools: string[] = [];
      for (const tool of currentAppState.mcp.tools) {
        if (tool.name?.startsWith('mcp__')) {
          // Extract server name from tool name (format: mcp__serverName__toolName)
          const parts = tool.name.split('__');
          const serverName = parts[1];
          if (serverName && !serversWithTools.includes(serverName)) {
            serversWithTools.push(serverName);
          }
        }
      }
      if (!hasRequiredMcpServers(selectedAgent, serversWithTools)) {
        const missing = requiredMcpServers.filter(pattern => !serversWithTools.some(server => server.toLowerCase().includes(pattern.toLowerCase())));
        throw new Error(`Agent '${selectedAgent.agentType}' requires MCP servers matching: ${missing.join(', ')}. ` + `MCP servers with tools: ${serversWithTools.length > 0 ? serversWithTools.join(', ') : 'none'}. ` + `Use /mcp to configure and authenticate the required MCP servers.`);
      }
    }

    // Initialize the color for this agent if it has a predefined one
    if (selectedAgent.color) {
      setAgentColor(selectedAgent.agentType, selectedAgent.color);
    }

    // Resolve agent params for logging (these are already resolved in runAgent)
    const resolvedAgentModel = getAgentModel(selectedAgent.model, toolUseContext.options.mainLoopModel, isForkPath ? undefined : model, permissionMode);
    logEvent('tengu_agent_tool_selected', {
      agent_type: selectedAgent.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      model: resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      source: selectedAgent.source as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      color: selectedAgent.color as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      is_built_in_agent: isBuiltInAgent(selectedAgent),
      is_resume: false,
      is_async: (run_in_background === true || selectedAgent.background === true) && !isBackgroundTasksDisabled,
      is_fork: isForkPath
    });

    // Resolve effective isolation mode (explicit param overrides agent def)
    const effectiveIsolation = isolation ?? selectedAgent.isolation;

    // Remote isolation: delegate to CCR. Gated ant-only — the guard enables
    // dead code elimination of the entire block for external builds.
    if ("external" === 'ant' && effectiveIsolation === 'remote') {
      const eligibility = await checkRemoteAgentEligibility();
      if (!eligibility.eligible) {
        const reasons = eligibility.errors.map(formatPreconditionError).join('\n');
        throw new Error(`Cannot launch remote agent:\n${reasons}`);
      }
      let bundleFailHint: string | undefined;
      const session = await teleportToRemote({
        initialMessage: prompt,
        description,
        signal: toolUseContext.abortController.signal,
        onBundleFail: msg => {
          bundleFailHint = msg;
        }
      });
      if (!session) {
        throw new Error(bundleFailHint ?? 'Failed to create remote session');
      }
      const {
        taskId,
        sessionId
      } = registerRemoteAgentTask({
        remoteTaskType: 'remote-agent',
        session: {
          id: session.id,
          title: session.title || description
        },
        command: prompt,
        context: toolUseContext,
        toolUseId: toolUseContext.toolUseId
      });
      logEvent('tengu_agent_tool_remote_launched', {
        agent_type: selectedAgent.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      const remoteResult: RemoteLaunchedOutput = {
        status: 'remote_launched',
        taskId,
        sessionUrl: getRemoteTaskSessionUrl(sessionId),
        description,
        prompt,
        outputFile: getTaskOutputPath(taskId)
      };
      return {
        data: remoteResult
      } as unknown as {
        data: Output;
      };
    }
    // System prompt + prompt messages: branch on fork path.
    //
    // Fork path: child inherits the PARENT's system prompt (not FORK_AGENT's)
    // for cache-identical API request prefixes. Prompt messages are built via
    // buildForkedMessages() which clones the parent's full assistant message
    // (all tool_use blocks) + placeholder tool_results + per-child directive.
    //
    // Normal path: build the selected agent's own system prompt with env
    // details, and use a simple user message for the prompt.
    let enhancedSystemPrompt: string[] | undefined;
    let forkParentSystemPrompt: ReturnType<typeof buildEffectiveSystemPrompt> | undefined;
    let promptMessages: MessageType[];
    if (isForkPath) {
      if (toolUseContext.renderedSystemPrompt) {
        forkParentSystemPrompt = toolUseContext.renderedSystemPrompt;
      } else {
        // Fallback: recompute. May diverge from parent's cached bytes if
        // GrowthBook state changed between parent turn-start and fork spawn.
        const mainThreadAgentDefinition = appState.agent ? appState.agentDefinitions.activeAgents.find(a => a.agentType === appState.agent) : undefined;
        const additionalWorkingDirectories = Array.from(appState.toolPermissionContext.additionalWorkingDirectories.keys());
        const defaultSystemPrompt = await getSystemPrompt(toolUseContext.options.tools, toolUseContext.options.mainLoopModel, additionalWorkingDirectories, toolUseContext.options.mcpClients);
        forkParentSystemPrompt = buildEffectiveSystemPrompt({
          mainThreadAgentDefinition,
          toolUseContext,
          customSystemPrompt: toolUseContext.options.customSystemPrompt,
          defaultSystemPrompt,
          appendSystemPrompt: toolUseContext.options.appendSystemPrompt
        });
      }
      promptMessages = buildForkedMessages(prompt, assistantMessage);
    } else {
      try {
        const additionalWorkingDirectories = Array.from(appState.toolPermissionContext.additionalWorkingDirectories.keys());

        // All agents have getSystemPrompt - pass toolUseContext to all
        const agentPrompt = selectedAgent.getSystemPrompt({
          toolUseContext
        });

        // Log agent memory loaded event for subagents
        if (selectedAgent.memory) {
          logEvent('tengu_agent_memory_loaded', {
            ...("external" === 'ant' && {
              agent_type: selectedAgent.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            }),
            scope: selectedAgent.memory as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            source: 'subagent' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
        }

        // Apply environment details enhancement
        enhancedSystemPrompt = await enhanceSystemPromptWithEnvDetails([agentPrompt], resolvedAgentModel, additionalWorkingDirectories);
      } catch (error) {
        logForDebugging(`Failed to get system prompt for agent ${selectedAgent.agentType}: ${errorMessage(error)}`);
      }
      promptMessages = [createUserMessage({
        content: prompt
      })];
    }
    const metadata = {
      prompt,
      resolvedAgentModel,
      isBuiltInAgent: isBuiltInAgent(selectedAgent),
      startTime,
      agentType: selectedAgent.agentType,
      isAsync: (run_in_background === true || selectedAgent.background === true) && !isBackgroundTasksDisabled
    };

    // Use inline env check instead of coordinatorModule to avoid circular
    // dependency issues during test module loading.
    const isCoordinator = feature('COORDINATOR_MODE') ? isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE) : false;

    // Fork subagent experiment: force ALL spawns async for a unified
    // <task-notification> interaction model (not just fork spawns — all of them).
    const forceAsync = isForkSubagentEnabled();

    // Assistant mode: force all agents async. Synchronous subagents hold the
    // main loop's turn open until they complete — the daemon's inputQueue
    // backs up, and the first overdue cron catch-up on spawn becomes N
    // serial subagent turns blocking all user input. Same gate as
    // executeForkedSlashCommand's fire-and-forget path; the
    // <task-notification> re-entry there is handled by the else branch
    // below (registerAsyncAgentTask + notifyOnCompletion).
    const assistantForceAsync = feature('KAIROS') ? appState.kairosEnabled : false;
    const shouldRunAsync = (run_in_background === true || selectedAgent.background === true || isCoordinator || forceAsync || assistantForceAsync || (proactiveModule?.isProactiveActive() ?? false)) && !isBackgroundTasksDisabled;
    // Assemble the worker's tool pool independently of the parent's.
    // Workers always get their tools from assembleToolPool with their own
    // permission mode, so they aren't affected by the parent's tool
    // restrictions. This is computed here so that runAgent doesn't need to
    // import from tools.ts (which would create a circular dependency).
    const workerPermissionContext = {
      ...appState.toolPermissionContext,
      mode: selectedAgent.permissionMode ?? 'acceptEdits'
    };
    const workerTools = assembleToolPool(workerPermissionContext, appState.mcp.tools);

    // Create a stable agent ID early so it can be used for worktree slug
    const earlyAgentId = createAgentId();

    // Set up worktree isolation if requested
    let worktreeInfo: {
      worktreePath: string;
      worktreeBranch?: string;
      headCommit?: string;
      gitRoot?: string;
      hookBased?: boolean;
    } | null = null;
    if (effectiveIsolation === 'worktree') {
      const slug = `agent-${earlyAgentId.slice(0, 8)}`;
      worktreeInfo = await createAgentWorktree(slug);
    }

    // Fork + worktree: inject a notice telling the child to translate paths
    // and re-read potentially stale files. Appended after the fork directive
    // so it appears as the most recent guidance the child sees.
    if (isForkPath && worktreeInfo) {
      promptMessages.push(createUserMessage({
        content: buildWorktreeNotice(getCwd(), worktreeInfo.worktreePath)
      }));
    }
    const runAgentParams: Parameters<typeof runAgent>[0] = {
      agentDefinition: selectedAgent,
      promptMessages,
      toolUseContext,
      canUseTool,
      isAsync: shouldRunAsync,
      querySource: toolUseContext.options.querySource ?? getQuerySourceForAgent(selectedAgent.agentType, isBuiltInAgent(selectedAgent)),
      model: isForkPath ? undefined : model,
      // Fork path: pass parent's system prompt AND parent's exact tool
      // array (cache-identical prefix). workerTools is rebuilt under
      // permissionMode 'bubble' which differs from the parent's mode, so
      // its tool-def serialization diverges and breaks cache at the first
      // differing tool. useExactTools also inherits the parent's
      // thinkingConfig and isNonInteractiveSession (see runAgent.ts).
      //
      // Normal path: when a cwd override is in effect (worktree isolation
      // or explicit cwd), skip the pre-built system prompt so runAgent's
      // buildAgentSystemPrompt() runs inside wrapWithCwd where getCwd()
      // returns the override path.
      override: isForkPath ? {
        systemPrompt: forkParentSystemPrompt
      } : enhancedSystemPrompt && !worktreeInfo && !cwd ? {
        systemPrompt: asSystemPrompt(enhancedSystemPrompt)
      } : undefined,
      availableTools: isForkPath ? toolUseContext.options.tools : workerTools,
      // Pass parent conversation when the fork-subagent path needs full
      // context. useExactTools inherits thinkingConfig (runAgent.ts:624).
      forkContextMessages: isForkPath ? toolUseContext.messages : undefined,
      ...(isForkPath && {
        useExactTools: true
      }),
      worktreePath: worktreeInfo?.worktreePath,
      description
    };

    // Helper to wrap execution with a cwd override: explicit cwd arg (KAIROS)
    // takes precedence over worktree isolation path.
    const cwdOverridePath = cwd ?? worktreeInfo?.worktreePath;
    const wrapWithCwd = <T,>(fn: () => T): T => cwdOverridePath ? runWithCwdOverride(cwdOverridePath, fn) : fn();

    // Helper to clean up worktree after agent completes
    const cleanupWorktreeIfNeeded = async (): Promise<{
      worktreePath?: string;
      worktreeBranch?: string;
    }> => {
      if (!worktreeInfo) return {};
      const {
        worktreePath,
        worktreeBranch,
        headCommit,
        gitRoot,
        hookBased
      } = worktreeInfo;
      // Null out to make idempotent — guards against double-call if code
      // between cleanup and end of try throws into catch
      worktreeInfo = null;
      if (hookBased) {
        // Hook-based worktrees are always kept since we can't detect VCS changes
        logForDebugging(`Hook-based agent worktree kept at: ${worktreePath}`);
        return {
          worktreePath
        };
      }
      if (headCommit) {
        const changed = await hasWorktreeChanges(worktreePath, headCommit);
        if (!changed) {
          await removeAgentWorktree(worktreePath, worktreeBranch, gitRoot);
          // Clear worktreePath from metadata so resume doesn't try to use
          // a deleted directory. Fire-and-forget to match runAgent's
          // writeAgentMetadata handling.
          void writeAgentMetadata(asAgentId(earlyAgentId), {
            agentType: selectedAgent.agentType,
            description
          }).catch(_err => logForDebugging(`Failed to clear worktree metadata: ${_err}`));
          return {};
        }
      }
      logForDebugging(`Agent worktree has changes, keeping: ${worktreePath}`);
      return {
        worktreePath,
        worktreeBranch
      };
    };
    if (shouldRunAsync) {
      const asyncAgentId = earlyAgentId;
      const agentBackgroundTask = registerAsyncAgent({
        agentId: asyncAgentId,
        description,
        prompt,
        selectedAgent,
        setAppState: rootSetAppState,
        // Don't link to parent's abort controller -- background agents should
        // survive when the user presses ESC to cancel the main thread.
        // They are killed explicitly via chat:killAgents.
        toolUseId: toolUseContext.toolUseId
      });

      // Register name → agentId for SendMessage routing. Post-registerAsyncAgent
      // so we don't leave a stale entry if spawn fails. Sync agents skipped —
      // coordinator is blocked, so SendMessage routing doesn't apply.
      if (name) {
        rootSetAppState(prev => {
          const next = new Map(prev.agentNameRegistry);
          next.set(name, asAgentId(asyncAgentId));
          return {
            ...prev,
            agentNameRegistry: next
          };
        });
      }

      // Wrap async agent execution in agent context for analytics attribution
      const asyncAgentContext = {
        agentId: asyncAgentId,
        // For subagents from teammates: use team lead's session
        // For subagents from main REPL: undefined (no parent session)
        parentSessionId: getParentSessionId(),
        agentType: 'subagent' as const,
        subagentName: selectedAgent.agentType,
        isBuiltIn: isBuiltInAgent(selectedAgent),
        invokingRequestId: assistantMessage?.requestId,
        invocationKind: 'spawn' as const,
        invocationEmitted: false
      };

      // Workload propagation: handlePromptSubmit wraps the entire turn in
      // runWithWorkload (AsyncLocalStorage). ALS context is captured at
      // invocation time — when this `void` fires — and survives every await
      // inside. No capture/restore needed; the detached closure sees the
      // parent turn's workload automatically, isolated from its finally.
      void runWithAgentContext(asyncAgentContext, () => wrapWithCwd(() => runAsyncAgentLifecycle({
        taskId: agentBackgroundTask.agentId,
        abortController: agentBackgroundTask.abortController!,
        makeStream: onCacheSafeParams => runAgent({
          ...runAgentParams,
          override: {
            ...runAgentParams.override,
            agentId: asAgentId(agentBackgroundTask.agentId),
            abortController: agentBackgroundTask.abortController!
          },
          onCacheSafeParams
        }),
        metadata,
        description,
        toolUseContext,
        rootSetAppState,
        agentIdForCleanup: asyncAgentId,
        enableSummarization: isCoordinator || isForkSubagentEnabled() || getSdkAgentProgressSummariesEnabled(),
        getWorktreeResult: cleanupWorktreeIfNeeded
      })));
      const canReadOutputFile = toolUseContext.options.tools.some(t => toolMatchesName(t, FILE_READ_TOOL_NAME) || toolMatchesName(t, BASH_TOOL_NAME));
      return {
        data: {
          isAsync: true as const,
          status: 'async_launched' as const,
          agentId: agentBackgroundTask.agentId,
          description: description,
          prompt: prompt,
          outputFile: getTaskOutputPath(agentBackgroundTask.agentId),
          canReadOutputFile
        }
      };
    } else {
      // Create an explicit agentId for sync agents
      const syncAgentId = asAgentId(earlyAgentId);

      // Set up agent context for sync execution (for analytics attribution)
      const syncAgentContext = {
        agentId: syncAgentId,
        // For subagents from teammates: use team lead's session
        // For subagents from main REPL: undefined (no parent session)
        parentSessionId: getParentSessionId(),
        agentType: 'subagent' as const,
        subagentName: selectedAgent.agentType,
        isBuiltIn: isBuiltInAgent(selectedAgent),
        invokingRequestId: assistantMessage?.requestId,
        invocationKind: 'spawn' as const,
        invocationEmitted: false
      };

      // Wrap entire sync agent execution in context for analytics attribution
      // and optionally in a worktree cwd override for filesystem isolation
      return runWithAgentContext(syncAgentContext, () => wrapWithCwd(async () => {
        const agentMessages: MessageType[] = [];
        const agentStartTime = Date.now();
        const syncTracker = createProgressTracker();
        const syncResolveActivity = createActivityDescriptionResolver(toolUseContext.options.tools);

        // Yield initial progress message to carry metadata (prompt)
        if (promptMessages.length > 0) {
          const normalizedPromptMessages = normalizeMessages(promptMessages);
          const normalizedFirstMessage = normalizedPromptMessages.find((m): m is NormalizedUserMessage => m.type === 'user');
          if (normalizedFirstMessage && normalizedFirstMessage.type === 'user' && onProgress) {
            onProgress({
              toolUseID: `agent_${assistantMessage.message.id}`,
              data: {
                message: normalizedFirstMessage,
                type: 'agent_progress',
                prompt,
                agentId: syncAgentId
              }
            });
          }
        }

        // Register as foreground task immediately so it can be backgrounded at any time
        // Skip registration if background tasks are disabled
        let foregroundTaskId: string | undefined;
        // Create the background race promise once outside the loop — otherwise
        // each iteration adds a new .then() reaction to the same pending
        // promise, accumulating callbacks for the lifetime of the agent.
        let backgroundPromise: Promise<{
          type: 'background';
        }> | undefined;
        let cancelAutoBackground: (() => void) | undefined;
        if (!isBackgroundTasksDisabled) {
          const registration = registerAgentForeground({
            agentId: syncAgentId,
            description,
            prompt,
            selectedAgent,
            setAppState: rootSetAppState,
            toolUseId: toolUseContext.toolUseId,
            autoBackgroundMs: getAutoBackgroundMs() || undefined
          });
          foregroundTaskId = registration.taskId;
          backgroundPromise = registration.backgroundSignal.then(() => ({
            type: 'background' as const
          }));
          cancelAutoBackground = registration.cancelAutoBackground;
        }

        // Track if we've shown the background hint UI
        let backgroundHintShown = false;
        // Track if the agent was backgrounded (cleanup handled by backgrounded finally)
        let wasBackgrounded = false;
        // Per-scope stop function — NOT shared with the backgrounded closure.
        // idempotent: startAgentSummarization's stop() checks `stopped` flag.
        let stopForegroundSummarization: (() => void) | undefined;
        // const capture for sound type narrowing inside the callback below
        const summaryTaskId = foregroundTaskId;

        // Get async iterator for the agent
        const agentIterator = runAgent({
          ...runAgentParams,
          override: {
            ...runAgentParams.override,
            agentId: syncAgentId
          },
          onCacheSafeParams: summaryTaskId && getSdkAgentProgressSummariesEnabled() ? (params: CacheSafeParams) => {
            const {
              stop
            } = startAgentSummarization(summaryTaskId, syncAgentId, params, rootSetAppState);
            stopForegroundSummarization = stop;
          } : undefined
        })[Symbol.asyncIterator]();

        // Track if an error occurred during iteration
        let syncAgentError: Error | undefined;
        let wasAborted = false;
        let worktreeResult: {
          worktreePath?: string;
          worktreeBranch?: string;
        } = {};
        try {
          while (true) {
            const elapsed = Date.now() - agentStartTime;

            // Show background hint after threshold (but task is already registered)
            // Skip if background tasks are disabled
            if (!isBackgroundTasksDisabled && !backgroundHintShown && elapsed >= PROGRESS_THRESHOLD_MS && toolUseContext.setToolJSX) {
              backgroundHintShown = true;
              toolUseContext.setToolJSX({
                jsx: <BackgroundHint />,
                shouldHidePromptInput: false,
                shouldContinueAnimation: true,
                showSpinner: true
              });
            }

            // Race between next message and background signal
            // If background tasks are disabled, just await the next message directly
            const nextMessagePromise = agentIterator.next();
            const raceResult = backgroundPromise ? await Promise.race([nextMessagePromise.then(r => ({
              type: 'message' as const,
              result: r
            })), backgroundPromise]) : {
              type: 'message' as const,
              result: await nextMessagePromise
            };

            // Check if we were backgrounded via backgroundAll()
            // foregroundTaskId is guaranteed to be defined if raceResult.type is 'background'
            // because backgroundPromise is only defined when foregroundTaskId is defined
            if (raceResult.type === 'background' && foregroundTaskId) {
              const appState = toolUseContext.getAppState();
              const task = appState.tasks[foregroundTaskId];
              if (isLocalAgentTask(task) && task.isBackgrounded) {
                // Capture the taskId for use in the async callback
                const backgroundedTaskId = foregroundTaskId;
                wasBackgrounded = true;
                // Stop foreground summarization; the backgrounded closure
                // below owns its own independent stop function.
                stopForegroundSummarization?.();

                // Workload: inherited via ALS at `void` invocation time,
                // same as the async-from-start path above.
                // Continue agent in background and return async result
                void runWithAgentContext(syncAgentContext, async () => {
                  let stopBackgroundedSummarization: (() => void) | undefined;
                  try {
                    // Clean up the foreground iterator so its finally block runs
                    // (releases MCP connections, session hooks, prompt cache tracking, etc.)
                    // Timeout prevents blocking if MCP server cleanup hangs.
                    // .catch() prevents unhandled rejection if timeout wins the race.
                    await Promise.race([agentIterator.return(undefined).catch(() => {}), sleep(1000)]);
                    // Initialize progress tracking from existing messages
                    const tracker = createProgressTracker();
                    const resolveActivity2 = createActivityDescriptionResolver(toolUseContext.options.tools);
                    for (const existingMsg of agentMessages) {
                      updateProgressFromMessage(tracker, existingMsg, resolveActivity2, toolUseContext.options.tools);
                    }
                    for await (const msg of runAgent({
                      ...runAgentParams,
                      isAsync: true,
                      // Agent is now running in background
                      override: {
                        ...runAgentParams.override,
                        agentId: asAgentId(backgroundedTaskId),
                        abortController: task.abortController
                      },
                      onCacheSafeParams: getSdkAgentProgressSummariesEnabled() ? (params: CacheSafeParams) => {
                        const {
                          stop
                        } = startAgentSummarization(backgroundedTaskId, asAgentId(backgroundedTaskId), params, rootSetAppState);
                        stopBackgroundedSummarization = stop;
                      } : undefined
                    })) {
                      agentMessages.push(msg);

                      // Track progress for backgrounded agents
                      updateProgressFromMessage(tracker, msg, resolveActivity2, toolUseContext.options.tools);
                      updateAsyncAgentProgress(backgroundedTaskId, getProgressUpdate(tracker), rootSetAppState);
                      const lastToolName = getLastToolUseName(msg);
                      if (lastToolName) {
                        emitTaskProgress(tracker, backgroundedTaskId, toolUseContext.toolUseId, description, startTime, lastToolName);
                      }
                    }
                    const agentResult = finalizeAgentTool(agentMessages, backgroundedTaskId, metadata);

                    // Mark task completed FIRST so TaskOutput(block=true)
                    // unblocks immediately. classifyHandoffIfNeeded and
                    // cleanupWorktreeIfNeeded can hang — they must not gate
                    // the status transition (gh-20236).
                    completeAsyncAgent(agentResult, rootSetAppState);

                    // Extract text from agent result content for the notification
                    let finalMessage = extractTextContent(agentResult.content, '\n');
                    if (feature('TRANSCRIPT_CLASSIFIER')) {
                      const backgroundedAppState = toolUseContext.getAppState();
                      const handoffWarning = await classifyHandoffIfNeeded({
                        agentMessages,
                        tools: toolUseContext.options.tools,
                        toolPermissionContext: backgroundedAppState.toolPermissionContext,
                        abortSignal: task.abortController!.signal,
                        subagentType: selectedAgent.agentType,
                        totalToolUseCount: agentResult.totalToolUseCount
                      });
                      if (handoffWarning) {
                        finalMessage = `${handoffWarning}\n\n${finalMessage}`;
                      }
                    }

                    // Clean up worktree before notification so we can include it
                    const worktreeResult = await cleanupWorktreeIfNeeded();
                    enqueueAgentNotification({
                      taskId: backgroundedTaskId,
                      description,
                      status: 'completed',
                      setAppState: rootSetAppState,
                      finalMessage,
                      usage: {
                        totalTokens: getTokenCountFromTracker(tracker),
                        toolUses: agentResult.totalToolUseCount,
                        durationMs: agentResult.totalDurationMs
                      },
                      toolUseId: toolUseContext.toolUseId,
                      ...worktreeResult
                    });
                  } catch (error) {
                    if (error instanceof AbortError) {
                      // Transition status BEFORE worktree cleanup so
                      // TaskOutput unblocks even if git hangs (gh-20236).
                      killAsyncAgent(backgroundedTaskId, rootSetAppState);
                      logEvent('tengu_agent_tool_terminated', {
                        agent_type: metadata.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                        model: metadata.resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
                        duration_ms: Date.now() - metadata.startTime,
                        is_async: true,
                        is_built_in_agent: metadata.isBuiltInAgent,
                        reason: 'user_cancel_background' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
                      });
                      const worktreeResult = await cleanupWorktreeIfNeeded();
                      const partialResult = extractPartialResult(agentMessages);
                      enqueueAgentNotification({
                        taskId: backgroundedTaskId,
                        description,
                        status: 'killed',
                        setAppState: rootSetAppState,
                        toolUseId: toolUseContext.toolUseId,
                        finalMessage: partialResult,
                        ...worktreeResult
                      });
                      return;
                    }
                    const errMsg = errorMessage(error);
                    failAsyncAgent(backgroundedTaskId, errMsg, rootSetAppState);
                    const worktreeResult = await cleanupWorktreeIfNeeded();
                    enqueueAgentNotification({
                      taskId: backgroundedTaskId,
                      description,
                      status: 'failed',
                      error: errMsg,
                      setAppState: rootSetAppState,
                      toolUseId: toolUseContext.toolUseId,
                      ...worktreeResult
                    });
                  } finally {
                    stopBackgroundedSummarization?.();
                    clearInvokedSkillsForAgent(syncAgentId);
                    clearDumpState(syncAgentId);
                    // Note: worktree cleanup is done before enqueueAgentNotification
                    // in both try and catch paths so we can include worktree info
                  }
                });

                // Return async_launched result immediately
                const canReadOutputFile = toolUseContext.options.tools.some(t => toolMatchesName(t, FILE_READ_TOOL_NAME) || toolMatchesName(t, BASH_TOOL_NAME));
                return {
                  data: {
                    isAsync: true as const,
                    status: 'async_launched' as const,
                    agentId: backgroundedTaskId,
                    description: description,
                    prompt: prompt,
                    outputFile: getTaskOutputPath(backgroundedTaskId),
                    canReadOutputFile
                  }
                };
              }
            }

            // Process the message from the race result
            if (raceResult.type !== 'message') {
              // This shouldn't happen - background case handled above
              continue;
            }
            const {
              result
            } = raceResult;
            if (result.done) break;
            const message = result.value;
            agentMessages.push(message);

            // Emit task_progress for the VS Code subagent panel
            updateProgressFromMessage(syncTracker, message, syncResolveActivity, toolUseContext.options.tools);
            if (foregroundTaskId) {
              const lastToolName = getLastToolUseName(message);
              if (lastToolName) {
                emitTaskProgress(syncTracker, foregroundTaskId, toolUseContext.toolUseId, description, agentStartTime, lastToolName);
                // Keep AppState task.progress in sync when SDK summaries are
                // enabled, so updateAgentSummary reads correct token/tool counts
                // instead of zeros.
                if (getSdkAgentProgressSummariesEnabled()) {
                  updateAsyncAgentProgress(foregroundTaskId, getProgressUpdate(syncTracker), rootSetAppState);
                }
              }
            }

            // Forward bash_progress events from sub-agent to parent so the SDK
            // receives tool_progress events just as it does for the main agent.
            if (message.type === 'progress' && (message.data.type === 'bash_progress' || message.data.type === 'powershell_progress') && onProgress) {
              onProgress({
                toolUseID: message.toolUseID,
                data: message.data
              });
            }
            if (message.type !== 'assistant' && message.type !== 'user') {
              continue;
            }

            // Increment token count in spinner for assistant messages
            // Subagent streaming events are filtered out in runAgent.ts, so we
            // need to count tokens from completed messages here
            if (message.type === 'assistant') {
              const contentLength = getAssistantMessageContentLength(message);
              if (contentLength > 0) {
                toolUseContext.setResponseLength(len => len + contentLength);
              }
            }
            const normalizedNew = normalizeMessages([message]);
            for (const m of normalizedNew) {
              for (const content of m.message.content) {
                if (content.type !== 'tool_use' && content.type !== 'tool_result') {
                  continue;
                }

                // Forward progress updates
                if (onProgress) {
                  onProgress({
                    toolUseID: `agent_${assistantMessage.message.id}`,
                    data: {
                      message: m,
                      type: 'agent_progress',
                      // prompt only needed on first progress message (UI.tsx:624
                      // reads progressMessages[0]). Omit here to avoid duplication.
                      prompt: '',
                      agentId: syncAgentId
                    }
                  });
                }
              }
            }
          }
        } catch (error) {
          // Handle errors from the sync agent loop
          // AbortError should be re-thrown for proper interruption handling
          if (error instanceof AbortError) {
            wasAborted = true;
            logEvent('tengu_agent_tool_terminated', {
              agent_type: metadata.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              model: metadata.resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
              duration_ms: Date.now() - metadata.startTime,
              is_async: false,
              is_built_in_agent: metadata.isBuiltInAgent,
              reason: 'user_cancel_sync' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
            });
            throw error;
          }

          // Log the error for debugging
          logForDebugging(`Sync agent error: ${errorMessage(error)}`, {
            level: 'error'
          });

          // Store the error to handle after cleanup
          syncAgentError = toError(error);
        } finally {
          // Clear the background hint UI
          if (toolUseContext.setToolJSX) {
            toolUseContext.setToolJSX(null);
          }

          // Stop foreground summarization. Idempotent — if already stopped at
          // the backgrounding transition, this is a no-op. The backgrounded
          // closure owns a separate stop function (stopBackgroundedSummarization).
          stopForegroundSummarization?.();

          // Unregister foreground task if agent completed without being backgrounded
          if (foregroundTaskId) {
            unregisterAgentForeground(foregroundTaskId, rootSetAppState);
            // Notify SDK consumers (e.g. VS Code subagent panel) that this
            // foreground agent is done. Goes through drainSdkEvents() — does
            // NOT trigger the print.ts XML task_notification parser or the LLM loop.
            if (!wasBackgrounded) {
              const progress = getProgressUpdate(syncTracker);
              enqueueSdkEvent({
                type: 'system',
                subtype: 'task_notification',
                task_id: foregroundTaskId,
                tool_use_id: toolUseContext.toolUseId,
                status: syncAgentError ? 'failed' : wasAborted ? 'stopped' : 'completed',
                output_file: '',
                summary: description,
                usage: {
                  total_tokens: progress.tokenCount,
                  tool_uses: progress.toolUseCount,
                  duration_ms: Date.now() - agentStartTime
                }
              });
            }
          }

          // Clean up scoped skills so they don't accumulate in the global map
          clearInvokedSkillsForAgent(syncAgentId);

          // Clean up dumpState entry for this agent to prevent unbounded growth
          // Skip if backgrounded — the backgrounded agent's finally handles cleanup
          if (!wasBackgrounded) {
            clearDumpState(syncAgentId);
          }

          // Cancel auto-background timer if agent completed before it fired
          cancelAutoBackground?.();

          // Clean up worktree if applicable (in finally to handle abort/error paths)
          // Skip if backgrounded — the background continuation is still running in it
          if (!wasBackgrounded) {
            worktreeResult = await cleanupWorktreeIfNeeded();
          }
        }

        // Re-throw abort errors
        // TODO: Find a cleaner way to express this
        const lastMessage = agentMessages.findLast(_ => _.type !== 'system' && _.type !== 'progress');
        if (lastMessage && isSyntheticMessage(lastMessage)) {
          logEvent('tengu_agent_tool_terminated', {
            agent_type: metadata.agentType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            model: metadata.resolvedAgentModel as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
            duration_ms: Date.now() - metadata.startTime,
            is_async: false,
            is_built_in_agent: metadata.isBuiltInAgent,
            reason: 'user_cancel_sync' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
          });
          throw new AbortError();
        }

        // If an error occurred during iteration, try to return a result with
        // whatever messages we have. If we have no assistant messages,
        // re-throw the error so it's properly handled by the tool framework.
        if (syncAgentError) {
          // Check if we have any assistant messages to return
          const hasAssistantMessages = agentMessages.some(msg => msg.type === 'assistant');
          if (!hasAssistantMessages) {
            // No messages collected, re-throw the error
            throw syncAgentError;
          }

          // We have some messages, try to finalize and return them
          // This allows the parent agent to see partial progress even after an error
          logForDebugging(`Sync agent recovering from error with ${agentMessages.length} messages`);
        }
        const agentResult = finalizeAgentTool(agentMessages, syncAgentId, metadata);
        if (feature('TRANSCRIPT_CLASSIFIER')) {
          const currentAppState = toolUseContext.getAppState();
          const handoffWarning = await classifyHandoffIfNeeded({
            agentMessages,
            tools: toolUseContext.options.tools,
            toolPermissionContext: currentAppState.toolPermissionContext,
            abortSignal: toolUseContext.abortController.signal,
            subagentType: selectedAgent.agentType,
            totalToolUseCount: agentResult.totalToolUseCount
          });
          if (handoffWarning) {
            agentResult.content = [{
              type: 'text' as const,
              text: handoffWarning
            }, ...agentResult.content];
          }
        }
        return {
          data: {
            status: 'completed' as const,
            prompt,
            ...agentResult,
            ...worktreeResult
          }
        };
      }));
    }
  },
  isReadOnly() {
    return true; // delegates permission checks to its underlying tools
  },
  toAutoClassifierInput(input) {
    const i = input as AgentToolInput;
    const tags = [i.subagent_type, i.mode ? `mode=${i.mode}` : undefined].filter((t): t is string => t !== undefined);
    const prefix = tags.length > 0 ? `(${tags.join(', ')}): ` : ': ';
    return `${prefix}${i.prompt}`;
  },
  isConcurrencySafe() {
    return true;
  },
  userFacingName,
  userFacingNameBackgroundColor,
  getActivityDescription(input) {
    return input?.description ?? 'Running task';
  },
  async checkPermissions(input, context): Promise<PermissionResult> {
    const appState = context.getAppState();

    // Only route through auto mode classifier when in auto mode
    // In all other modes, auto-approve sub-agent generation
    // Note: "external" === 'ant' guard enables dead code elimination for external builds
    if ("external" === 'ant' && appState.toolPermissionContext.mode === 'auto') {
      return {
        behavior: 'passthrough',
        message: 'Agent tool requires permission to spawn sub-agents.'
      };
    }
    return {
      behavior: 'allow',
      updatedInput: input
    };
  },
  mapToolResultToToolResultBlockParam(data, toolUseID) {
    // Multi-agent spawn result
    const internalData = data as InternalOutput;
    if (typeof internalData === 'object' && internalData !== null && 'status' in internalData && internalData.status === 'teammate_spawned') {
      const spawnData = internalData as TeammateSpawnedOutput;
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [{
          type: 'text',
          text: `Spawned successfully.
agent_id: ${spawnData.teammate_id}
name: ${spawnData.name}
team_name: ${spawnData.team_name}
The agent is now running and will receive instructions via mailbox.`
        }]
      };
    }
    if ('status' in internalData && internalData.status === 'remote_launched') {
      const r = internalData;
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [{
          type: 'text',
          text: `Remote agent launched in CCR.\ntaskId: ${r.taskId}\nsession_url: ${r.sessionUrl}\noutput_file: ${r.outputFile}\nThe agent is running remotely. You will be notified automatically when it completes.\nBriefly tell the user what you launched and end your response.`
        }]
      };
    }
    if (data.status === 'async_launched') {
      const prefix = `Async agent launched successfully.\nagentId: ${data.agentId} (internal ID - do not mention to user. Use SendMessage with to: '${data.agentId}' to continue this agent.)\nThe agent is working in the background. You will be notified automatically when it completes.`;
      const instructions = data.canReadOutputFile ? `Do not duplicate this agent's work — avoid working with the same files or topics it is using. Work on non-overlapping tasks, or briefly tell the user what you launched and end your response.\noutput_file: ${data.outputFile}\nIf asked, you can check progress before completion by using ${FILE_READ_TOOL_NAME} or ${BASH_TOOL_NAME} tail on the output file.` : `Briefly tell the user what you launched and end your response. Do not generate any other text — agent results will arrive in a subsequent message.`;
      const text = `${prefix}\n${instructions}`;
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [{
          type: 'text',
          text
        }]
      };
    }
    if (data.status === 'completed') {
      const worktreeData = data as Record<string, unknown>;
      const worktreeInfoText = worktreeData.worktreePath ? `\nworktreePath: ${worktreeData.worktreePath}\nworktreeBranch: ${worktreeData.worktreeBranch}` : '';
      // If the subagent completes with no content, the tool_result is just the
      // agentId/usage trailer below — a metadata-only block at the prompt tail.
      // Some models read that as "nothing to act on" and end their turn
      // immediately. Say so explicitly so the parent has something to react to.
      const contentOrMarker = data.content.length > 0 ? data.content : [{
        type: 'text' as const,
        text: '(Subagent completed but returned no output.)'
      }];
      // One-shot built-ins (Explore, Plan) are never continued via SendMessage
      // — the agentId hint and <usage> block are dead weight (~135 chars ×
      // 34M Explore runs/week ≈ 1-2 Gtok/week). Telemetry doesn't parse this
      // block (it uses logEvent in finalizeAgentTool), so dropping is safe.
      // agentType is optional for resume compat — missing means show trailer.
      if (data.agentType && ONE_SHOT_BUILTIN_AGENT_TYPES.has(data.agentType) && !worktreeInfoText) {
        return {
          tool_use_id: toolUseID,
          type: 'tool_result',
          content: contentOrMarker
        };
      }
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [...contentOrMarker, {
          type: 'text',
          text: `agentId: ${data.agentId} (use SendMessage with to: '${data.agentId}' to continue this agent)${worktreeInfoText}
<usage>total_tokens: ${data.totalTokens}
tool_uses: ${data.totalToolUseCount}
duration_ms: ${data.totalDurationMs}</usage>`
        }]
      };
    }
    data satisfies never;
    throw new Error(`Unexpected agent tool result status: ${(data as {
      status: string;
    }).status}`);
  },
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseTag,
  renderToolUseProgressMessage,
  renderToolUseRejectedMessage,
  renderToolUseErrorMessage,
  renderGroupedToolUse: renderGroupedAgentToolUse
} satisfies ToolDef<InputSchema, Output, Progress>);
function resolveTeamName(input: {
  team_name?: string;
}, appState: {
  teamContext?: {
    teamName: string;
  };
}): string | undefined {
  if (!isAgentSwarmsEnabled()) return undefined;
  return input.team_name || appState.teamContext?.teamName;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiUmVhY3QiLCJidWlsZFRvb2wiLCJUb29sRGVmIiwidG9vbE1hdGNoZXNOYW1lIiwiTWVzc2FnZSIsIk1lc3NhZ2VUeXBlIiwiTm9ybWFsaXplZFVzZXJNZXNzYWdlIiwiZ2V0UXVlcnlTb3VyY2VGb3JBZ2VudCIsInoiLCJjbGVhckludm9rZWRTa2lsbHNGb3JBZ2VudCIsImdldFNka0FnZW50UHJvZ3Jlc3NTdW1tYXJpZXNFbmFibGVkIiwiZW5oYW5jZVN5c3RlbVByb21wdFdpdGhFbnZEZXRhaWxzIiwiZ2V0U3lzdGVtUHJvbXB0IiwiaXNDb29yZGluYXRvck1vZGUiLCJzdGFydEFnZW50U3VtbWFyaXphdGlvbiIsImdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFIiwiQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyIsImxvZ0V2ZW50IiwiY2xlYXJEdW1wU3RhdGUiLCJjb21wbGV0ZUFnZW50VGFzayIsImNvbXBsZXRlQXN5bmNBZ2VudCIsImNyZWF0ZUFjdGl2aXR5RGVzY3JpcHRpb25SZXNvbHZlciIsImNyZWF0ZVByb2dyZXNzVHJhY2tlciIsImVucXVldWVBZ2VudE5vdGlmaWNhdGlvbiIsImZhaWxBZ2VudFRhc2siLCJmYWlsQXN5bmNBZ2VudCIsImdldFByb2dyZXNzVXBkYXRlIiwiZ2V0VG9rZW5Db3VudEZyb21UcmFja2VyIiwiaXNMb2NhbEFnZW50VGFzayIsImtpbGxBc3luY0FnZW50IiwicmVnaXN0ZXJBZ2VudEZvcmVncm91bmQiLCJyZWdpc3RlckFzeW5jQWdlbnQiLCJ1bnJlZ2lzdGVyQWdlbnRGb3JlZ3JvdW5kIiwidXBkYXRlQWdlbnRQcm9ncmVzcyIsInVwZGF0ZUFzeW5jQWdlbnRQcm9ncmVzcyIsInVwZGF0ZVByb2dyZXNzRnJvbU1lc3NhZ2UiLCJjaGVja1JlbW90ZUFnZW50RWxpZ2liaWxpdHkiLCJmb3JtYXRQcmVjb25kaXRpb25FcnJvciIsImdldFJlbW90ZVRhc2tTZXNzaW9uVXJsIiwicmVnaXN0ZXJSZW1vdGVBZ2VudFRhc2siLCJhc3NlbWJsZVRvb2xQb29sIiwiYXNBZ2VudElkIiwicnVuV2l0aEFnZW50Q29udGV4dCIsImlzQWdlbnRTd2FybXNFbmFibGVkIiwiZ2V0Q3dkIiwicnVuV2l0aEN3ZE92ZXJyaWRlIiwibG9nRm9yRGVidWdnaW5nIiwiaXNFbnZUcnV0aHkiLCJBYm9ydEVycm9yIiwiZXJyb3JNZXNzYWdlIiwidG9FcnJvciIsIkNhY2hlU2FmZVBhcmFtcyIsImxhenlTY2hlbWEiLCJjcmVhdGVVc2VyTWVzc2FnZSIsImV4dHJhY3RUZXh0Q29udGVudCIsImlzU3ludGhldGljTWVzc2FnZSIsIm5vcm1hbGl6ZU1lc3NhZ2VzIiwiZ2V0QWdlbnRNb2RlbCIsInBlcm1pc3Npb25Nb2RlU2NoZW1hIiwiUGVybWlzc2lvblJlc3VsdCIsImZpbHRlckRlbmllZEFnZW50cyIsImdldERlbnlSdWxlRm9yQWdlbnQiLCJlbnF1ZXVlU2RrRXZlbnQiLCJ3cml0ZUFnZW50TWV0YWRhdGEiLCJzbGVlcCIsImJ1aWxkRWZmZWN0aXZlU3lzdGVtUHJvbXB0IiwiYXNTeXN0ZW1Qcm9tcHQiLCJnZXRUYXNrT3V0cHV0UGF0aCIsImdldFBhcmVudFNlc3Npb25JZCIsImlzVGVhbW1hdGUiLCJpc0luUHJvY2Vzc1RlYW1tYXRlIiwidGVsZXBvcnRUb1JlbW90ZSIsImdldEFzc2lzdGFudE1lc3NhZ2VDb250ZW50TGVuZ3RoIiwiY3JlYXRlQWdlbnRJZCIsImNyZWF0ZUFnZW50V29ya3RyZWUiLCJoYXNXb3JrdHJlZUNoYW5nZXMiLCJyZW1vdmVBZ2VudFdvcmt0cmVlIiwiQkFTSF9UT09MX05BTUUiLCJCYWNrZ3JvdW5kSGludCIsIkZJTEVfUkVBRF9UT09MX05BTUUiLCJzcGF3blRlYW1tYXRlIiwic2V0QWdlbnRDb2xvciIsImFnZW50VG9vbFJlc3VsdFNjaGVtYSIsImNsYXNzaWZ5SGFuZG9mZklmTmVlZGVkIiwiZW1pdFRhc2tQcm9ncmVzcyIsImV4dHJhY3RQYXJ0aWFsUmVzdWx0IiwiZmluYWxpemVBZ2VudFRvb2wiLCJnZXRMYXN0VG9vbFVzZU5hbWUiLCJydW5Bc3luY0FnZW50TGlmZWN5Y2xlIiwiR0VORVJBTF9QVVJQT1NFX0FHRU5UIiwiQUdFTlRfVE9PTF9OQU1FIiwiTEVHQUNZX0FHRU5UX1RPT0xfTkFNRSIsIk9ORV9TSE9UX0JVSUxUSU5fQUdFTlRfVFlQRVMiLCJidWlsZEZvcmtlZE1lc3NhZ2VzIiwiYnVpbGRXb3JrdHJlZU5vdGljZSIsIkZPUktfQUdFTlQiLCJpc0ZvcmtTdWJhZ2VudEVuYWJsZWQiLCJpc0luRm9ya0NoaWxkIiwiQWdlbnREZWZpbml0aW9uIiwiZmlsdGVyQWdlbnRzQnlNY3BSZXF1aXJlbWVudHMiLCJoYXNSZXF1aXJlZE1jcFNlcnZlcnMiLCJpc0J1aWx0SW5BZ2VudCIsImdldFByb21wdCIsInJ1bkFnZW50IiwicmVuZGVyR3JvdXBlZEFnZW50VG9vbFVzZSIsInJlbmRlclRvb2xSZXN1bHRNZXNzYWdlIiwicmVuZGVyVG9vbFVzZUVycm9yTWVzc2FnZSIsInJlbmRlclRvb2xVc2VNZXNzYWdlIiwicmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZSIsInJlbmRlclRvb2xVc2VSZWplY3RlZE1lc3NhZ2UiLCJyZW5kZXJUb29sVXNlVGFnIiwidXNlckZhY2luZ05hbWUiLCJ1c2VyRmFjaW5nTmFtZUJhY2tncm91bmRDb2xvciIsInByb2FjdGl2ZU1vZHVsZSIsInJlcXVpcmUiLCJQUk9HUkVTU19USFJFU0hPTERfTVMiLCJpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkIiwicHJvY2VzcyIsImVudiIsIkNMQVVERV9DT0RFX0RJU0FCTEVfQkFDS0dST1VORF9UQVNLUyIsImdldEF1dG9CYWNrZ3JvdW5kTXMiLCJDTEFVREVfQVVUT19CQUNLR1JPVU5EX1RBU0tTIiwiYmFzZUlucHV0U2NoZW1hIiwib2JqZWN0IiwiZGVzY3JpcHRpb24iLCJzdHJpbmciLCJkZXNjcmliZSIsInByb21wdCIsInN1YmFnZW50X3R5cGUiLCJvcHRpb25hbCIsIm1vZGVsIiwiZW51bSIsInJ1bl9pbl9iYWNrZ3JvdW5kIiwiYm9vbGVhbiIsImZ1bGxJbnB1dFNjaGVtYSIsIm11bHRpQWdlbnRJbnB1dFNjaGVtYSIsIm5hbWUiLCJ0ZWFtX25hbWUiLCJtb2RlIiwibWVyZ2UiLCJleHRlbmQiLCJpc29sYXRpb24iLCJjd2QiLCJpbnB1dFNjaGVtYSIsInNjaGVtYSIsIm9taXQiLCJJbnB1dFNjaGVtYSIsIlJldHVyblR5cGUiLCJBZ2VudFRvb2xJbnB1dCIsImluZmVyIiwib3V0cHV0U2NoZW1hIiwic3luY091dHB1dFNjaGVtYSIsInN0YXR1cyIsImxpdGVyYWwiLCJhc3luY091dHB1dFNjaGVtYSIsImFnZW50SWQiLCJvdXRwdXRGaWxlIiwiY2FuUmVhZE91dHB1dEZpbGUiLCJ1bmlvbiIsIk91dHB1dFNjaGVtYSIsIk91dHB1dCIsImlucHV0IiwiVGVhbW1hdGVTcGF3bmVkT3V0cHV0IiwidGVhbW1hdGVfaWQiLCJhZ2VudF9pZCIsImFnZW50X3R5cGUiLCJjb2xvciIsInRtdXhfc2Vzc2lvbl9uYW1lIiwidG11eF93aW5kb3dfbmFtZSIsInRtdXhfcGFuZV9pZCIsImlzX3NwbGl0cGFuZSIsInBsYW5fbW9kZV9yZXF1aXJlZCIsIlJlbW90ZUxhdW5jaGVkT3V0cHV0IiwidGFza0lkIiwic2Vzc2lvblVybCIsIkludGVybmFsT3V0cHV0IiwiQWdlbnRUb29sUHJvZ3Jlc3MiLCJTaGVsbFByb2dyZXNzIiwiUHJvZ3Jlc3MiLCJBZ2VudFRvb2wiLCJhZ2VudHMiLCJ0b29scyIsImdldFRvb2xQZXJtaXNzaW9uQ29udGV4dCIsImFsbG93ZWRBZ2VudFR5cGVzIiwidG9vbFBlcm1pc3Npb25Db250ZXh0IiwibWNwU2VydmVyc1dpdGhUb29scyIsInRvb2wiLCJzdGFydHNXaXRoIiwicGFydHMiLCJzcGxpdCIsInNlcnZlck5hbWUiLCJpbmNsdWRlcyIsInB1c2giLCJhZ2VudHNXaXRoTWNwUmVxdWlyZW1lbnRzTWV0IiwiZmlsdGVyZWRBZ2VudHMiLCJpc0Nvb3JkaW5hdG9yIiwiQ0xBVURFX0NPREVfQ09PUkRJTkFUT1JfTU9ERSIsInNlYXJjaEhpbnQiLCJhbGlhc2VzIiwibWF4UmVzdWx0U2l6ZUNoYXJzIiwiY2FsbCIsIm1vZGVsUGFyYW0iLCJzcGF3bk1vZGUiLCJ0b29sVXNlQ29udGV4dCIsImNhblVzZVRvb2wiLCJhc3Npc3RhbnRNZXNzYWdlIiwib25Qcm9ncmVzcyIsInN0YXJ0VGltZSIsIkRhdGUiLCJub3ciLCJ1bmRlZmluZWQiLCJhcHBTdGF0ZSIsImdldEFwcFN0YXRlIiwicGVybWlzc2lvbk1vZGUiLCJyb290U2V0QXBwU3RhdGUiLCJzZXRBcHBTdGF0ZUZvclRhc2tzIiwic2V0QXBwU3RhdGUiLCJFcnJvciIsInRlYW1OYW1lIiwicmVzb2x2ZVRlYW1OYW1lIiwiYWdlbnREZWYiLCJvcHRpb25zIiwiYWdlbnREZWZpbml0aW9ucyIsImFjdGl2ZUFnZW50cyIsImZpbmQiLCJhIiwiYWdlbnRUeXBlIiwicmVzdWx0IiwidXNlX3NwbGl0cGFuZSIsImludm9raW5nUmVxdWVzdElkIiwicmVxdWVzdElkIiwic3Bhd25SZXN1bHQiLCJjb25zdCIsImRhdGEiLCJlZmZlY3RpdmVUeXBlIiwiaXNGb3JrUGF0aCIsInNlbGVjdGVkQWdlbnQiLCJxdWVyeVNvdXJjZSIsIm1lc3NhZ2VzIiwiYWxsQWdlbnRzIiwiZmlsdGVyIiwiZm91bmQiLCJhZ2VudCIsImFnZW50RXhpc3RzQnV0RGVuaWVkIiwiZGVueVJ1bGUiLCJzb3VyY2UiLCJtYXAiLCJqb2luIiwiYmFja2dyb3VuZCIsInJlcXVpcmVkTWNwU2VydmVycyIsImxlbmd0aCIsImhhc1BlbmRpbmdSZXF1aXJlZFNlcnZlcnMiLCJtY3AiLCJjbGllbnRzIiwic29tZSIsImMiLCJ0eXBlIiwicGF0dGVybiIsInRvTG93ZXJDYXNlIiwiY3VycmVudEFwcFN0YXRlIiwiTUFYX1dBSVRfTVMiLCJQT0xMX0lOVEVSVkFMX01TIiwiZGVhZGxpbmUiLCJoYXNGYWlsZWRSZXF1aXJlZFNlcnZlciIsInN0aWxsUGVuZGluZyIsInNlcnZlcnNXaXRoVG9vbHMiLCJtaXNzaW5nIiwic2VydmVyIiwicmVzb2x2ZWRBZ2VudE1vZGVsIiwibWFpbkxvb3BNb2RlbCIsImlzX2J1aWx0X2luX2FnZW50IiwiaXNfcmVzdW1lIiwiaXNfYXN5bmMiLCJpc19mb3JrIiwiZWZmZWN0aXZlSXNvbGF0aW9uIiwiZWxpZ2liaWxpdHkiLCJlbGlnaWJsZSIsInJlYXNvbnMiLCJlcnJvcnMiLCJidW5kbGVGYWlsSGludCIsInNlc3Npb24iLCJpbml0aWFsTWVzc2FnZSIsInNpZ25hbCIsImFib3J0Q29udHJvbGxlciIsIm9uQnVuZGxlRmFpbCIsIm1zZyIsInNlc3Npb25JZCIsInJlbW90ZVRhc2tUeXBlIiwiaWQiLCJ0aXRsZSIsImNvbW1hbmQiLCJjb250ZXh0IiwidG9vbFVzZUlkIiwicmVtb3RlUmVzdWx0IiwiZW5oYW5jZWRTeXN0ZW1Qcm9tcHQiLCJmb3JrUGFyZW50U3lzdGVtUHJvbXB0IiwicHJvbXB0TWVzc2FnZXMiLCJyZW5kZXJlZFN5c3RlbVByb21wdCIsIm1haW5UaHJlYWRBZ2VudERlZmluaXRpb24iLCJhZGRpdGlvbmFsV29ya2luZ0RpcmVjdG9yaWVzIiwiQXJyYXkiLCJmcm9tIiwia2V5cyIsImRlZmF1bHRTeXN0ZW1Qcm9tcHQiLCJtY3BDbGllbnRzIiwiY3VzdG9tU3lzdGVtUHJvbXB0IiwiYXBwZW5kU3lzdGVtUHJvbXB0IiwiYWdlbnRQcm9tcHQiLCJtZW1vcnkiLCJzY29wZSIsImVycm9yIiwiY29udGVudCIsIm1ldGFkYXRhIiwiaXNBc3luYyIsImZvcmNlQXN5bmMiLCJhc3Npc3RhbnRGb3JjZUFzeW5jIiwia2Fpcm9zRW5hYmxlZCIsInNob3VsZFJ1bkFzeW5jIiwiaXNQcm9hY3RpdmVBY3RpdmUiLCJ3b3JrZXJQZXJtaXNzaW9uQ29udGV4dCIsIndvcmtlclRvb2xzIiwiZWFybHlBZ2VudElkIiwid29ya3RyZWVJbmZvIiwid29ya3RyZWVQYXRoIiwid29ya3RyZWVCcmFuY2giLCJoZWFkQ29tbWl0IiwiZ2l0Um9vdCIsImhvb2tCYXNlZCIsInNsdWciLCJzbGljZSIsInJ1bkFnZW50UGFyYW1zIiwiUGFyYW1ldGVycyIsImFnZW50RGVmaW5pdGlvbiIsIm92ZXJyaWRlIiwic3lzdGVtUHJvbXB0IiwiYXZhaWxhYmxlVG9vbHMiLCJmb3JrQ29udGV4dE1lc3NhZ2VzIiwidXNlRXhhY3RUb29scyIsImN3ZE92ZXJyaWRlUGF0aCIsIndyYXBXaXRoQ3dkIiwiZm4iLCJUIiwiY2xlYW51cFdvcmt0cmVlSWZOZWVkZWQiLCJQcm9taXNlIiwiY2hhbmdlZCIsImNhdGNoIiwiX2VyciIsImFzeW5jQWdlbnRJZCIsImFnZW50QmFja2dyb3VuZFRhc2siLCJwcmV2IiwibmV4dCIsIk1hcCIsImFnZW50TmFtZVJlZ2lzdHJ5Iiwic2V0IiwiYXN5bmNBZ2VudENvbnRleHQiLCJwYXJlbnRTZXNzaW9uSWQiLCJzdWJhZ2VudE5hbWUiLCJpc0J1aWx0SW4iLCJpbnZvY2F0aW9uS2luZCIsImludm9jYXRpb25FbWl0dGVkIiwibWFrZVN0cmVhbSIsIm9uQ2FjaGVTYWZlUGFyYW1zIiwiYWdlbnRJZEZvckNsZWFudXAiLCJlbmFibGVTdW1tYXJpemF0aW9uIiwiZ2V0V29ya3RyZWVSZXN1bHQiLCJ0Iiwic3luY0FnZW50SWQiLCJzeW5jQWdlbnRDb250ZXh0IiwiYWdlbnRNZXNzYWdlcyIsImFnZW50U3RhcnRUaW1lIiwic3luY1RyYWNrZXIiLCJzeW5jUmVzb2x2ZUFjdGl2aXR5Iiwibm9ybWFsaXplZFByb21wdE1lc3NhZ2VzIiwibm9ybWFsaXplZEZpcnN0TWVzc2FnZSIsIm0iLCJ0b29sVXNlSUQiLCJtZXNzYWdlIiwiZm9yZWdyb3VuZFRhc2tJZCIsImJhY2tncm91bmRQcm9taXNlIiwiY2FuY2VsQXV0b0JhY2tncm91bmQiLCJyZWdpc3RyYXRpb24iLCJhdXRvQmFja2dyb3VuZE1zIiwiYmFja2dyb3VuZFNpZ25hbCIsInRoZW4iLCJiYWNrZ3JvdW5kSGludFNob3duIiwid2FzQmFja2dyb3VuZGVkIiwic3RvcEZvcmVncm91bmRTdW1tYXJpemF0aW9uIiwic3VtbWFyeVRhc2tJZCIsImFnZW50SXRlcmF0b3IiLCJwYXJhbXMiLCJzdG9wIiwiU3ltYm9sIiwiYXN5bmNJdGVyYXRvciIsInN5bmNBZ2VudEVycm9yIiwid2FzQWJvcnRlZCIsIndvcmt0cmVlUmVzdWx0IiwiZWxhcHNlZCIsInNldFRvb2xKU1giLCJqc3giLCJzaG91bGRIaWRlUHJvbXB0SW5wdXQiLCJzaG91bGRDb250aW51ZUFuaW1hdGlvbiIsInNob3dTcGlubmVyIiwibmV4dE1lc3NhZ2VQcm9taXNlIiwicmFjZVJlc3VsdCIsInJhY2UiLCJyIiwidGFzayIsInRhc2tzIiwiaXNCYWNrZ3JvdW5kZWQiLCJiYWNrZ3JvdW5kZWRUYXNrSWQiLCJzdG9wQmFja2dyb3VuZGVkU3VtbWFyaXphdGlvbiIsInJldHVybiIsInRyYWNrZXIiLCJyZXNvbHZlQWN0aXZpdHkyIiwiZXhpc3RpbmdNc2ciLCJsYXN0VG9vbE5hbWUiLCJhZ2VudFJlc3VsdCIsImZpbmFsTWVzc2FnZSIsImJhY2tncm91bmRlZEFwcFN0YXRlIiwiaGFuZG9mZldhcm5pbmciLCJhYm9ydFNpZ25hbCIsInN1YmFnZW50VHlwZSIsInRvdGFsVG9vbFVzZUNvdW50IiwidXNhZ2UiLCJ0b3RhbFRva2VucyIsInRvb2xVc2VzIiwiZHVyYXRpb25NcyIsInRvdGFsRHVyYXRpb25NcyIsImR1cmF0aW9uX21zIiwicmVhc29uIiwicGFydGlhbFJlc3VsdCIsImVyck1zZyIsImRvbmUiLCJ2YWx1ZSIsImNvbnRlbnRMZW5ndGgiLCJzZXRSZXNwb25zZUxlbmd0aCIsImxlbiIsIm5vcm1hbGl6ZWROZXciLCJsZXZlbCIsInByb2dyZXNzIiwic3VidHlwZSIsInRhc2tfaWQiLCJ0b29sX3VzZV9pZCIsIm91dHB1dF9maWxlIiwic3VtbWFyeSIsInRvdGFsX3Rva2VucyIsInRva2VuQ291bnQiLCJ0b29sX3VzZXMiLCJ0b29sVXNlQ291bnQiLCJsYXN0TWVzc2FnZSIsImZpbmRMYXN0IiwiXyIsImhhc0Fzc2lzdGFudE1lc3NhZ2VzIiwidGV4dCIsImlzUmVhZE9ubHkiLCJ0b0F1dG9DbGFzc2lmaWVySW5wdXQiLCJpIiwidGFncyIsInByZWZpeCIsImlzQ29uY3VycmVuY3lTYWZlIiwiZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbiIsImNoZWNrUGVybWlzc2lvbnMiLCJiZWhhdmlvciIsInVwZGF0ZWRJbnB1dCIsIm1hcFRvb2xSZXN1bHRUb1Rvb2xSZXN1bHRCbG9ja1BhcmFtIiwiaW50ZXJuYWxEYXRhIiwic3Bhd25EYXRhIiwiaW5zdHJ1Y3Rpb25zIiwid29ya3RyZWVEYXRhIiwiUmVjb3JkIiwid29ya3RyZWVJbmZvVGV4dCIsImNvbnRlbnRPck1hcmtlciIsImhhcyIsInJlbmRlckdyb3VwZWRUb29sVXNlIiwidGVhbUNvbnRleHQiXSwic291cmNlcyI6WyJBZ2VudFRvb2wudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0ICogYXMgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyBidWlsZFRvb2wsIHR5cGUgVG9vbERlZiwgdG9vbE1hdGNoZXNOYW1lIH0gZnJvbSAnc3JjL1Rvb2wuanMnXG5pbXBvcnQgdHlwZSB7XG4gIE1lc3NhZ2UgYXMgTWVzc2FnZVR5cGUsXG4gIE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSxcbn0gZnJvbSAnc3JjL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBnZXRRdWVyeVNvdXJjZUZvckFnZW50IH0gZnJvbSAnc3JjL3V0aWxzL3Byb21wdENhdGVnb3J5LmpzJ1xuaW1wb3J0IHsgeiB9IGZyb20gJ3pvZC92NCdcbmltcG9ydCB7XG4gIGNsZWFySW52b2tlZFNraWxsc0ZvckFnZW50LFxuICBnZXRTZGtBZ2VudFByb2dyZXNzU3VtbWFyaWVzRW5hYmxlZCxcbn0gZnJvbSAnLi4vLi4vYm9vdHN0cmFwL3N0YXRlLmpzJ1xuaW1wb3J0IHtcbiAgZW5oYW5jZVN5c3RlbVByb21wdFdpdGhFbnZEZXRhaWxzLFxuICBnZXRTeXN0ZW1Qcm9tcHQsXG59IGZyb20gJy4uLy4uL2NvbnN0YW50cy9wcm9tcHRzLmpzJ1xuaW1wb3J0IHsgaXNDb29yZGluYXRvck1vZGUgfSBmcm9tICcuLi8uLi9jb29yZGluYXRvci9jb29yZGluYXRvck1vZGUuanMnXG5pbXBvcnQgeyBzdGFydEFnZW50U3VtbWFyaXphdGlvbiB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL0FnZW50U3VtbWFyeS9hZ2VudFN1bW1hcnkuanMnXG5pbXBvcnQgeyBnZXRGZWF0dXJlVmFsdWVfQ0FDSEVEX01BWV9CRV9TVEFMRSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FuYWx5dGljcy9ncm93dGhib29rLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICBsb2dFdmVudCxcbn0gZnJvbSAnLi4vLi4vc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgY2xlYXJEdW1wU3RhdGUgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hcGkvZHVtcFByb21wdHMuanMnXG5pbXBvcnQge1xuICBjb21wbGV0ZUFnZW50VGFzayBhcyBjb21wbGV0ZUFzeW5jQWdlbnQsXG4gIGNyZWF0ZUFjdGl2aXR5RGVzY3JpcHRpb25SZXNvbHZlcixcbiAgY3JlYXRlUHJvZ3Jlc3NUcmFja2VyLFxuICBlbnF1ZXVlQWdlbnROb3RpZmljYXRpb24sXG4gIGZhaWxBZ2VudFRhc2sgYXMgZmFpbEFzeW5jQWdlbnQsXG4gIGdldFByb2dyZXNzVXBkYXRlLFxuICBnZXRUb2tlbkNvdW50RnJvbVRyYWNrZXIsXG4gIGlzTG9jYWxBZ2VudFRhc2ssXG4gIGtpbGxBc3luY0FnZW50LFxuICByZWdpc3RlckFnZW50Rm9yZWdyb3VuZCxcbiAgcmVnaXN0ZXJBc3luY0FnZW50LFxuICB1bnJlZ2lzdGVyQWdlbnRGb3JlZ3JvdW5kLFxuICB1cGRhdGVBZ2VudFByb2dyZXNzIGFzIHVwZGF0ZUFzeW5jQWdlbnRQcm9ncmVzcyxcbiAgdXBkYXRlUHJvZ3Jlc3NGcm9tTWVzc2FnZSxcbn0gZnJvbSAnLi4vLi4vdGFza3MvTG9jYWxBZ2VudFRhc2svTG9jYWxBZ2VudFRhc2suanMnXG5pbXBvcnQge1xuICBjaGVja1JlbW90ZUFnZW50RWxpZ2liaWxpdHksXG4gIGZvcm1hdFByZWNvbmRpdGlvbkVycm9yLFxuICBnZXRSZW1vdGVUYXNrU2Vzc2lvblVybCxcbiAgcmVnaXN0ZXJSZW1vdGVBZ2VudFRhc2ssXG59IGZyb20gJy4uLy4uL3Rhc2tzL1JlbW90ZUFnZW50VGFzay9SZW1vdGVBZ2VudFRhc2suanMnXG5pbXBvcnQgeyBhc3NlbWJsZVRvb2xQb29sIH0gZnJvbSAnLi4vLi4vdG9vbHMuanMnXG5pbXBvcnQgeyBhc0FnZW50SWQgfSBmcm9tICcuLi8uLi90eXBlcy9pZHMuanMnXG5pbXBvcnQgeyBydW5XaXRoQWdlbnRDb250ZXh0IH0gZnJvbSAnLi4vLi4vdXRpbHMvYWdlbnRDb250ZXh0LmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQgeyBnZXRDd2QsIHJ1bldpdGhDd2RPdmVycmlkZSB9IGZyb20gJy4uLy4uL3V0aWxzL2N3ZC5qcydcbmltcG9ydCB7IGxvZ0ZvckRlYnVnZ2luZyB9IGZyb20gJy4uLy4uL3V0aWxzL2RlYnVnLmpzJ1xuaW1wb3J0IHsgaXNFbnZUcnV0aHkgfSBmcm9tICcuLi8uLi91dGlscy9lbnZVdGlscy5qcydcbmltcG9ydCB7IEFib3J0RXJyb3IsIGVycm9yTWVzc2FnZSwgdG9FcnJvciB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy5qcydcbmltcG9ydCB0eXBlIHsgQ2FjaGVTYWZlUGFyYW1zIH0gZnJvbSAnLi4vLi4vdXRpbHMvZm9ya2VkQWdlbnQuanMnXG5pbXBvcnQgeyBsYXp5U2NoZW1hIH0gZnJvbSAnLi4vLi4vdXRpbHMvbGF6eVNjaGVtYS5qcydcbmltcG9ydCB7XG4gIGNyZWF0ZVVzZXJNZXNzYWdlLFxuICBleHRyYWN0VGV4dENvbnRlbnQsXG4gIGlzU3ludGhldGljTWVzc2FnZSxcbiAgbm9ybWFsaXplTWVzc2FnZXMsXG59IGZyb20gJy4uLy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHsgZ2V0QWdlbnRNb2RlbCB9IGZyb20gJy4uLy4uL3V0aWxzL21vZGVsL2FnZW50LmpzJ1xuaW1wb3J0IHsgcGVybWlzc2lvbk1vZGVTY2hlbWEgfSBmcm9tICcuLi8uLi91dGlscy9wZXJtaXNzaW9ucy9QZXJtaXNzaW9uTW9kZS5qcydcbmltcG9ydCB0eXBlIHsgUGVybWlzc2lvblJlc3VsdCB9IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL1Blcm1pc3Npb25SZXN1bHQuanMnXG5pbXBvcnQge1xuICBmaWx0ZXJEZW5pZWRBZ2VudHMsXG4gIGdldERlbnlSdWxlRm9yQWdlbnQsXG59IGZyb20gJy4uLy4uL3V0aWxzL3Blcm1pc3Npb25zL3Blcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHsgZW5xdWV1ZVNka0V2ZW50IH0gZnJvbSAnLi4vLi4vdXRpbHMvc2RrRXZlbnRRdWV1ZS5qcydcbmltcG9ydCB7IHdyaXRlQWdlbnRNZXRhZGF0YSB9IGZyb20gJy4uLy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tICcuLi8uLi91dGlscy9zbGVlcC5qcydcbmltcG9ydCB7IGJ1aWxkRWZmZWN0aXZlU3lzdGVtUHJvbXB0IH0gZnJvbSAnLi4vLi4vdXRpbHMvc3lzdGVtUHJvbXB0LmpzJ1xuaW1wb3J0IHsgYXNTeXN0ZW1Qcm9tcHQgfSBmcm9tICcuLi8uLi91dGlscy9zeXN0ZW1Qcm9tcHRUeXBlLmpzJ1xuaW1wb3J0IHsgZ2V0VGFza091dHB1dFBhdGggfSBmcm9tICcuLi8uLi91dGlscy90YXNrL2Rpc2tPdXRwdXQuanMnXG5pbXBvcnQgeyBnZXRQYXJlbnRTZXNzaW9uSWQsIGlzVGVhbW1hdGUgfSBmcm9tICcuLi8uLi91dGlscy90ZWFtbWF0ZS5qcydcbmltcG9ydCB7IGlzSW5Qcm9jZXNzVGVhbW1hdGUgfSBmcm9tICcuLi8uLi91dGlscy90ZWFtbWF0ZUNvbnRleHQuanMnXG5pbXBvcnQgeyB0ZWxlcG9ydFRvUmVtb3RlIH0gZnJvbSAnLi4vLi4vdXRpbHMvdGVsZXBvcnQuanMnXG5pbXBvcnQgeyBnZXRBc3Npc3RhbnRNZXNzYWdlQ29udGVudExlbmd0aCB9IGZyb20gJy4uLy4uL3V0aWxzL3Rva2Vucy5qcydcbmltcG9ydCB7IGNyZWF0ZUFnZW50SWQgfSBmcm9tICcuLi8uLi91dGlscy91dWlkLmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlQWdlbnRXb3JrdHJlZSxcbiAgaGFzV29ya3RyZWVDaGFuZ2VzLFxuICByZW1vdmVBZ2VudFdvcmt0cmVlLFxufSBmcm9tICcuLi8uLi91dGlscy93b3JrdHJlZS5qcydcbmltcG9ydCB7IEJBU0hfVE9PTF9OQU1FIH0gZnJvbSAnLi4vQmFzaFRvb2wvdG9vbE5hbWUuanMnXG5pbXBvcnQgeyBCYWNrZ3JvdW5kSGludCB9IGZyb20gJy4uL0Jhc2hUb29sL1VJLmpzJ1xuaW1wb3J0IHsgRklMRV9SRUFEX1RPT0xfTkFNRSB9IGZyb20gJy4uL0ZpbGVSZWFkVG9vbC9wcm9tcHQuanMnXG5pbXBvcnQgeyBzcGF3blRlYW1tYXRlIH0gZnJvbSAnLi4vc2hhcmVkL3NwYXduTXVsdGlBZ2VudC5qcydcbmltcG9ydCB7IHNldEFnZW50Q29sb3IgfSBmcm9tICcuL2FnZW50Q29sb3JNYW5hZ2VyLmpzJ1xuaW1wb3J0IHtcbiAgYWdlbnRUb29sUmVzdWx0U2NoZW1hLFxuICBjbGFzc2lmeUhhbmRvZmZJZk5lZWRlZCxcbiAgZW1pdFRhc2tQcm9ncmVzcyxcbiAgZXh0cmFjdFBhcnRpYWxSZXN1bHQsXG4gIGZpbmFsaXplQWdlbnRUb29sLFxuICBnZXRMYXN0VG9vbFVzZU5hbWUsXG4gIHJ1bkFzeW5jQWdlbnRMaWZlY3ljbGUsXG59IGZyb20gJy4vYWdlbnRUb29sVXRpbHMuanMnXG5pbXBvcnQgeyBHRU5FUkFMX1BVUlBPU0VfQUdFTlQgfSBmcm9tICcuL2J1aWx0LWluL2dlbmVyYWxQdXJwb3NlQWdlbnQuanMnXG5pbXBvcnQge1xuICBBR0VOVF9UT09MX05BTUUsXG4gIExFR0FDWV9BR0VOVF9UT09MX05BTUUsXG4gIE9ORV9TSE9UX0JVSUxUSU5fQUdFTlRfVFlQRVMsXG59IGZyb20gJy4vY29uc3RhbnRzLmpzJ1xuaW1wb3J0IHtcbiAgYnVpbGRGb3JrZWRNZXNzYWdlcyxcbiAgYnVpbGRXb3JrdHJlZU5vdGljZSxcbiAgRk9SS19BR0VOVCxcbiAgaXNGb3JrU3ViYWdlbnRFbmFibGVkLFxuICBpc0luRm9ya0NoaWxkLFxufSBmcm9tICcuL2ZvcmtTdWJhZ2VudC5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnREZWZpbml0aW9uIH0gZnJvbSAnLi9sb2FkQWdlbnRzRGlyLmpzJ1xuaW1wb3J0IHtcbiAgZmlsdGVyQWdlbnRzQnlNY3BSZXF1aXJlbWVudHMsXG4gIGhhc1JlcXVpcmVkTWNwU2VydmVycyxcbiAgaXNCdWlsdEluQWdlbnQsXG59IGZyb20gJy4vbG9hZEFnZW50c0Rpci5qcydcbmltcG9ydCB7IGdldFByb21wdCB9IGZyb20gJy4vcHJvbXB0LmpzJ1xuaW1wb3J0IHsgcnVuQWdlbnQgfSBmcm9tICcuL3J1bkFnZW50LmpzJ1xuaW1wb3J0IHtcbiAgcmVuZGVyR3JvdXBlZEFnZW50VG9vbFVzZSxcbiAgcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UsXG4gIHJlbmRlclRvb2xVc2VFcnJvck1lc3NhZ2UsXG4gIHJlbmRlclRvb2xVc2VNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUmVqZWN0ZWRNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlVGFnLFxuICB1c2VyRmFjaW5nTmFtZSxcbiAgdXNlckZhY2luZ05hbWVCYWNrZ3JvdW5kQ29sb3IsXG59IGZyb20gJy4vVUkuanMnXG5cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IHByb2FjdGl2ZU1vZHVsZSA9XG4gIGZlYXR1cmUoJ1BST0FDVElWRScpIHx8IGZlYXR1cmUoJ0tBSVJPUycpXG4gICAgPyAocmVxdWlyZSgnLi4vLi4vcHJvYWN0aXZlL2luZGV4LmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi4vLi4vcHJvYWN0aXZlL2luZGV4LmpzJykpXG4gICAgOiBudWxsXG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cblxuLy8gUHJvZ3Jlc3MgZGlzcGxheSBjb25zdGFudHMgKGZvciBzaG93aW5nIGJhY2tncm91bmQgaGludClcbmNvbnN0IFBST0dSRVNTX1RIUkVTSE9MRF9NUyA9IDIwMDAgLy8gU2hvdyBiYWNrZ3JvdW5kIGhpbnQgYWZ0ZXIgMiBzZWNvbmRzXG5cbi8vIENoZWNrIGlmIGJhY2tncm91bmQgdGFza3MgYXJlIGRpc2FibGVkIGF0IG1vZHVsZSBsb2FkIHRpbWVcbmNvbnN0IGlzQmFja2dyb3VuZFRhc2tzRGlzYWJsZWQgPVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgY3VzdG9tLXJ1bGVzL25vLXByb2Nlc3MtZW52LXRvcC1sZXZlbCAtLSBJbnRlbnRpb25hbDogc2NoZW1hIG11c3QgYmUgZGVmaW5lZCBhdCBtb2R1bGUgbG9hZFxuICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9ESVNBQkxFX0JBQ0tHUk9VTkRfVEFTS1MpXG5cbi8vIEF1dG8tYmFja2dyb3VuZCBhZ2VudCB0YXNrcyBhZnRlciB0aGlzIG1hbnkgbXMgKDAgPSBkaXNhYmxlZClcbi8vIEVuYWJsZWQgYnkgZW52IHZhciBPUiBHcm93dGhCb29rIGdhdGUgKGNoZWNrZWQgbGF6aWx5IHNpbmNlIEdCIG1heSBub3QgYmUgcmVhZHkgYXQgbW9kdWxlIGxvYWQpXG5mdW5jdGlvbiBnZXRBdXRvQmFja2dyb3VuZE1zKCk6IG51bWJlciB7XG4gIGlmIChcbiAgICBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQVVUT19CQUNLR1JPVU5EX1RBU0tTKSB8fFxuICAgIGdldEZlYXR1cmVWYWx1ZV9DQUNIRURfTUFZX0JFX1NUQUxFKCd0ZW5ndV9hdXRvX2JhY2tncm91bmRfYWdlbnRzJywgZmFsc2UpXG4gICkge1xuICAgIHJldHVybiAxMjBfMDAwXG4gIH1cbiAgcmV0dXJuIDBcbn1cblxuLy8gTXVsdGktYWdlbnQgdHlwZSBjb25zdGFudHMgYXJlIGRlZmluZWQgaW5saW5lIGluc2lkZSBnYXRlZCBibG9ja3MgdG8gZW5hYmxlIGRlYWQgY29kZSBlbGltaW5hdGlvblxuXG4vLyBCYXNlIGlucHV0IHNjaGVtYSB3aXRob3V0IG11bHRpLWFnZW50IHBhcmFtZXRlcnNcbmNvbnN0IGJhc2VJbnB1dFNjaGVtYSA9IGxhenlTY2hlbWEoKCkgPT5cbiAgei5vYmplY3Qoe1xuICAgIGRlc2NyaXB0aW9uOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5kZXNjcmliZSgnQSBzaG9ydCAoMy01IHdvcmQpIGRlc2NyaXB0aW9uIG9mIHRoZSB0YXNrJyksXG4gICAgcHJvbXB0OiB6LnN0cmluZygpLmRlc2NyaWJlKCdUaGUgdGFzayBmb3IgdGhlIGFnZW50IHRvIHBlcmZvcm0nKSxcbiAgICBzdWJhZ2VudF90eXBlOiB6XG4gICAgICAuc3RyaW5nKClcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoJ1RoZSB0eXBlIG9mIHNwZWNpYWxpemVkIGFnZW50IHRvIHVzZSBmb3IgdGhpcyB0YXNrJyksXG4gICAgbW9kZWw6IHpcbiAgICAgIC5lbnVtKFsnc29ubmV0JywgJ29wdXMnLCAnaGFpa3UnXSlcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoXG4gICAgICAgIFwiT3B0aW9uYWwgbW9kZWwgb3ZlcnJpZGUgZm9yIHRoaXMgYWdlbnQuIFRha2VzIHByZWNlZGVuY2Ugb3ZlciB0aGUgYWdlbnQgZGVmaW5pdGlvbidzIG1vZGVsIGZyb250bWF0dGVyLiBJZiBvbWl0dGVkLCB1c2VzIHRoZSBhZ2VudCBkZWZpbml0aW9uJ3MgbW9kZWwsIG9yIGluaGVyaXRzIGZyb20gdGhlIHBhcmVudC5cIixcbiAgICAgICksXG4gICAgcnVuX2luX2JhY2tncm91bmQ6IHpcbiAgICAgIC5ib29sZWFuKClcbiAgICAgIC5vcHRpb25hbCgpXG4gICAgICAuZGVzY3JpYmUoXG4gICAgICAgICdTZXQgdG8gdHJ1ZSB0byBydW4gdGhpcyBhZ2VudCBpbiB0aGUgYmFja2dyb3VuZC4gWW91IHdpbGwgYmUgbm90aWZpZWQgd2hlbiBpdCBjb21wbGV0ZXMuJyxcbiAgICAgICksXG4gIH0pLFxuKVxuXG4vLyBGdWxsIHNjaGVtYSBjb21iaW5pbmcgYmFzZSArIG11bHRpLWFnZW50IHBhcmFtcyArIGlzb2xhdGlvblxuY29uc3QgZnVsbElucHV0U2NoZW1hID0gbGF6eVNjaGVtYSgoKSA9PiB7XG4gIC8vIE11bHRpLWFnZW50IHBhcmFtZXRlcnNcbiAgY29uc3QgbXVsdGlBZ2VudElucHV0U2NoZW1hID0gei5vYmplY3Qoe1xuICAgIG5hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ05hbWUgZm9yIHRoZSBzcGF3bmVkIGFnZW50LiBNYWtlcyBpdCBhZGRyZXNzYWJsZSB2aWEgU2VuZE1lc3NhZ2Uoe3RvOiBuYW1lfSkgd2hpbGUgcnVubmluZy4nLFxuICAgICAgKSxcbiAgICB0ZWFtX25hbWU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ1RlYW0gbmFtZSBmb3Igc3Bhd25pbmcuIFVzZXMgY3VycmVudCB0ZWFtIGNvbnRleHQgaWYgb21pdHRlZC4nLFxuICAgICAgKSxcbiAgICBtb2RlOiBwZXJtaXNzaW9uTW9kZVNjaGVtYSgpXG4gICAgICAub3B0aW9uYWwoKVxuICAgICAgLmRlc2NyaWJlKFxuICAgICAgICAnUGVybWlzc2lvbiBtb2RlIGZvciBzcGF3bmVkIHRlYW1tYXRlIChlLmcuLCBcInBsYW5cIiB0byByZXF1aXJlIHBsYW4gYXBwcm92YWwpLicsXG4gICAgICApLFxuICB9KVxuXG4gIHJldHVybiBiYXNlSW5wdXRTY2hlbWEoKVxuICAgIC5tZXJnZShtdWx0aUFnZW50SW5wdXRTY2hlbWEpXG4gICAgLmV4dGVuZCh7XG4gICAgICBpc29sYXRpb246IChcImV4dGVybmFsXCIgPT09ICdhbnQnXG4gICAgICAgID8gei5lbnVtKFsnd29ya3RyZWUnLCAncmVtb3RlJ10pXG4gICAgICAgIDogei5lbnVtKFsnd29ya3RyZWUnXSlcbiAgICAgIClcbiAgICAgICAgLm9wdGlvbmFsKClcbiAgICAgICAgLmRlc2NyaWJlKFxuICAgICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCdcbiAgICAgICAgICAgID8gJ0lzb2xhdGlvbiBtb2RlLiBcIndvcmt0cmVlXCIgY3JlYXRlcyBhIHRlbXBvcmFyeSBnaXQgd29ya3RyZWUgc28gdGhlIGFnZW50IHdvcmtzIG9uIGFuIGlzb2xhdGVkIGNvcHkgb2YgdGhlIHJlcG8uIFwicmVtb3RlXCIgbGF1bmNoZXMgdGhlIGFnZW50IGluIGEgcmVtb3RlIENDUiBlbnZpcm9ubWVudCAoYWx3YXlzIHJ1bnMgaW4gYmFja2dyb3VuZCkuJ1xuICAgICAgICAgICAgOiAnSXNvbGF0aW9uIG1vZGUuIFwid29ya3RyZWVcIiBjcmVhdGVzIGEgdGVtcG9yYXJ5IGdpdCB3b3JrdHJlZSBzbyB0aGUgYWdlbnQgd29ya3Mgb24gYW4gaXNvbGF0ZWQgY29weSBvZiB0aGUgcmVwby4nLFxuICAgICAgICApLFxuICAgICAgY3dkOiB6XG4gICAgICAgIC5zdHJpbmcoKVxuICAgICAgICAub3B0aW9uYWwoKVxuICAgICAgICAuZGVzY3JpYmUoXG4gICAgICAgICAgJ0Fic29sdXRlIHBhdGggdG8gcnVuIHRoZSBhZ2VudCBpbi4gT3ZlcnJpZGVzIHRoZSB3b3JraW5nIGRpcmVjdG9yeSBmb3IgYWxsIGZpbGVzeXN0ZW0gYW5kIHNoZWxsIG9wZXJhdGlvbnMgd2l0aGluIHRoaXMgYWdlbnQuIE11dHVhbGx5IGV4Y2x1c2l2ZSB3aXRoIGlzb2xhdGlvbjogXCJ3b3JrdHJlZVwiLicsXG4gICAgICAgICksXG4gICAgfSlcbn0pXG5cbi8vIFN0cmlwIG9wdGlvbmFsIGZpZWxkcyBmcm9tIHRoZSBzY2hlbWEgd2hlbiB0aGUgYmFja2luZyBmZWF0dXJlIGlzIG9mZiBzb1xuLy8gdGhlIG1vZGVsIG5ldmVyIHNlZXMgdGhlbS4gRG9uZSB2aWEgLm9taXQoKSByYXRoZXIgdGhhbiBjb25kaXRpb25hbCBzcHJlYWRcbi8vIGluc2lkZSAuZXh0ZW5kKCkgYmVjYXVzZSB0aGUgc3ByZWFkLXRlcm5hcnkgYnJlYWtzIFpvZCdzIHR5cGUgaW5mZXJlbmNlXG4vLyAoZmllbGQgdHlwZSBjb2xsYXBzZXMgdG8gYHVua25vd25gKS4gVGhlIHRlcm5hcnkgcmV0dXJuIHByb2R1Y2VzIGEgdW5pb25cbi8vIHR5cGUsIGJ1dCBjYWxsKCkgZGVzdHJ1Y3R1cmVzIHZpYSB0aGUgZXhwbGljaXQgQWdlbnRUb29sSW5wdXQgdHlwZSBiZWxvd1xuLy8gd2hpY2ggYWx3YXlzIGluY2x1ZGVzIGFsbCBvcHRpb25hbCBmaWVsZHMuXG5leHBvcnQgY29uc3QgaW5wdXRTY2hlbWEgPSBsYXp5U2NoZW1hKCgpID0+IHtcbiAgY29uc3Qgc2NoZW1hID0gZmVhdHVyZSgnS0FJUk9TJylcbiAgICA/IGZ1bGxJbnB1dFNjaGVtYSgpXG4gICAgOiBmdWxsSW5wdXRTY2hlbWEoKS5vbWl0KHsgY3dkOiB0cnVlIH0pXG5cbiAgLy8gR3Jvd3RoQm9vay1pbi1sYXp5U2NoZW1hIGlzIGFjY2VwdGFibGUgaGVyZSAodW5saWtlIHN1YmFnZW50X3R5cGUsIHdoaWNoXG4gIC8vIHdhcyByZW1vdmVkIGluIDkwNmRhNmM3MjMpOiB0aGUgZGl2ZXJnZW5jZSB3aW5kb3cgaXMgb25lLXNlc3Npb24tcGVyLVxuICAvLyBnYXRlLWZsaXAgdmlhIF9DQUNIRURfTUFZX0JFX1NUQUxFIGRpc2sgcmVhZCwgYW5kIHdvcnN0IGNhc2UgaXMgZWl0aGVyXG4gIC8vIFwic2NoZW1hIHNob3dzIGEgbm8tb3AgcGFyYW1cIiAoZ2F0ZSBmbGlwcyBvbiBtaWQtc2Vzc2lvbjogcGFyYW0gaWdub3JlZFxuICAvLyBieSBmb3JjZUFzeW5jKSBvciBcInNjaGVtYSBoaWRlcyBhIHBhcmFtIHRoYXQgd291bGQndmUgd29ya2VkXCIgKGdhdGVcbiAgLy8gZmxpcHMgb2ZmIG1pZC1zZXNzaW9uOiBldmVyeXRoaW5nIHN0aWxsIHJ1bnMgYXN5bmMgdmlhIG1lbW9pemVkXG4gIC8vIGZvcmNlQXN5bmMpLiBObyBab2QgcmVqZWN0aW9uLCBubyBjcmFzaCDigJQgdW5saWtlIHJlcXVpcmVk4oaSb3B0aW9uYWwuXG4gIHJldHVybiBpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkIHx8IGlzRm9ya1N1YmFnZW50RW5hYmxlZCgpXG4gICAgPyBzY2hlbWEub21pdCh7IHJ1bl9pbl9iYWNrZ3JvdW5kOiB0cnVlIH0pXG4gICAgOiBzY2hlbWFcbn0pXG50eXBlIElucHV0U2NoZW1hID0gUmV0dXJuVHlwZTx0eXBlb2YgaW5wdXRTY2hlbWE+XG5cbi8vIEV4cGxpY2l0IHR5cGUgd2lkZW5zIHRoZSBzY2hlbWEgaW5mZXJlbmNlIHRvIGFsd2F5cyBpbmNsdWRlIGFsbCBvcHRpb25hbFxuLy8gZmllbGRzIGV2ZW4gd2hlbiAub21pdCgpIHN0cmlwcyB0aGVtIGZvciBnYXRpbmcgKGN3ZCwgcnVuX2luX2JhY2tncm91bmQpLlxuLy8gc3ViYWdlbnRfdHlwZSBpcyBvcHRpb25hbDsgY2FsbCgpIGRlZmF1bHRzIGl0IHRvIGdlbmVyYWwtcHVycG9zZSB3aGVuIHRoZVxuLy8gZm9yayBnYXRlIGlzIG9mZiwgb3Igcm91dGVzIHRvIHRoZSBmb3JrIHBhdGggd2hlbiB0aGUgZ2F0ZSBpcyBvbi5cbnR5cGUgQWdlbnRUb29sSW5wdXQgPSB6LmluZmVyPFJldHVyblR5cGU8dHlwZW9mIGJhc2VJbnB1dFNjaGVtYT4+ICYge1xuICBuYW1lPzogc3RyaW5nXG4gIHRlYW1fbmFtZT86IHN0cmluZ1xuICBtb2RlPzogei5pbmZlcjxSZXR1cm5UeXBlPHR5cGVvZiBwZXJtaXNzaW9uTW9kZVNjaGVtYT4+XG4gIGlzb2xhdGlvbj86ICd3b3JrdHJlZScgfCAncmVtb3RlJ1xuICBjd2Q/OiBzdHJpbmdcbn1cblxuLy8gT3V0cHV0IHNjaGVtYSAtIG11bHRpLWFnZW50IHNwYXduZWQgc2NoZW1hIGFkZGVkIGR5bmFtaWNhbGx5IGF0IHJ1bnRpbWUgd2hlbiBlbmFibGVkXG5leHBvcnQgY29uc3Qgb3V0cHV0U2NoZW1hID0gbGF6eVNjaGVtYSgoKSA9PiB7XG4gIGNvbnN0IHN5bmNPdXRwdXRTY2hlbWEgPSBhZ2VudFRvb2xSZXN1bHRTY2hlbWEoKS5leHRlbmQoe1xuICAgIHN0YXR1czogei5saXRlcmFsKCdjb21wbGV0ZWQnKSxcbiAgICBwcm9tcHQ6IHouc3RyaW5nKCksXG4gIH0pXG5cbiAgY29uc3QgYXN5bmNPdXRwdXRTY2hlbWEgPSB6Lm9iamVjdCh7XG4gICAgc3RhdHVzOiB6LmxpdGVyYWwoJ2FzeW5jX2xhdW5jaGVkJyksXG4gICAgYWdlbnRJZDogei5zdHJpbmcoKS5kZXNjcmliZSgnVGhlIElEIG9mIHRoZSBhc3luYyBhZ2VudCcpLFxuICAgIGRlc2NyaXB0aW9uOiB6LnN0cmluZygpLmRlc2NyaWJlKCdUaGUgZGVzY3JpcHRpb24gb2YgdGhlIHRhc2snKSxcbiAgICBwcm9tcHQ6IHouc3RyaW5nKCkuZGVzY3JpYmUoJ1RoZSBwcm9tcHQgZm9yIHRoZSBhZ2VudCcpLFxuICAgIG91dHB1dEZpbGU6IHpcbiAgICAgIC5zdHJpbmcoKVxuICAgICAgLmRlc2NyaWJlKCdQYXRoIHRvIHRoZSBvdXRwdXQgZmlsZSBmb3IgY2hlY2tpbmcgYWdlbnQgcHJvZ3Jlc3MnKSxcbiAgICBjYW5SZWFkT3V0cHV0RmlsZTogelxuICAgICAgLmJvb2xlYW4oKVxuICAgICAgLm9wdGlvbmFsKClcbiAgICAgIC5kZXNjcmliZShcbiAgICAgICAgJ1doZXRoZXIgdGhlIGNhbGxpbmcgYWdlbnQgaGFzIFJlYWQvQmFzaCB0b29scyB0byBjaGVjayBwcm9ncmVzcycsXG4gICAgICApLFxuICB9KVxuXG4gIHJldHVybiB6LnVuaW9uKFtzeW5jT3V0cHV0U2NoZW1hLCBhc3luY091dHB1dFNjaGVtYV0pXG59KVxudHlwZSBPdXRwdXRTY2hlbWEgPSBSZXR1cm5UeXBlPHR5cGVvZiBvdXRwdXRTY2hlbWE+XG50eXBlIE91dHB1dCA9IHouaW5wdXQ8T3V0cHV0U2NoZW1hPlxuXG4vLyBQcml2YXRlIHR5cGUgZm9yIHRlYW1tYXRlIHNwYXduIHJlc3VsdHMgLSBleGNsdWRlZCBmcm9tIGV4cG9ydGVkIHNjaGVtYSBmb3IgZGVhZCBjb2RlIGVsaW1pbmF0aW9uXG4vLyBUaGUgJ3RlYW1tYXRlX3NwYXduZWQnIHN0YXR1cyBzdHJpbmcgaXMgb25seSBpbmNsdWRlZCB3aGVuIEVOQUJMRV9BR0VOVF9TV0FSTVMgaXMgdHJ1ZVxudHlwZSBUZWFtbWF0ZVNwYXduZWRPdXRwdXQgPSB7XG4gIHN0YXR1czogJ3RlYW1tYXRlX3NwYXduZWQnXG4gIHByb21wdDogc3RyaW5nXG4gIHRlYW1tYXRlX2lkOiBzdHJpbmdcbiAgYWdlbnRfaWQ6IHN0cmluZ1xuICBhZ2VudF90eXBlPzogc3RyaW5nXG4gIG1vZGVsPzogc3RyaW5nXG4gIG5hbWU6IHN0cmluZ1xuICBjb2xvcj86IHN0cmluZ1xuICB0bXV4X3Nlc3Npb25fbmFtZTogc3RyaW5nXG4gIHRtdXhfd2luZG93X25hbWU6IHN0cmluZ1xuICB0bXV4X3BhbmVfaWQ6IHN0cmluZ1xuICB0ZWFtX25hbWU/OiBzdHJpbmdcbiAgaXNfc3BsaXRwYW5lPzogYm9vbGVhblxuICBwbGFuX21vZGVfcmVxdWlyZWQ/OiBib29sZWFuXG59XG5cbi8vIENvbWJpbmVkIG91dHB1dCB0eXBlIGluY2x1ZGluZyBib3RoIHB1YmxpYyBhbmQgaW50ZXJuYWwgdHlwZXNcbi8vIE5vdGU6IFRlYW1tYXRlU3Bhd25lZE91dHB1dCB0eXBlIGlzIGZpbmUgLSBUeXBlU2NyaXB0IHR5cGVzIGFyZSBlcmFzZWQgYXQgY29tcGlsZSB0aW1lXG4vLyBQcml2YXRlIHR5cGUgZm9yIHJlbW90ZS1sYXVuY2hlZCByZXN1bHRzIOKAlCBleGNsdWRlZCBmcm9tIGV4cG9ydGVkIHNjaGVtYVxuLy8gbGlrZSBUZWFtbWF0ZVNwYXduZWRPdXRwdXQgZm9yIGRlYWQgY29kZSBlbGltaW5hdGlvbiBwdXJwb3Nlcy4gRXhwb3J0ZWRcbi8vIGZvciBVSS50c3ggdG8gZG8gcHJvcGVyIGRpc2NyaW1pbmF0ZWQtdW5pb24gbmFycm93aW5nIGluc3RlYWQgb2YgYWQtaG9jIGNhc3RzLlxuZXhwb3J0IHR5cGUgUmVtb3RlTGF1bmNoZWRPdXRwdXQgPSB7XG4gIHN0YXR1czogJ3JlbW90ZV9sYXVuY2hlZCdcbiAgdGFza0lkOiBzdHJpbmdcbiAgc2Vzc2lvblVybDogc3RyaW5nXG4gIGRlc2NyaXB0aW9uOiBzdHJpbmdcbiAgcHJvbXB0OiBzdHJpbmdcbiAgb3V0cHV0RmlsZTogc3RyaW5nXG59XG5cbnR5cGUgSW50ZXJuYWxPdXRwdXQgPSBPdXRwdXQgfCBUZWFtbWF0ZVNwYXduZWRPdXRwdXQgfCBSZW1vdGVMYXVuY2hlZE91dHB1dFxuXG5pbXBvcnQgdHlwZSB7IEFnZW50VG9vbFByb2dyZXNzLCBTaGVsbFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vdHlwZXMvdG9vbHMuanMnXG4vLyBBZ2VudFRvb2wgZm9yd2FyZHMgYm90aCBpdHMgb3duIHByb2dyZXNzIGV2ZW50cyBhbmQgc2hlbGwgcHJvZ3Jlc3Ncbi8vIGV2ZW50cyBmcm9tIHRoZSBzdWItYWdlbnQgc28gdGhlIFNESyByZWNlaXZlcyB0b29sX3Byb2dyZXNzIHVwZGF0ZXMgZHVyaW5nIGJhc2gvcG93ZXJzaGVsbCBydW5zLlxuZXhwb3J0IHR5cGUgUHJvZ3Jlc3MgPSBBZ2VudFRvb2xQcm9ncmVzcyB8IFNoZWxsUHJvZ3Jlc3NcblxuZXhwb3J0IGNvbnN0IEFnZW50VG9vbCA9IGJ1aWxkVG9vbCh7XG4gIGFzeW5jIHByb21wdCh7IGFnZW50cywgdG9vbHMsIGdldFRvb2xQZXJtaXNzaW9uQ29udGV4dCwgYWxsb3dlZEFnZW50VHlwZXMgfSkge1xuICAgIGNvbnN0IHRvb2xQZXJtaXNzaW9uQ29udGV4dCA9IGF3YWl0IGdldFRvb2xQZXJtaXNzaW9uQ29udGV4dCgpXG5cbiAgICAvLyBHZXQgTUNQIHNlcnZlcnMgdGhhdCBoYXZlIHRvb2xzIGF2YWlsYWJsZVxuICAgIGNvbnN0IG1jcFNlcnZlcnNXaXRoVG9vbHM6IHN0cmluZ1tdID0gW11cbiAgICBmb3IgKGNvbnN0IHRvb2wgb2YgdG9vbHMpIHtcbiAgICAgIGlmICh0b29sLm5hbWU/LnN0YXJ0c1dpdGgoJ21jcF9fJykpIHtcbiAgICAgICAgY29uc3QgcGFydHMgPSB0b29sLm5hbWUuc3BsaXQoJ19fJylcbiAgICAgICAgY29uc3Qgc2VydmVyTmFtZSA9IHBhcnRzWzFdXG4gICAgICAgIGlmIChzZXJ2ZXJOYW1lICYmICFtY3BTZXJ2ZXJzV2l0aFRvb2xzLmluY2x1ZGVzKHNlcnZlck5hbWUpKSB7XG4gICAgICAgICAgbWNwU2VydmVyc1dpdGhUb29scy5wdXNoKHNlcnZlck5hbWUpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBGaWx0ZXIgYWdlbnRzOiBmaXJzdCBieSBNQ1AgcmVxdWlyZW1lbnRzLCB0aGVuIGJ5IHBlcm1pc3Npb24gcnVsZXNcbiAgICBjb25zdCBhZ2VudHNXaXRoTWNwUmVxdWlyZW1lbnRzTWV0ID0gZmlsdGVyQWdlbnRzQnlNY3BSZXF1aXJlbWVudHMoXG4gICAgICBhZ2VudHMsXG4gICAgICBtY3BTZXJ2ZXJzV2l0aFRvb2xzLFxuICAgIClcbiAgICBjb25zdCBmaWx0ZXJlZEFnZW50cyA9IGZpbHRlckRlbmllZEFnZW50cyhcbiAgICAgIGFnZW50c1dpdGhNY3BSZXF1aXJlbWVudHNNZXQsXG4gICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICBBR0VOVF9UT09MX05BTUUsXG4gICAgKVxuXG4gICAgLy8gVXNlIGlubGluZSBlbnYgY2hlY2sgaW5zdGVhZCBvZiBjb29yZGluYXRvck1vZHVsZSB0byBhdm9pZCBjaXJjdWxhclxuICAgIC8vIGRlcGVuZGVuY3kgaXNzdWVzIGR1cmluZyB0ZXN0IG1vZHVsZSBsb2FkaW5nLlxuICAgIGNvbnN0IGlzQ29vcmRpbmF0b3IgPSBmZWF0dXJlKCdDT09SRElOQVRPUl9NT0RFJylcbiAgICAgID8gaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfQ09PUkRJTkFUT1JfTU9ERSlcbiAgICAgIDogZmFsc2VcbiAgICByZXR1cm4gYXdhaXQgZ2V0UHJvbXB0KGZpbHRlcmVkQWdlbnRzLCBpc0Nvb3JkaW5hdG9yLCBhbGxvd2VkQWdlbnRUeXBlcylcbiAgfSxcbiAgbmFtZTogQUdFTlRfVE9PTF9OQU1FLFxuICBzZWFyY2hIaW50OiAnZGVsZWdhdGUgd29yayB0byBhIHN1YmFnZW50JyxcbiAgYWxpYXNlczogW0xFR0FDWV9BR0VOVF9UT09MX05BTUVdLFxuICBtYXhSZXN1bHRTaXplQ2hhcnM6IDEwMF8wMDAsXG4gIGFzeW5jIGRlc2NyaXB0aW9uKCkge1xuICAgIHJldHVybiAnTGF1bmNoIGEgbmV3IGFnZW50J1xuICB9LFxuICBnZXQgaW5wdXRTY2hlbWEoKTogSW5wdXRTY2hlbWEge1xuICAgIHJldHVybiBpbnB1dFNjaGVtYSgpXG4gIH0sXG4gIGdldCBvdXRwdXRTY2hlbWEoKTogT3V0cHV0U2NoZW1hIHtcbiAgICByZXR1cm4gb3V0cHV0U2NoZW1hKClcbiAgfSxcbiAgYXN5bmMgY2FsbChcbiAgICB7XG4gICAgICBwcm9tcHQsXG4gICAgICBzdWJhZ2VudF90eXBlLFxuICAgICAgZGVzY3JpcHRpb24sXG4gICAgICBtb2RlbDogbW9kZWxQYXJhbSxcbiAgICAgIHJ1bl9pbl9iYWNrZ3JvdW5kLFxuICAgICAgbmFtZSxcbiAgICAgIHRlYW1fbmFtZSxcbiAgICAgIG1vZGU6IHNwYXduTW9kZSxcbiAgICAgIGlzb2xhdGlvbixcbiAgICAgIGN3ZCxcbiAgICB9OiBBZ2VudFRvb2xJbnB1dCxcbiAgICB0b29sVXNlQ29udGV4dCxcbiAgICBjYW5Vc2VUb29sLFxuICAgIGFzc2lzdGFudE1lc3NhZ2UsXG4gICAgb25Qcm9ncmVzcz8sXG4gICkge1xuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KClcbiAgICBjb25zdCBtb2RlbCA9IGlzQ29vcmRpbmF0b3JNb2RlKCkgPyB1bmRlZmluZWQgOiBtb2RlbFBhcmFtXG5cbiAgICAvLyBHZXQgYXBwIHN0YXRlIGZvciBwZXJtaXNzaW9uIG1vZGUgYW5kIGFnZW50IGZpbHRlcmluZ1xuICAgIGNvbnN0IGFwcFN0YXRlID0gdG9vbFVzZUNvbnRleHQuZ2V0QXBwU3RhdGUoKVxuICAgIGNvbnN0IHBlcm1pc3Npb25Nb2RlID0gYXBwU3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0Lm1vZGVcbiAgICAvLyBJbi1wcm9jZXNzIHRlYW1tYXRlcyBnZXQgYSBuby1vcCBzZXRBcHBTdGF0ZTsgc2V0QXBwU3RhdGVGb3JUYXNrc1xuICAgIC8vIHJlYWNoZXMgdGhlIHJvb3Qgc3RvcmUgc28gdGFzayByZWdpc3RyYXRpb24vcHJvZ3Jlc3Mva2lsbCBzdGF5IHZpc2libGUuXG4gICAgY29uc3Qgcm9vdFNldEFwcFN0YXRlID1cbiAgICAgIHRvb2xVc2VDb250ZXh0LnNldEFwcFN0YXRlRm9yVGFza3MgPz8gdG9vbFVzZUNvbnRleHQuc2V0QXBwU3RhdGVcblxuICAgIC8vIENoZWNrIGlmIHVzZXIgaXMgdHJ5aW5nIHRvIHVzZSBhZ2VudCB0ZWFtcyB3aXRob3V0IGFjY2Vzc1xuICAgIGlmICh0ZWFtX25hbWUgJiYgIWlzQWdlbnRTd2FybXNFbmFibGVkKCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQWdlbnQgVGVhbXMgaXMgbm90IHlldCBhdmFpbGFibGUgb24geW91ciBwbGFuLicpXG4gICAgfVxuXG4gICAgLy8gVGVhbW1hdGVzIChpbi1wcm9jZXNzIG9yIHRtdXgpIHBhc3NpbmcgYG5hbWVgIHdvdWxkIHRyaWdnZXIgc3Bhd25UZWFtbWF0ZSgpXG4gICAgLy8gYmVsb3csIGJ1dCBUZWFtRmlsZS5tZW1iZXJzIGlzIGEgZmxhdCBhcnJheSB3aXRoIG9uZSBsZWFkQWdlbnRJZCDigJQgbmVzdGVkXG4gICAgLy8gdGVhbW1hdGVzIGxhbmQgaW4gdGhlIHJvc3RlciB3aXRoIG5vIHByb3ZlbmFuY2UgYW5kIGNvbmZ1c2UgdGhlIGxlYWQuXG4gICAgY29uc3QgdGVhbU5hbWUgPSByZXNvbHZlVGVhbU5hbWUoeyB0ZWFtX25hbWUgfSwgYXBwU3RhdGUpXG4gICAgaWYgKGlzVGVhbW1hdGUoKSAmJiB0ZWFtTmFtZSAmJiBuYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdUZWFtbWF0ZXMgY2Fubm90IHNwYXduIG90aGVyIHRlYW1tYXRlcyDigJQgdGhlIHRlYW0gcm9zdGVyIGlzIGZsYXQuIFRvIHNwYXduIGEgc3ViYWdlbnQgaW5zdGVhZCwgb21pdCB0aGUgYG5hbWVgIHBhcmFtZXRlci4nLFxuICAgICAgKVxuICAgIH1cbiAgICAvLyBJbi1wcm9jZXNzIHRlYW1tYXRlcyBjYW5ub3Qgc3Bhd24gYmFja2dyb3VuZCBhZ2VudHMgKHRoZWlyIGxpZmVjeWNsZSBpc1xuICAgIC8vIHRpZWQgdG8gdGhlIGxlYWRlcidzIHByb2Nlc3MpLiBUbXV4IHRlYW1tYXRlcyBhcmUgc2VwYXJhdGUgcHJvY2Vzc2VzIGFuZFxuICAgIC8vIGNhbiBtYW5hZ2UgdGhlaXIgb3duIGJhY2tncm91bmQgYWdlbnRzLlxuICAgIGlmIChpc0luUHJvY2Vzc1RlYW1tYXRlKCkgJiYgdGVhbU5hbWUgJiYgcnVuX2luX2JhY2tncm91bmQgPT09IHRydWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgJ0luLXByb2Nlc3MgdGVhbW1hdGVzIGNhbm5vdCBzcGF3biBiYWNrZ3JvdW5kIGFnZW50cy4gVXNlIHJ1bl9pbl9iYWNrZ3JvdW5kPWZhbHNlIGZvciBzeW5jaHJvbm91cyBzdWJhZ2VudHMuJyxcbiAgICAgIClcbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGEgbXVsdGktYWdlbnQgc3Bhd24gcmVxdWVzdFxuICAgIC8vIFNwYXduIGlzIHRyaWdnZXJlZCB3aGVuIHRlYW1fbmFtZSBpcyBzZXQgKGZyb20gcGFyYW0gb3IgY29udGV4dCkgYW5kIG5hbWUgaXMgcHJvdmlkZWRcbiAgICBpZiAodGVhbU5hbWUgJiYgbmFtZSkge1xuICAgICAgLy8gU2V0IGFnZW50IGRlZmluaXRpb24gY29sb3IgZm9yIGdyb3VwZWQgVUkgZGlzcGxheSBiZWZvcmUgc3Bhd25pbmdcbiAgICAgIGNvbnN0IGFnZW50RGVmID0gc3ViYWdlbnRfdHlwZVxuICAgICAgICA/IHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMuYWdlbnREZWZpbml0aW9ucy5hY3RpdmVBZ2VudHMuZmluZChcbiAgICAgICAgICAgIGEgPT4gYS5hZ2VudFR5cGUgPT09IHN1YmFnZW50X3R5cGUsXG4gICAgICAgICAgKVxuICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgaWYgKGFnZW50RGVmPy5jb2xvcikge1xuICAgICAgICBzZXRBZ2VudENvbG9yKHN1YmFnZW50X3R5cGUhLCBhZ2VudERlZi5jb2xvcilcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNwYXduVGVhbW1hdGUoXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIHByb21wdCxcbiAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICB0ZWFtX25hbWU6IHRlYW1OYW1lLFxuICAgICAgICAgIHVzZV9zcGxpdHBhbmU6IHRydWUsXG4gICAgICAgICAgcGxhbl9tb2RlX3JlcXVpcmVkOiBzcGF3bk1vZGUgPT09ICdwbGFuJyxcbiAgICAgICAgICBtb2RlbDogbW9kZWwgPz8gYWdlbnREZWY/Lm1vZGVsLFxuICAgICAgICAgIGFnZW50X3R5cGU6IHN1YmFnZW50X3R5cGUsXG4gICAgICAgICAgaW52b2tpbmdSZXF1ZXN0SWQ6IGFzc2lzdGFudE1lc3NhZ2U/LnJlcXVlc3RJZCxcbiAgICAgICAgfSxcbiAgICAgICAgdG9vbFVzZUNvbnRleHQsXG4gICAgICApXG5cbiAgICAgIC8vIFR5cGUgYXNzZXJ0aW9uIHVzZXMgVGVhbW1hdGVTcGF3bmVkT3V0cHV0IChkZWZpbmVkIGFib3ZlKSBpbnN0ZWFkIG9mIGFueS5cbiAgICAgIC8vIFRoaXMgdHlwZSBpcyBleGNsdWRlZCBmcm9tIHRoZSBleHBvcnRlZCBvdXRwdXRTY2hlbWEgZm9yIGRlYWQgY29kZSBlbGltaW5hdGlvbi5cbiAgICAgIC8vIENhc3QgdGhyb3VnaCB1bmtub3duIGJlY2F1c2UgVGVhbW1hdGVTcGF3bmVkT3V0cHV0IGlzIGludGVudGlvbmFsbHlcbiAgICAgIC8vIG5vdCBwYXJ0IG9mIHRoZSBleHBvcnRlZCBPdXRwdXQgdW5pb24gKGZvciBkZWFkIGNvZGUgZWxpbWluYXRpb24gcHVycG9zZXMpLlxuICAgICAgY29uc3Qgc3Bhd25SZXN1bHQ6IFRlYW1tYXRlU3Bhd25lZE91dHB1dCA9IHtcbiAgICAgICAgc3RhdHVzOiAndGVhbW1hdGVfc3Bhd25lZCcgYXMgY29uc3QsXG4gICAgICAgIHByb21wdCxcbiAgICAgICAgLi4ucmVzdWx0LmRhdGEsXG4gICAgICB9XG4gICAgICByZXR1cm4geyBkYXRhOiBzcGF3blJlc3VsdCB9IGFzIHVua25vd24gYXMgeyBkYXRhOiBPdXRwdXQgfVxuICAgIH1cblxuICAgIC8vIEZvcmsgc3ViYWdlbnQgZXhwZXJpbWVudCByb3V0aW5nOlxuICAgIC8vIC0gc3ViYWdlbnRfdHlwZSBzZXQ6IHVzZSBpdCAoZXhwbGljaXQgd2lucylcbiAgICAvLyAtIHN1YmFnZW50X3R5cGUgb21pdHRlZCwgZ2F0ZSBvbjogZm9yayBwYXRoICh1bmRlZmluZWQpXG4gICAgLy8gLSBzdWJhZ2VudF90eXBlIG9taXR0ZWQsIGdhdGUgb2ZmOiBkZWZhdWx0IGdlbmVyYWwtcHVycG9zZVxuICAgIGNvbnN0IGVmZmVjdGl2ZVR5cGUgPVxuICAgICAgc3ViYWdlbnRfdHlwZSA/P1xuICAgICAgKGlzRm9ya1N1YmFnZW50RW5hYmxlZCgpID8gdW5kZWZpbmVkIDogR0VORVJBTF9QVVJQT1NFX0FHRU5ULmFnZW50VHlwZSlcbiAgICBjb25zdCBpc0ZvcmtQYXRoID0gZWZmZWN0aXZlVHlwZSA9PT0gdW5kZWZpbmVkXG5cbiAgICBsZXQgc2VsZWN0ZWRBZ2VudDogQWdlbnREZWZpbml0aW9uXG4gICAgaWYgKGlzRm9ya1BhdGgpIHtcbiAgICAgIC8vIFJlY3Vyc2l2ZSBmb3JrIGd1YXJkOiBmb3JrIGNoaWxkcmVuIGtlZXAgdGhlIEFnZW50IHRvb2wgaW4gdGhlaXJcbiAgICAgIC8vIHBvb2wgZm9yIGNhY2hlLWlkZW50aWNhbCB0b29sIGRlZnMsIHNvIHJlamVjdCBmb3JrIGF0dGVtcHRzIGF0IGNhbGxcbiAgICAgIC8vIHRpbWUuIFByaW1hcnkgY2hlY2sgaXMgcXVlcnlTb3VyY2UgKGNvbXBhY3Rpb24tcmVzaXN0YW50IOKAlCBzZXQgb25cbiAgICAgIC8vIGNvbnRleHQub3B0aW9ucyBhdCBzcGF3biB0aW1lLCBzdXJ2aXZlcyBhdXRvY29tcGFjdCdzIG1lc3NhZ2VcbiAgICAgIC8vIHJld3JpdGUpLiBNZXNzYWdlLXNjYW4gZmFsbGJhY2sgY2F0Y2hlcyBhbnkgcGF0aCB3aGVyZSBxdWVyeVNvdXJjZVxuICAgICAgLy8gd2Fzbid0IHRocmVhZGVkLlxuICAgICAgaWYgKFxuICAgICAgICB0b29sVXNlQ29udGV4dC5vcHRpb25zLnF1ZXJ5U291cmNlID09PVxuICAgICAgICAgIGBhZ2VudDpidWlsdGluOiR7Rk9SS19BR0VOVC5hZ2VudFR5cGV9YCB8fFxuICAgICAgICBpc0luRm9ya0NoaWxkKHRvb2xVc2VDb250ZXh0Lm1lc3NhZ2VzKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnRm9yayBpcyBub3QgYXZhaWxhYmxlIGluc2lkZSBhIGZvcmtlZCB3b3JrZXIuIENvbXBsZXRlIHlvdXIgdGFzayBkaXJlY3RseSB1c2luZyB5b3VyIHRvb2xzLicsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHNlbGVjdGVkQWdlbnQgPSBGT1JLX0FHRU5UXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZpbHRlciBhZ2VudHMgdG8gZXhjbHVkZSB0aG9zZSBkZW5pZWQgdmlhIEFnZW50KEFnZW50TmFtZSkgc3ludGF4XG4gICAgICBjb25zdCBhbGxBZ2VudHMgPSB0b29sVXNlQ29udGV4dC5vcHRpb25zLmFnZW50RGVmaW5pdGlvbnMuYWN0aXZlQWdlbnRzXG4gICAgICBjb25zdCB7IGFsbG93ZWRBZ2VudFR5cGVzIH0gPSB0b29sVXNlQ29udGV4dC5vcHRpb25zLmFnZW50RGVmaW5pdGlvbnNcbiAgICAgIGNvbnN0IGFnZW50cyA9IGZpbHRlckRlbmllZEFnZW50cyhcbiAgICAgICAgLy8gV2hlbiBhbGxvd2VkQWdlbnRUeXBlcyBpcyBzZXQgKGZyb20gQWdlbnQoeCx5KSB0b29sIHNwZWMpLCByZXN0cmljdCB0byB0aG9zZSB0eXBlc1xuICAgICAgICBhbGxvd2VkQWdlbnRUeXBlc1xuICAgICAgICAgID8gYWxsQWdlbnRzLmZpbHRlcihhID0+IGFsbG93ZWRBZ2VudFR5cGVzLmluY2x1ZGVzKGEuYWdlbnRUeXBlKSlcbiAgICAgICAgICA6IGFsbEFnZW50cyxcbiAgICAgICAgYXBwU3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgICBBR0VOVF9UT09MX05BTUUsXG4gICAgICApXG5cbiAgICAgIGNvbnN0IGZvdW5kID0gYWdlbnRzLmZpbmQoYWdlbnQgPT4gYWdlbnQuYWdlbnRUeXBlID09PSBlZmZlY3RpdmVUeXBlKVxuICAgICAgaWYgKCFmb3VuZCkge1xuICAgICAgICAvLyBDaGVjayBpZiB0aGUgYWdlbnQgZXhpc3RzIGJ1dCBpcyBkZW5pZWQgYnkgcGVybWlzc2lvbiBydWxlc1xuICAgICAgICBjb25zdCBhZ2VudEV4aXN0c0J1dERlbmllZCA9IGFsbEFnZW50cy5maW5kKFxuICAgICAgICAgIGFnZW50ID0+IGFnZW50LmFnZW50VHlwZSA9PT0gZWZmZWN0aXZlVHlwZSxcbiAgICAgICAgKVxuICAgICAgICBpZiAoYWdlbnRFeGlzdHNCdXREZW5pZWQpIHtcbiAgICAgICAgICBjb25zdCBkZW55UnVsZSA9IGdldERlbnlSdWxlRm9yQWdlbnQoXG4gICAgICAgICAgICBhcHBTdGF0ZS50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICBBR0VOVF9UT09MX05BTUUsXG4gICAgICAgICAgICBlZmZlY3RpdmVUeXBlLFxuICAgICAgICAgIClcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgQWdlbnQgdHlwZSAnJHtlZmZlY3RpdmVUeXBlfScgaGFzIGJlZW4gZGVuaWVkIGJ5IHBlcm1pc3Npb24gcnVsZSAnJHtBR0VOVF9UT09MX05BTUV9KCR7ZWZmZWN0aXZlVHlwZX0pJyBmcm9tICR7ZGVueVJ1bGU/LnNvdXJjZSA/PyAnc2V0dGluZ3MnfS5gLFxuICAgICAgICAgIClcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFnZW50IHR5cGUgJyR7ZWZmZWN0aXZlVHlwZX0nIG5vdCBmb3VuZC4gQXZhaWxhYmxlIGFnZW50czogJHthZ2VudHNcbiAgICAgICAgICAgIC5tYXAoYSA9PiBhLmFnZW50VHlwZSlcbiAgICAgICAgICAgIC5qb2luKCcsICcpfWAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHNlbGVjdGVkQWdlbnQgPSBmb3VuZFxuICAgIH1cblxuICAgIC8vIFNhbWUgbGlmZWN5Y2xlIGNvbnN0cmFpbnQgYXMgdGhlIHJ1bl9pbl9iYWNrZ3JvdW5kIGd1YXJkIGFib3ZlLCBidXQgZm9yXG4gICAgLy8gYWdlbnQgZGVmaW5pdGlvbnMgdGhhdCBmb3JjZSBiYWNrZ3JvdW5kIHZpYSBgYmFja2dyb3VuZDogdHJ1ZWAuIENoZWNrZWRcbiAgICAvLyBoZXJlIGJlY2F1c2Ugc2VsZWN0ZWRBZ2VudCBpcyBvbmx5IG5vdyByZXNvbHZlZC5cbiAgICBpZiAoXG4gICAgICBpc0luUHJvY2Vzc1RlYW1tYXRlKCkgJiZcbiAgICAgIHRlYW1OYW1lICYmXG4gICAgICBzZWxlY3RlZEFnZW50LmJhY2tncm91bmQgPT09IHRydWVcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEluLXByb2Nlc3MgdGVhbW1hdGVzIGNhbm5vdCBzcGF3biBiYWNrZ3JvdW5kIGFnZW50cy4gQWdlbnQgJyR7c2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGV9JyBoYXMgYmFja2dyb3VuZDogdHJ1ZSBpbiBpdHMgZGVmaW5pdGlvbi5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIC8vIENhcHR1cmUgZm9yIHR5cGUgbmFycm93aW5nIOKAlCBgbGV0IHNlbGVjdGVkQWdlbnRgIHByZXZlbnRzIFRTIGZyb21cbiAgICAvLyBuYXJyb3dpbmcgcHJvcGVydHkgdHlwZXMgYWNyb3NzIHRoZSBpZi1lbHNlIGFzc2lnbm1lbnQgYWJvdmUuXG4gICAgY29uc3QgcmVxdWlyZWRNY3BTZXJ2ZXJzID0gc2VsZWN0ZWRBZ2VudC5yZXF1aXJlZE1jcFNlcnZlcnNcblxuICAgIC8vIENoZWNrIGlmIHJlcXVpcmVkIE1DUCBzZXJ2ZXJzIGhhdmUgdG9vbHMgYXZhaWxhYmxlXG4gICAgLy8gQSBzZXJ2ZXIgdGhhdCdzIGNvbm5lY3RlZCBidXQgbm90IGF1dGhlbnRpY2F0ZWQgd29uJ3QgaGF2ZSBhbnkgdG9vbHNcbiAgICBpZiAocmVxdWlyZWRNY3BTZXJ2ZXJzPy5sZW5ndGgpIHtcbiAgICAgIC8vIElmIGFueSByZXF1aXJlZCBzZXJ2ZXJzIGFyZSBzdGlsbCBwZW5kaW5nIChjb25uZWN0aW5nKSwgd2FpdCBmb3IgdGhlbVxuICAgICAgLy8gYmVmb3JlIGNoZWNraW5nIHRvb2wgYXZhaWxhYmlsaXR5LiBUaGlzIGF2b2lkcyBhIHJhY2UgY29uZGl0aW9uIHdoZXJlXG4gICAgICAvLyB0aGUgYWdlbnQgaXMgaW52b2tlZCBiZWZvcmUgTUNQIHNlcnZlcnMgZmluaXNoIGNvbm5lY3RpbmcuXG4gICAgICBjb25zdCBoYXNQZW5kaW5nUmVxdWlyZWRTZXJ2ZXJzID0gYXBwU3RhdGUubWNwLmNsaWVudHMuc29tZShcbiAgICAgICAgYyA9PlxuICAgICAgICAgIGMudHlwZSA9PT0gJ3BlbmRpbmcnICYmXG4gICAgICAgICAgcmVxdWlyZWRNY3BTZXJ2ZXJzLnNvbWUocGF0dGVybiA9PlxuICAgICAgICAgICAgYy5uYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocGF0dGVybi50b0xvd2VyQ2FzZSgpKSxcbiAgICAgICAgICApLFxuICAgICAgKVxuXG4gICAgICBsZXQgY3VycmVudEFwcFN0YXRlID0gYXBwU3RhdGVcbiAgICAgIGlmIChoYXNQZW5kaW5nUmVxdWlyZWRTZXJ2ZXJzKSB7XG4gICAgICAgIGNvbnN0IE1BWF9XQUlUX01TID0gMzBfMDAwXG4gICAgICAgIGNvbnN0IFBPTExfSU5URVJWQUxfTVMgPSA1MDBcbiAgICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgTUFYX1dBSVRfTVNcblxuICAgICAgICB3aGlsZSAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICAgICAgYXdhaXQgc2xlZXAoUE9MTF9JTlRFUlZBTF9NUylcbiAgICAgICAgICBjdXJyZW50QXBwU3RhdGUgPSB0b29sVXNlQ29udGV4dC5nZXRBcHBTdGF0ZSgpXG5cbiAgICAgICAgICAvLyBFYXJseSBleGl0OiBpZiBhbnkgcmVxdWlyZWQgc2VydmVyIGhhcyBhbHJlYWR5IGZhaWxlZCwgbm8gcG9pbnRcbiAgICAgICAgICAvLyB3YWl0aW5nIGZvciBvdGhlciBwZW5kaW5nIHNlcnZlcnMg4oCUIHRoZSBjaGVjayB3aWxsIGZhaWwgcmVnYXJkbGVzcy5cbiAgICAgICAgICBjb25zdCBoYXNGYWlsZWRSZXF1aXJlZFNlcnZlciA9IGN1cnJlbnRBcHBTdGF0ZS5tY3AuY2xpZW50cy5zb21lKFxuICAgICAgICAgICAgYyA9PlxuICAgICAgICAgICAgICBjLnR5cGUgPT09ICdmYWlsZWQnICYmXG4gICAgICAgICAgICAgIHJlcXVpcmVkTWNwU2VydmVycy5zb21lKHBhdHRlcm4gPT5cbiAgICAgICAgICAgICAgICBjLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoaGFzRmFpbGVkUmVxdWlyZWRTZXJ2ZXIpIGJyZWFrXG5cbiAgICAgICAgICBjb25zdCBzdGlsbFBlbmRpbmcgPSBjdXJyZW50QXBwU3RhdGUubWNwLmNsaWVudHMuc29tZShcbiAgICAgICAgICAgIGMgPT5cbiAgICAgICAgICAgICAgYy50eXBlID09PSAncGVuZGluZycgJiZcbiAgICAgICAgICAgICAgcmVxdWlyZWRNY3BTZXJ2ZXJzLnNvbWUocGF0dGVybiA9PlxuICAgICAgICAgICAgICAgIGMubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHBhdHRlcm4udG9Mb3dlckNhc2UoKSksXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgKVxuICAgICAgICAgIGlmICghc3RpbGxQZW5kaW5nKSBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEdldCBzZXJ2ZXJzIHRoYXQgYWN0dWFsbHkgaGF2ZSB0b29scyAobWVhbmluZyB0aGV5J3JlIGNvbm5lY3RlZCBBTkQgYXV0aGVudGljYXRlZClcbiAgICAgIGNvbnN0IHNlcnZlcnNXaXRoVG9vbHM6IHN0cmluZ1tdID0gW11cbiAgICAgIGZvciAoY29uc3QgdG9vbCBvZiBjdXJyZW50QXBwU3RhdGUubWNwLnRvb2xzKSB7XG4gICAgICAgIGlmICh0b29sLm5hbWU/LnN0YXJ0c1dpdGgoJ21jcF9fJykpIHtcbiAgICAgICAgICAvLyBFeHRyYWN0IHNlcnZlciBuYW1lIGZyb20gdG9vbCBuYW1lIChmb3JtYXQ6IG1jcF9fc2VydmVyTmFtZV9fdG9vbE5hbWUpXG4gICAgICAgICAgY29uc3QgcGFydHMgPSB0b29sLm5hbWUuc3BsaXQoJ19fJylcbiAgICAgICAgICBjb25zdCBzZXJ2ZXJOYW1lID0gcGFydHNbMV1cbiAgICAgICAgICBpZiAoc2VydmVyTmFtZSAmJiAhc2VydmVyc1dpdGhUb29scy5pbmNsdWRlcyhzZXJ2ZXJOYW1lKSkge1xuICAgICAgICAgICAgc2VydmVyc1dpdGhUb29scy5wdXNoKHNlcnZlck5hbWUpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzUmVxdWlyZWRNY3BTZXJ2ZXJzKHNlbGVjdGVkQWdlbnQsIHNlcnZlcnNXaXRoVG9vbHMpKSB7XG4gICAgICAgIGNvbnN0IG1pc3NpbmcgPSByZXF1aXJlZE1jcFNlcnZlcnMuZmlsdGVyKFxuICAgICAgICAgIHBhdHRlcm4gPT5cbiAgICAgICAgICAgICFzZXJ2ZXJzV2l0aFRvb2xzLnNvbWUoc2VydmVyID0+XG4gICAgICAgICAgICAgIHNlcnZlci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHBhdHRlcm4udG9Mb3dlckNhc2UoKSksXG4gICAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQWdlbnQgJyR7c2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGV9JyByZXF1aXJlcyBNQ1Agc2VydmVycyBtYXRjaGluZzogJHttaXNzaW5nLmpvaW4oJywgJyl9LiBgICtcbiAgICAgICAgICAgIGBNQ1Agc2VydmVycyB3aXRoIHRvb2xzOiAke3NlcnZlcnNXaXRoVG9vbHMubGVuZ3RoID4gMCA/IHNlcnZlcnNXaXRoVG9vbHMuam9pbignLCAnKSA6ICdub25lJ30uIGAgK1xuICAgICAgICAgICAgYFVzZSAvbWNwIHRvIGNvbmZpZ3VyZSBhbmQgYXV0aGVudGljYXRlIHRoZSByZXF1aXJlZCBNQ1Agc2VydmVycy5gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSW5pdGlhbGl6ZSB0aGUgY29sb3IgZm9yIHRoaXMgYWdlbnQgaWYgaXQgaGFzIGEgcHJlZGVmaW5lZCBvbmVcbiAgICBpZiAoc2VsZWN0ZWRBZ2VudC5jb2xvcikge1xuICAgICAgc2V0QWdlbnRDb2xvcihzZWxlY3RlZEFnZW50LmFnZW50VHlwZSwgc2VsZWN0ZWRBZ2VudC5jb2xvcilcbiAgICB9XG5cbiAgICAvLyBSZXNvbHZlIGFnZW50IHBhcmFtcyBmb3IgbG9nZ2luZyAodGhlc2UgYXJlIGFscmVhZHkgcmVzb2x2ZWQgaW4gcnVuQWdlbnQpXG4gICAgY29uc3QgcmVzb2x2ZWRBZ2VudE1vZGVsID0gZ2V0QWdlbnRNb2RlbChcbiAgICAgIHNlbGVjdGVkQWdlbnQubW9kZWwsXG4gICAgICB0b29sVXNlQ29udGV4dC5vcHRpb25zLm1haW5Mb29wTW9kZWwsXG4gICAgICBpc0ZvcmtQYXRoID8gdW5kZWZpbmVkIDogbW9kZWwsXG4gICAgICBwZXJtaXNzaW9uTW9kZSxcbiAgICApXG5cbiAgICBsb2dFdmVudCgndGVuZ3VfYWdlbnRfdG9vbF9zZWxlY3RlZCcsIHtcbiAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgIHNlbGVjdGVkQWdlbnQuYWdlbnRUeXBlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBtb2RlbDpcbiAgICAgICAgcmVzb2x2ZWRBZ2VudE1vZGVsIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBzb3VyY2U6XG4gICAgICAgIHNlbGVjdGVkQWdlbnQuc291cmNlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICBjb2xvcjpcbiAgICAgICAgc2VsZWN0ZWRBZ2VudC5jb2xvciBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgaXNfYnVpbHRfaW5fYWdlbnQ6IGlzQnVpbHRJbkFnZW50KHNlbGVjdGVkQWdlbnQpLFxuICAgICAgaXNfcmVzdW1lOiBmYWxzZSxcbiAgICAgIGlzX2FzeW5jOlxuICAgICAgICAocnVuX2luX2JhY2tncm91bmQgPT09IHRydWUgfHwgc2VsZWN0ZWRBZ2VudC5iYWNrZ3JvdW5kID09PSB0cnVlKSAmJlxuICAgICAgICAhaXNCYWNrZ3JvdW5kVGFza3NEaXNhYmxlZCxcbiAgICAgIGlzX2Zvcms6IGlzRm9ya1BhdGgsXG4gICAgfSlcblxuICAgIC8vIFJlc29sdmUgZWZmZWN0aXZlIGlzb2xhdGlvbiBtb2RlIChleHBsaWNpdCBwYXJhbSBvdmVycmlkZXMgYWdlbnQgZGVmKVxuICAgIGNvbnN0IGVmZmVjdGl2ZUlzb2xhdGlvbiA9IGlzb2xhdGlvbiA/PyBzZWxlY3RlZEFnZW50Lmlzb2xhdGlvblxuXG4gICAgLy8gUmVtb3RlIGlzb2xhdGlvbjogZGVsZWdhdGUgdG8gQ0NSLiBHYXRlZCBhbnQtb25seSDigJQgdGhlIGd1YXJkIGVuYWJsZXNcbiAgICAvLyBkZWFkIGNvZGUgZWxpbWluYXRpb24gb2YgdGhlIGVudGlyZSBibG9jayBmb3IgZXh0ZXJuYWwgYnVpbGRzLlxuICAgIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGVmZmVjdGl2ZUlzb2xhdGlvbiA9PT0gJ3JlbW90ZScpIHtcbiAgICAgIGNvbnN0IGVsaWdpYmlsaXR5ID0gYXdhaXQgY2hlY2tSZW1vdGVBZ2VudEVsaWdpYmlsaXR5KClcbiAgICAgIGlmICghZWxpZ2liaWxpdHkuZWxpZ2libGUpIHtcbiAgICAgICAgY29uc3QgcmVhc29ucyA9IGVsaWdpYmlsaXR5LmVycm9yc1xuICAgICAgICAgIC5tYXAoZm9ybWF0UHJlY29uZGl0aW9uRXJyb3IpXG4gICAgICAgICAgLmpvaW4oJ1xcbicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IGxhdW5jaCByZW1vdGUgYWdlbnQ6XFxuJHtyZWFzb25zfWApXG4gICAgICB9XG5cbiAgICAgIGxldCBidW5kbGVGYWlsSGludDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICBjb25zdCBzZXNzaW9uID0gYXdhaXQgdGVsZXBvcnRUb1JlbW90ZSh7XG4gICAgICAgIGluaXRpYWxNZXNzYWdlOiBwcm9tcHQsXG4gICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICBzaWduYWw6IHRvb2xVc2VDb250ZXh0LmFib3J0Q29udHJvbGxlci5zaWduYWwsXG4gICAgICAgIG9uQnVuZGxlRmFpbDogbXNnID0+IHtcbiAgICAgICAgICBidW5kbGVGYWlsSGludCA9IG1zZ1xuICAgICAgICB9LFxuICAgICAgfSlcbiAgICAgIGlmICghc2Vzc2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYnVuZGxlRmFpbEhpbnQgPz8gJ0ZhaWxlZCB0byBjcmVhdGUgcmVtb3RlIHNlc3Npb24nKVxuICAgICAgfVxuXG4gICAgICBjb25zdCB7IHRhc2tJZCwgc2Vzc2lvbklkIH0gPSByZWdpc3RlclJlbW90ZUFnZW50VGFzayh7XG4gICAgICAgIHJlbW90ZVRhc2tUeXBlOiAncmVtb3RlLWFnZW50JyxcbiAgICAgICAgc2Vzc2lvbjogeyBpZDogc2Vzc2lvbi5pZCwgdGl0bGU6IHNlc3Npb24udGl0bGUgfHwgZGVzY3JpcHRpb24gfSxcbiAgICAgICAgY29tbWFuZDogcHJvbXB0LFxuICAgICAgICBjb250ZXh0OiB0b29sVXNlQ29udGV4dCxcbiAgICAgICAgdG9vbFVzZUlkOiB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICB9KVxuXG4gICAgICBsb2dFdmVudCgndGVuZ3VfYWdlbnRfdG9vbF9yZW1vdGVfbGF1bmNoZWQnLCB7XG4gICAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgICAgc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG5cbiAgICAgIGNvbnN0IHJlbW90ZVJlc3VsdDogUmVtb3RlTGF1bmNoZWRPdXRwdXQgPSB7XG4gICAgICAgIHN0YXR1czogJ3JlbW90ZV9sYXVuY2hlZCcsXG4gICAgICAgIHRhc2tJZCxcbiAgICAgICAgc2Vzc2lvblVybDogZ2V0UmVtb3RlVGFza1Nlc3Npb25Vcmwoc2Vzc2lvbklkKSxcbiAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgIHByb21wdCxcbiAgICAgICAgb3V0cHV0RmlsZTogZ2V0VGFza091dHB1dFBhdGgodGFza0lkKSxcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IGRhdGE6IHJlbW90ZVJlc3VsdCB9IGFzIHVua25vd24gYXMgeyBkYXRhOiBPdXRwdXQgfVxuICAgIH1cbiAgICAvLyBTeXN0ZW0gcHJvbXB0ICsgcHJvbXB0IG1lc3NhZ2VzOiBicmFuY2ggb24gZm9yayBwYXRoLlxuICAgIC8vXG4gICAgLy8gRm9yayBwYXRoOiBjaGlsZCBpbmhlcml0cyB0aGUgUEFSRU5UJ3Mgc3lzdGVtIHByb21wdCAobm90IEZPUktfQUdFTlQncylcbiAgICAvLyBmb3IgY2FjaGUtaWRlbnRpY2FsIEFQSSByZXF1ZXN0IHByZWZpeGVzLiBQcm9tcHQgbWVzc2FnZXMgYXJlIGJ1aWx0IHZpYVxuICAgIC8vIGJ1aWxkRm9ya2VkTWVzc2FnZXMoKSB3aGljaCBjbG9uZXMgdGhlIHBhcmVudCdzIGZ1bGwgYXNzaXN0YW50IG1lc3NhZ2VcbiAgICAvLyAoYWxsIHRvb2xfdXNlIGJsb2NrcykgKyBwbGFjZWhvbGRlciB0b29sX3Jlc3VsdHMgKyBwZXItY2hpbGQgZGlyZWN0aXZlLlxuICAgIC8vXG4gICAgLy8gTm9ybWFsIHBhdGg6IGJ1aWxkIHRoZSBzZWxlY3RlZCBhZ2VudCdzIG93biBzeXN0ZW0gcHJvbXB0IHdpdGggZW52XG4gICAgLy8gZGV0YWlscywgYW5kIHVzZSBhIHNpbXBsZSB1c2VyIG1lc3NhZ2UgZm9yIHRoZSBwcm9tcHQuXG4gICAgbGV0IGVuaGFuY2VkU3lzdGVtUHJvbXB0OiBzdHJpbmdbXSB8IHVuZGVmaW5lZFxuICAgIGxldCBmb3JrUGFyZW50U3lzdGVtUHJvbXB0OlxuICAgICAgfCBSZXR1cm5UeXBlPHR5cGVvZiBidWlsZEVmZmVjdGl2ZVN5c3RlbVByb21wdD5cbiAgICAgIHwgdW5kZWZpbmVkXG4gICAgbGV0IHByb21wdE1lc3NhZ2VzOiBNZXNzYWdlVHlwZVtdXG5cbiAgICBpZiAoaXNGb3JrUGF0aCkge1xuICAgICAgaWYgKHRvb2xVc2VDb250ZXh0LnJlbmRlcmVkU3lzdGVtUHJvbXB0KSB7XG4gICAgICAgIGZvcmtQYXJlbnRTeXN0ZW1Qcm9tcHQgPSB0b29sVXNlQ29udGV4dC5yZW5kZXJlZFN5c3RlbVByb21wdFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gRmFsbGJhY2s6IHJlY29tcHV0ZS4gTWF5IGRpdmVyZ2UgZnJvbSBwYXJlbnQncyBjYWNoZWQgYnl0ZXMgaWZcbiAgICAgICAgLy8gR3Jvd3RoQm9vayBzdGF0ZSBjaGFuZ2VkIGJldHdlZW4gcGFyZW50IHR1cm4tc3RhcnQgYW5kIGZvcmsgc3Bhd24uXG4gICAgICAgIGNvbnN0IG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24gPSBhcHBTdGF0ZS5hZ2VudFxuICAgICAgICAgID8gYXBwU3RhdGUuYWdlbnREZWZpbml0aW9ucy5hY3RpdmVBZ2VudHMuZmluZChcbiAgICAgICAgICAgICAgYSA9PiBhLmFnZW50VHlwZSA9PT0gYXBwU3RhdGUuYWdlbnQsXG4gICAgICAgICAgICApXG4gICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgY29uc3QgYWRkaXRpb25hbFdvcmtpbmdEaXJlY3RvcmllcyA9IEFycmF5LmZyb20oXG4gICAgICAgICAgYXBwU3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0LmFkZGl0aW9uYWxXb3JraW5nRGlyZWN0b3JpZXMua2V5cygpLFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IGRlZmF1bHRTeXN0ZW1Qcm9tcHQgPSBhd2FpdCBnZXRTeXN0ZW1Qcm9tcHQoXG4gICAgICAgICAgdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scyxcbiAgICAgICAgICB0b29sVXNlQ29udGV4dC5vcHRpb25zLm1haW5Mb29wTW9kZWwsXG4gICAgICAgICAgYWRkaXRpb25hbFdvcmtpbmdEaXJlY3RvcmllcyxcbiAgICAgICAgICB0b29sVXNlQ29udGV4dC5vcHRpb25zLm1jcENsaWVudHMsXG4gICAgICAgIClcbiAgICAgICAgZm9ya1BhcmVudFN5c3RlbVByb21wdCA9IGJ1aWxkRWZmZWN0aXZlU3lzdGVtUHJvbXB0KHtcbiAgICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLFxuICAgICAgICAgIHRvb2xVc2VDb250ZXh0LFxuICAgICAgICAgIGN1c3RvbVN5c3RlbVByb21wdDogdG9vbFVzZUNvbnRleHQub3B0aW9ucy5jdXN0b21TeXN0ZW1Qcm9tcHQsXG4gICAgICAgICAgZGVmYXVsdFN5c3RlbVByb21wdCxcbiAgICAgICAgICBhcHBlbmRTeXN0ZW1Qcm9tcHQ6IHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMuYXBwZW5kU3lzdGVtUHJvbXB0LFxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgcHJvbXB0TWVzc2FnZXMgPSBidWlsZEZvcmtlZE1lc3NhZ2VzKHByb21wdCwgYXNzaXN0YW50TWVzc2FnZSlcbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWRkaXRpb25hbFdvcmtpbmdEaXJlY3RvcmllcyA9IEFycmF5LmZyb20oXG4gICAgICAgICAgYXBwU3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0LmFkZGl0aW9uYWxXb3JraW5nRGlyZWN0b3JpZXMua2V5cygpLFxuICAgICAgICApXG5cbiAgICAgICAgLy8gQWxsIGFnZW50cyBoYXZlIGdldFN5c3RlbVByb21wdCAtIHBhc3MgdG9vbFVzZUNvbnRleHQgdG8gYWxsXG4gICAgICAgIGNvbnN0IGFnZW50UHJvbXB0ID0gc2VsZWN0ZWRBZ2VudC5nZXRTeXN0ZW1Qcm9tcHQoeyB0b29sVXNlQ29udGV4dCB9KVxuXG4gICAgICAgIC8vIExvZyBhZ2VudCBtZW1vcnkgbG9hZGVkIGV2ZW50IGZvciBzdWJhZ2VudHNcbiAgICAgICAgaWYgKHNlbGVjdGVkQWdlbnQubWVtb3J5KSB7XG4gICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2FnZW50X21lbW9yeV9sb2FkZWQnLCB7XG4gICAgICAgICAgICAuLi4oXCJleHRlcm5hbFwiID09PSAnYW50JyAmJiB7XG4gICAgICAgICAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgICAgICAgICAgc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgc2NvcGU6XG4gICAgICAgICAgICAgIHNlbGVjdGVkQWdlbnQubWVtb3J5IGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICBzb3VyY2U6XG4gICAgICAgICAgICAgICdzdWJhZ2VudCcgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gQXBwbHkgZW52aXJvbm1lbnQgZGV0YWlscyBlbmhhbmNlbWVudFxuICAgICAgICBlbmhhbmNlZFN5c3RlbVByb21wdCA9IGF3YWl0IGVuaGFuY2VTeXN0ZW1Qcm9tcHRXaXRoRW52RGV0YWlscyhcbiAgICAgICAgICBbYWdlbnRQcm9tcHRdLFxuICAgICAgICAgIHJlc29sdmVkQWdlbnRNb2RlbCxcbiAgICAgICAgICBhZGRpdGlvbmFsV29ya2luZ0RpcmVjdG9yaWVzLFxuICAgICAgICApXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgICAgICAgYEZhaWxlZCB0byBnZXQgc3lzdGVtIHByb21wdCBmb3IgYWdlbnQgJHtzZWxlY3RlZEFnZW50LmFnZW50VHlwZX06ICR7ZXJyb3JNZXNzYWdlKGVycm9yKX1gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBwcm9tcHRNZXNzYWdlcyA9IFtjcmVhdGVVc2VyTWVzc2FnZSh7IGNvbnRlbnQ6IHByb21wdCB9KV1cbiAgICB9XG5cbiAgICBjb25zdCBtZXRhZGF0YSA9IHtcbiAgICAgIHByb21wdCxcbiAgICAgIHJlc29sdmVkQWdlbnRNb2RlbCxcbiAgICAgIGlzQnVpbHRJbkFnZW50OiBpc0J1aWx0SW5BZ2VudChzZWxlY3RlZEFnZW50KSxcbiAgICAgIHN0YXJ0VGltZSxcbiAgICAgIGFnZW50VHlwZTogc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUsXG4gICAgICBpc0FzeW5jOlxuICAgICAgICAocnVuX2luX2JhY2tncm91bmQgPT09IHRydWUgfHwgc2VsZWN0ZWRBZ2VudC5iYWNrZ3JvdW5kID09PSB0cnVlKSAmJlxuICAgICAgICAhaXNCYWNrZ3JvdW5kVGFza3NEaXNhYmxlZCxcbiAgICB9XG5cbiAgICAvLyBVc2UgaW5saW5lIGVudiBjaGVjayBpbnN0ZWFkIG9mIGNvb3JkaW5hdG9yTW9kdWxlIHRvIGF2b2lkIGNpcmN1bGFyXG4gICAgLy8gZGVwZW5kZW5jeSBpc3N1ZXMgZHVyaW5nIHRlc3QgbW9kdWxlIGxvYWRpbmcuXG4gICAgY29uc3QgaXNDb29yZGluYXRvciA9IGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKVxuICAgICAgPyBpc0VudlRydXRoeShwcm9jZXNzLmVudi5DTEFVREVfQ09ERV9DT09SRElOQVRPUl9NT0RFKVxuICAgICAgOiBmYWxzZVxuXG4gICAgLy8gRm9yayBzdWJhZ2VudCBleHBlcmltZW50OiBmb3JjZSBBTEwgc3Bhd25zIGFzeW5jIGZvciBhIHVuaWZpZWRcbiAgICAvLyA8dGFzay1ub3RpZmljYXRpb24+IGludGVyYWN0aW9uIG1vZGVsIChub3QganVzdCBmb3JrIHNwYXducyDigJQgYWxsIG9mIHRoZW0pLlxuICAgIGNvbnN0IGZvcmNlQXN5bmMgPSBpc0ZvcmtTdWJhZ2VudEVuYWJsZWQoKVxuXG4gICAgLy8gQXNzaXN0YW50IG1vZGU6IGZvcmNlIGFsbCBhZ2VudHMgYXN5bmMuIFN5bmNocm9ub3VzIHN1YmFnZW50cyBob2xkIHRoZVxuICAgIC8vIG1haW4gbG9vcCdzIHR1cm4gb3BlbiB1bnRpbCB0aGV5IGNvbXBsZXRlIOKAlCB0aGUgZGFlbW9uJ3MgaW5wdXRRdWV1ZVxuICAgIC8vIGJhY2tzIHVwLCBhbmQgdGhlIGZpcnN0IG92ZXJkdWUgY3JvbiBjYXRjaC11cCBvbiBzcGF3biBiZWNvbWVzIE5cbiAgICAvLyBzZXJpYWwgc3ViYWdlbnQgdHVybnMgYmxvY2tpbmcgYWxsIHVzZXIgaW5wdXQuIFNhbWUgZ2F0ZSBhc1xuICAgIC8vIGV4ZWN1dGVGb3JrZWRTbGFzaENvbW1hbmQncyBmaXJlLWFuZC1mb3JnZXQgcGF0aDsgdGhlXG4gICAgLy8gPHRhc2stbm90aWZpY2F0aW9uPiByZS1lbnRyeSB0aGVyZSBpcyBoYW5kbGVkIGJ5IHRoZSBlbHNlIGJyYW5jaFxuICAgIC8vIGJlbG93IChyZWdpc3RlckFzeW5jQWdlbnRUYXNrICsgbm90aWZ5T25Db21wbGV0aW9uKS5cbiAgICBjb25zdCBhc3Npc3RhbnRGb3JjZUFzeW5jID0gZmVhdHVyZSgnS0FJUk9TJylcbiAgICAgID8gYXBwU3RhdGUua2Fpcm9zRW5hYmxlZFxuICAgICAgOiBmYWxzZVxuXG4gICAgY29uc3Qgc2hvdWxkUnVuQXN5bmMgPVxuICAgICAgKHJ1bl9pbl9iYWNrZ3JvdW5kID09PSB0cnVlIHx8XG4gICAgICAgIHNlbGVjdGVkQWdlbnQuYmFja2dyb3VuZCA9PT0gdHJ1ZSB8fFxuICAgICAgICBpc0Nvb3JkaW5hdG9yIHx8XG4gICAgICAgIGZvcmNlQXN5bmMgfHxcbiAgICAgICAgYXNzaXN0YW50Rm9yY2VBc3luYyB8fFxuICAgICAgICAocHJvYWN0aXZlTW9kdWxlPy5pc1Byb2FjdGl2ZUFjdGl2ZSgpID8/IGZhbHNlKSkgJiZcbiAgICAgICFpc0JhY2tncm91bmRUYXNrc0Rpc2FibGVkXG4gICAgLy8gQXNzZW1ibGUgdGhlIHdvcmtlcidzIHRvb2wgcG9vbCBpbmRlcGVuZGVudGx5IG9mIHRoZSBwYXJlbnQncy5cbiAgICAvLyBXb3JrZXJzIGFsd2F5cyBnZXQgdGhlaXIgdG9vbHMgZnJvbSBhc3NlbWJsZVRvb2xQb29sIHdpdGggdGhlaXIgb3duXG4gICAgLy8gcGVybWlzc2lvbiBtb2RlLCBzbyB0aGV5IGFyZW4ndCBhZmZlY3RlZCBieSB0aGUgcGFyZW50J3MgdG9vbFxuICAgIC8vIHJlc3RyaWN0aW9ucy4gVGhpcyBpcyBjb21wdXRlZCBoZXJlIHNvIHRoYXQgcnVuQWdlbnQgZG9lc24ndCBuZWVkIHRvXG4gICAgLy8gaW1wb3J0IGZyb20gdG9vbHMudHMgKHdoaWNoIHdvdWxkIGNyZWF0ZSBhIGNpcmN1bGFyIGRlcGVuZGVuY3kpLlxuICAgIGNvbnN0IHdvcmtlclBlcm1pc3Npb25Db250ZXh0ID0ge1xuICAgICAgLi4uYXBwU3RhdGUudG9vbFBlcm1pc3Npb25Db250ZXh0LFxuICAgICAgbW9kZTogc2VsZWN0ZWRBZ2VudC5wZXJtaXNzaW9uTW9kZSA/PyAnYWNjZXB0RWRpdHMnLFxuICAgIH1cbiAgICBjb25zdCB3b3JrZXJUb29scyA9IGFzc2VtYmxlVG9vbFBvb2woXG4gICAgICB3b3JrZXJQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgIGFwcFN0YXRlLm1jcC50b29scyxcbiAgICApXG5cbiAgICAvLyBDcmVhdGUgYSBzdGFibGUgYWdlbnQgSUQgZWFybHkgc28gaXQgY2FuIGJlIHVzZWQgZm9yIHdvcmt0cmVlIHNsdWdcbiAgICBjb25zdCBlYXJseUFnZW50SWQgPSBjcmVhdGVBZ2VudElkKClcblxuICAgIC8vIFNldCB1cCB3b3JrdHJlZSBpc29sYXRpb24gaWYgcmVxdWVzdGVkXG4gICAgbGV0IHdvcmt0cmVlSW5mbzoge1xuICAgICAgd29ya3RyZWVQYXRoOiBzdHJpbmdcbiAgICAgIHdvcmt0cmVlQnJhbmNoPzogc3RyaW5nXG4gICAgICBoZWFkQ29tbWl0Pzogc3RyaW5nXG4gICAgICBnaXRSb290Pzogc3RyaW5nXG4gICAgICBob29rQmFzZWQ/OiBib29sZWFuXG4gICAgfSB8IG51bGwgPSBudWxsXG5cbiAgICBpZiAoZWZmZWN0aXZlSXNvbGF0aW9uID09PSAnd29ya3RyZWUnKSB7XG4gICAgICBjb25zdCBzbHVnID0gYGFnZW50LSR7ZWFybHlBZ2VudElkLnNsaWNlKDAsIDgpfWBcbiAgICAgIHdvcmt0cmVlSW5mbyA9IGF3YWl0IGNyZWF0ZUFnZW50V29ya3RyZWUoc2x1ZylcbiAgICB9XG5cbiAgICAvLyBGb3JrICsgd29ya3RyZWU6IGluamVjdCBhIG5vdGljZSB0ZWxsaW5nIHRoZSBjaGlsZCB0byB0cmFuc2xhdGUgcGF0aHNcbiAgICAvLyBhbmQgcmUtcmVhZCBwb3RlbnRpYWxseSBzdGFsZSBmaWxlcy4gQXBwZW5kZWQgYWZ0ZXIgdGhlIGZvcmsgZGlyZWN0aXZlXG4gICAgLy8gc28gaXQgYXBwZWFycyBhcyB0aGUgbW9zdCByZWNlbnQgZ3VpZGFuY2UgdGhlIGNoaWxkIHNlZXMuXG4gICAgaWYgKGlzRm9ya1BhdGggJiYgd29ya3RyZWVJbmZvKSB7XG4gICAgICBwcm9tcHRNZXNzYWdlcy5wdXNoKFxuICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgY29udGVudDogYnVpbGRXb3JrdHJlZU5vdGljZShnZXRDd2QoKSwgd29ya3RyZWVJbmZvLndvcmt0cmVlUGF0aCksXG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgIH1cblxuICAgIGNvbnN0IHJ1bkFnZW50UGFyYW1zOiBQYXJhbWV0ZXJzPHR5cGVvZiBydW5BZ2VudD5bMF0gPSB7XG4gICAgICBhZ2VudERlZmluaXRpb246IHNlbGVjdGVkQWdlbnQsXG4gICAgICBwcm9tcHRNZXNzYWdlcyxcbiAgICAgIHRvb2xVc2VDb250ZXh0LFxuICAgICAgY2FuVXNlVG9vbCxcbiAgICAgIGlzQXN5bmM6IHNob3VsZFJ1bkFzeW5jLFxuICAgICAgcXVlcnlTb3VyY2U6XG4gICAgICAgIHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMucXVlcnlTb3VyY2UgPz9cbiAgICAgICAgZ2V0UXVlcnlTb3VyY2VGb3JBZ2VudChcbiAgICAgICAgICBzZWxlY3RlZEFnZW50LmFnZW50VHlwZSxcbiAgICAgICAgICBpc0J1aWx0SW5BZ2VudChzZWxlY3RlZEFnZW50KSxcbiAgICAgICAgKSxcbiAgICAgIG1vZGVsOiBpc0ZvcmtQYXRoID8gdW5kZWZpbmVkIDogbW9kZWwsXG4gICAgICAvLyBGb3JrIHBhdGg6IHBhc3MgcGFyZW50J3Mgc3lzdGVtIHByb21wdCBBTkQgcGFyZW50J3MgZXhhY3QgdG9vbFxuICAgICAgLy8gYXJyYXkgKGNhY2hlLWlkZW50aWNhbCBwcmVmaXgpLiB3b3JrZXJUb29scyBpcyByZWJ1aWx0IHVuZGVyXG4gICAgICAvLyBwZXJtaXNzaW9uTW9kZSAnYnViYmxlJyB3aGljaCBkaWZmZXJzIGZyb20gdGhlIHBhcmVudCdzIG1vZGUsIHNvXG4gICAgICAvLyBpdHMgdG9vbC1kZWYgc2VyaWFsaXphdGlvbiBkaXZlcmdlcyBhbmQgYnJlYWtzIGNhY2hlIGF0IHRoZSBmaXJzdFxuICAgICAgLy8gZGlmZmVyaW5nIHRvb2wuIHVzZUV4YWN0VG9vbHMgYWxzbyBpbmhlcml0cyB0aGUgcGFyZW50J3NcbiAgICAgIC8vIHRoaW5raW5nQ29uZmlnIGFuZCBpc05vbkludGVyYWN0aXZlU2Vzc2lvbiAoc2VlIHJ1bkFnZW50LnRzKS5cbiAgICAgIC8vXG4gICAgICAvLyBOb3JtYWwgcGF0aDogd2hlbiBhIGN3ZCBvdmVycmlkZSBpcyBpbiBlZmZlY3QgKHdvcmt0cmVlIGlzb2xhdGlvblxuICAgICAgLy8gb3IgZXhwbGljaXQgY3dkKSwgc2tpcCB0aGUgcHJlLWJ1aWx0IHN5c3RlbSBwcm9tcHQgc28gcnVuQWdlbnQnc1xuICAgICAgLy8gYnVpbGRBZ2VudFN5c3RlbVByb21wdCgpIHJ1bnMgaW5zaWRlIHdyYXBXaXRoQ3dkIHdoZXJlIGdldEN3ZCgpXG4gICAgICAvLyByZXR1cm5zIHRoZSBvdmVycmlkZSBwYXRoLlxuICAgICAgb3ZlcnJpZGU6IGlzRm9ya1BhdGhcbiAgICAgICAgPyB7IHN5c3RlbVByb21wdDogZm9ya1BhcmVudFN5c3RlbVByb21wdCB9XG4gICAgICAgIDogZW5oYW5jZWRTeXN0ZW1Qcm9tcHQgJiYgIXdvcmt0cmVlSW5mbyAmJiAhY3dkXG4gICAgICAgICAgPyB7IHN5c3RlbVByb21wdDogYXNTeXN0ZW1Qcm9tcHQoZW5oYW5jZWRTeXN0ZW1Qcm9tcHQpIH1cbiAgICAgICAgICA6IHVuZGVmaW5lZCxcbiAgICAgIGF2YWlsYWJsZVRvb2xzOiBpc0ZvcmtQYXRoID8gdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scyA6IHdvcmtlclRvb2xzLFxuICAgICAgLy8gUGFzcyBwYXJlbnQgY29udmVyc2F0aW9uIHdoZW4gdGhlIGZvcmstc3ViYWdlbnQgcGF0aCBuZWVkcyBmdWxsXG4gICAgICAvLyBjb250ZXh0LiB1c2VFeGFjdFRvb2xzIGluaGVyaXRzIHRoaW5raW5nQ29uZmlnIChydW5BZ2VudC50czo2MjQpLlxuICAgICAgZm9ya0NvbnRleHRNZXNzYWdlczogaXNGb3JrUGF0aCA/IHRvb2xVc2VDb250ZXh0Lm1lc3NhZ2VzIDogdW5kZWZpbmVkLFxuICAgICAgLi4uKGlzRm9ya1BhdGggJiYgeyB1c2VFeGFjdFRvb2xzOiB0cnVlIH0pLFxuICAgICAgd29ya3RyZWVQYXRoOiB3b3JrdHJlZUluZm8/Lndvcmt0cmVlUGF0aCxcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgIH1cblxuICAgIC8vIEhlbHBlciB0byB3cmFwIGV4ZWN1dGlvbiB3aXRoIGEgY3dkIG92ZXJyaWRlOiBleHBsaWNpdCBjd2QgYXJnIChLQUlST1MpXG4gICAgLy8gdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHdvcmt0cmVlIGlzb2xhdGlvbiBwYXRoLlxuICAgIGNvbnN0IGN3ZE92ZXJyaWRlUGF0aCA9IGN3ZCA/PyB3b3JrdHJlZUluZm8/Lndvcmt0cmVlUGF0aFxuICAgIGNvbnN0IHdyYXBXaXRoQ3dkID0gPFQsPihmbjogKCkgPT4gVCk6IFQgPT5cbiAgICAgIGN3ZE92ZXJyaWRlUGF0aCA/IHJ1bldpdGhDd2RPdmVycmlkZShjd2RPdmVycmlkZVBhdGgsIGZuKSA6IGZuKClcblxuICAgIC8vIEhlbHBlciB0byBjbGVhbiB1cCB3b3JrdHJlZSBhZnRlciBhZ2VudCBjb21wbGV0ZXNcbiAgICBjb25zdCBjbGVhbnVwV29ya3RyZWVJZk5lZWRlZCA9IGFzeW5jICgpOiBQcm9taXNlPHtcbiAgICAgIHdvcmt0cmVlUGF0aD86IHN0cmluZ1xuICAgICAgd29ya3RyZWVCcmFuY2g/OiBzdHJpbmdcbiAgICB9PiA9PiB7XG4gICAgICBpZiAoIXdvcmt0cmVlSW5mbykgcmV0dXJuIHt9XG4gICAgICBjb25zdCB7IHdvcmt0cmVlUGF0aCwgd29ya3RyZWVCcmFuY2gsIGhlYWRDb21taXQsIGdpdFJvb3QsIGhvb2tCYXNlZCB9ID1cbiAgICAgICAgd29ya3RyZWVJbmZvXG4gICAgICAvLyBOdWxsIG91dCB0byBtYWtlIGlkZW1wb3RlbnQg4oCUIGd1YXJkcyBhZ2FpbnN0IGRvdWJsZS1jYWxsIGlmIGNvZGVcbiAgICAgIC8vIGJldHdlZW4gY2xlYW51cCBhbmQgZW5kIG9mIHRyeSB0aHJvd3MgaW50byBjYXRjaFxuICAgICAgd29ya3RyZWVJbmZvID0gbnVsbFxuICAgICAgaWYgKGhvb2tCYXNlZCkge1xuICAgICAgICAvLyBIb29rLWJhc2VkIHdvcmt0cmVlcyBhcmUgYWx3YXlzIGtlcHQgc2luY2Ugd2UgY2FuJ3QgZGV0ZWN0IFZDUyBjaGFuZ2VzXG4gICAgICAgIGxvZ0ZvckRlYnVnZ2luZyhgSG9vay1iYXNlZCBhZ2VudCB3b3JrdHJlZSBrZXB0IGF0OiAke3dvcmt0cmVlUGF0aH1gKVxuICAgICAgICByZXR1cm4geyB3b3JrdHJlZVBhdGggfVxuICAgICAgfVxuICAgICAgaWYgKGhlYWRDb21taXQpIHtcbiAgICAgICAgY29uc3QgY2hhbmdlZCA9IGF3YWl0IGhhc1dvcmt0cmVlQ2hhbmdlcyh3b3JrdHJlZVBhdGgsIGhlYWRDb21taXQpXG4gICAgICAgIGlmICghY2hhbmdlZCkge1xuICAgICAgICAgIGF3YWl0IHJlbW92ZUFnZW50V29ya3RyZWUod29ya3RyZWVQYXRoLCB3b3JrdHJlZUJyYW5jaCwgZ2l0Um9vdClcbiAgICAgICAgICAvLyBDbGVhciB3b3JrdHJlZVBhdGggZnJvbSBtZXRhZGF0YSBzbyByZXN1bWUgZG9lc24ndCB0cnkgdG8gdXNlXG4gICAgICAgICAgLy8gYSBkZWxldGVkIGRpcmVjdG9yeS4gRmlyZS1hbmQtZm9yZ2V0IHRvIG1hdGNoIHJ1bkFnZW50J3NcbiAgICAgICAgICAvLyB3cml0ZUFnZW50TWV0YWRhdGEgaGFuZGxpbmcuXG4gICAgICAgICAgdm9pZCB3cml0ZUFnZW50TWV0YWRhdGEoYXNBZ2VudElkKGVhcmx5QWdlbnRJZCksIHtcbiAgICAgICAgICAgIGFnZW50VHlwZTogc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICB9KS5jYXRjaChfZXJyID0+XG4gICAgICAgICAgICBsb2dGb3JEZWJ1Z2dpbmcoYEZhaWxlZCB0byBjbGVhciB3b3JrdHJlZSBtZXRhZGF0YTogJHtfZXJyfWApLFxuICAgICAgICAgIClcbiAgICAgICAgICByZXR1cm4ge31cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbG9nRm9yRGVidWdnaW5nKGBBZ2VudCB3b3JrdHJlZSBoYXMgY2hhbmdlcywga2VlcGluZzogJHt3b3JrdHJlZVBhdGh9YClcbiAgICAgIHJldHVybiB7IHdvcmt0cmVlUGF0aCwgd29ya3RyZWVCcmFuY2ggfVxuICAgIH1cblxuICAgIGlmIChzaG91bGRSdW5Bc3luYykge1xuICAgICAgY29uc3QgYXN5bmNBZ2VudElkID0gZWFybHlBZ2VudElkXG4gICAgICBjb25zdCBhZ2VudEJhY2tncm91bmRUYXNrID0gcmVnaXN0ZXJBc3luY0FnZW50KHtcbiAgICAgICAgYWdlbnRJZDogYXN5bmNBZ2VudElkLFxuICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgcHJvbXB0LFxuICAgICAgICBzZWxlY3RlZEFnZW50LFxuICAgICAgICBzZXRBcHBTdGF0ZTogcm9vdFNldEFwcFN0YXRlLFxuICAgICAgICAvLyBEb24ndCBsaW5rIHRvIHBhcmVudCdzIGFib3J0IGNvbnRyb2xsZXIgLS0gYmFja2dyb3VuZCBhZ2VudHMgc2hvdWxkXG4gICAgICAgIC8vIHN1cnZpdmUgd2hlbiB0aGUgdXNlciBwcmVzc2VzIEVTQyB0byBjYW5jZWwgdGhlIG1haW4gdGhyZWFkLlxuICAgICAgICAvLyBUaGV5IGFyZSBraWxsZWQgZXhwbGljaXRseSB2aWEgY2hhdDpraWxsQWdlbnRzLlxuICAgICAgICB0b29sVXNlSWQ6IHRvb2xVc2VDb250ZXh0LnRvb2xVc2VJZCxcbiAgICAgIH0pXG5cbiAgICAgIC8vIFJlZ2lzdGVyIG5hbWUg4oaSIGFnZW50SWQgZm9yIFNlbmRNZXNzYWdlIHJvdXRpbmcuIFBvc3QtcmVnaXN0ZXJBc3luY0FnZW50XG4gICAgICAvLyBzbyB3ZSBkb24ndCBsZWF2ZSBhIHN0YWxlIGVudHJ5IGlmIHNwYXduIGZhaWxzLiBTeW5jIGFnZW50cyBza2lwcGVkIOKAlFxuICAgICAgLy8gY29vcmRpbmF0b3IgaXMgYmxvY2tlZCwgc28gU2VuZE1lc3NhZ2Ugcm91dGluZyBkb2Vzbid0IGFwcGx5LlxuICAgICAgaWYgKG5hbWUpIHtcbiAgICAgICAgcm9vdFNldEFwcFN0YXRlKHByZXYgPT4ge1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYuYWdlbnROYW1lUmVnaXN0cnkpXG4gICAgICAgICAgbmV4dC5zZXQobmFtZSwgYXNBZ2VudElkKGFzeW5jQWdlbnRJZCkpXG4gICAgICAgICAgcmV0dXJuIHsgLi4ucHJldiwgYWdlbnROYW1lUmVnaXN0cnk6IG5leHQgfVxuICAgICAgICB9KVxuICAgICAgfVxuXG4gICAgICAvLyBXcmFwIGFzeW5jIGFnZW50IGV4ZWN1dGlvbiBpbiBhZ2VudCBjb250ZXh0IGZvciBhbmFseXRpY3MgYXR0cmlidXRpb25cbiAgICAgIGNvbnN0IGFzeW5jQWdlbnRDb250ZXh0ID0ge1xuICAgICAgICBhZ2VudElkOiBhc3luY0FnZW50SWQsXG4gICAgICAgIC8vIEZvciBzdWJhZ2VudHMgZnJvbSB0ZWFtbWF0ZXM6IHVzZSB0ZWFtIGxlYWQncyBzZXNzaW9uXG4gICAgICAgIC8vIEZvciBzdWJhZ2VudHMgZnJvbSBtYWluIFJFUEw6IHVuZGVmaW5lZCAobm8gcGFyZW50IHNlc3Npb24pXG4gICAgICAgIHBhcmVudFNlc3Npb25JZDogZ2V0UGFyZW50U2Vzc2lvbklkKCksXG4gICAgICAgIGFnZW50VHlwZTogJ3N1YmFnZW50JyBhcyBjb25zdCxcbiAgICAgICAgc3ViYWdlbnROYW1lOiBzZWxlY3RlZEFnZW50LmFnZW50VHlwZSxcbiAgICAgICAgaXNCdWlsdEluOiBpc0J1aWx0SW5BZ2VudChzZWxlY3RlZEFnZW50KSxcbiAgICAgICAgaW52b2tpbmdSZXF1ZXN0SWQ6IGFzc2lzdGFudE1lc3NhZ2U/LnJlcXVlc3RJZCxcbiAgICAgICAgaW52b2NhdGlvbktpbmQ6ICdzcGF3bicgYXMgY29uc3QsXG4gICAgICAgIGludm9jYXRpb25FbWl0dGVkOiBmYWxzZSxcbiAgICAgIH1cblxuICAgICAgLy8gV29ya2xvYWQgcHJvcGFnYXRpb246IGhhbmRsZVByb21wdFN1Ym1pdCB3cmFwcyB0aGUgZW50aXJlIHR1cm4gaW5cbiAgICAgIC8vIHJ1bldpdGhXb3JrbG9hZCAoQXN5bmNMb2NhbFN0b3JhZ2UpLiBBTFMgY29udGV4dCBpcyBjYXB0dXJlZCBhdFxuICAgICAgLy8gaW52b2NhdGlvbiB0aW1lIOKAlCB3aGVuIHRoaXMgYHZvaWRgIGZpcmVzIOKAlCBhbmQgc3Vydml2ZXMgZXZlcnkgYXdhaXRcbiAgICAgIC8vIGluc2lkZS4gTm8gY2FwdHVyZS9yZXN0b3JlIG5lZWRlZDsgdGhlIGRldGFjaGVkIGNsb3N1cmUgc2VlcyB0aGVcbiAgICAgIC8vIHBhcmVudCB0dXJuJ3Mgd29ya2xvYWQgYXV0b21hdGljYWxseSwgaXNvbGF0ZWQgZnJvbSBpdHMgZmluYWxseS5cbiAgICAgIHZvaWQgcnVuV2l0aEFnZW50Q29udGV4dChhc3luY0FnZW50Q29udGV4dCwgKCkgPT5cbiAgICAgICAgd3JhcFdpdGhDd2QoKCkgPT5cbiAgICAgICAgICBydW5Bc3luY0FnZW50TGlmZWN5Y2xlKHtcbiAgICAgICAgICAgIHRhc2tJZDogYWdlbnRCYWNrZ3JvdW5kVGFzay5hZ2VudElkLFxuICAgICAgICAgICAgYWJvcnRDb250cm9sbGVyOiBhZ2VudEJhY2tncm91bmRUYXNrLmFib3J0Q29udHJvbGxlciEsXG4gICAgICAgICAgICBtYWtlU3RyZWFtOiBvbkNhY2hlU2FmZVBhcmFtcyA9PlxuICAgICAgICAgICAgICBydW5BZ2VudCh7XG4gICAgICAgICAgICAgICAgLi4ucnVuQWdlbnRQYXJhbXMsXG4gICAgICAgICAgICAgICAgb3ZlcnJpZGU6IHtcbiAgICAgICAgICAgICAgICAgIC4uLnJ1bkFnZW50UGFyYW1zLm92ZXJyaWRlLFxuICAgICAgICAgICAgICAgICAgYWdlbnRJZDogYXNBZ2VudElkKGFnZW50QmFja2dyb3VuZFRhc2suYWdlbnRJZCksXG4gICAgICAgICAgICAgICAgICBhYm9ydENvbnRyb2xsZXI6IGFnZW50QmFja2dyb3VuZFRhc2suYWJvcnRDb250cm9sbGVyISxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIG9uQ2FjaGVTYWZlUGFyYW1zLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIG1ldGFkYXRhLFxuICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICB0b29sVXNlQ29udGV4dCxcbiAgICAgICAgICAgIHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgIGFnZW50SWRGb3JDbGVhbnVwOiBhc3luY0FnZW50SWQsXG4gICAgICAgICAgICBlbmFibGVTdW1tYXJpemF0aW9uOlxuICAgICAgICAgICAgICBpc0Nvb3JkaW5hdG9yIHx8XG4gICAgICAgICAgICAgIGlzRm9ya1N1YmFnZW50RW5hYmxlZCgpIHx8XG4gICAgICAgICAgICAgIGdldFNka0FnZW50UHJvZ3Jlc3NTdW1tYXJpZXNFbmFibGVkKCksXG4gICAgICAgICAgICBnZXRXb3JrdHJlZVJlc3VsdDogY2xlYW51cFdvcmt0cmVlSWZOZWVkZWQsXG4gICAgICAgICAgfSksXG4gICAgICAgICksXG4gICAgICApXG5cbiAgICAgIGNvbnN0IGNhblJlYWRPdXRwdXRGaWxlID0gdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scy5zb21lKFxuICAgICAgICB0ID0+XG4gICAgICAgICAgdG9vbE1hdGNoZXNOYW1lKHQsIEZJTEVfUkVBRF9UT09MX05BTUUpIHx8XG4gICAgICAgICAgdG9vbE1hdGNoZXNOYW1lKHQsIEJBU0hfVE9PTF9OQU1FKSxcbiAgICAgIClcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICBpc0FzeW5jOiB0cnVlIGFzIGNvbnN0LFxuICAgICAgICAgIHN0YXR1czogJ2FzeW5jX2xhdW5jaGVkJyBhcyBjb25zdCxcbiAgICAgICAgICBhZ2VudElkOiBhZ2VudEJhY2tncm91bmRUYXNrLmFnZW50SWQsXG4gICAgICAgICAgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uLFxuICAgICAgICAgIHByb21wdDogcHJvbXB0LFxuICAgICAgICAgIG91dHB1dEZpbGU6IGdldFRhc2tPdXRwdXRQYXRoKGFnZW50QmFja2dyb3VuZFRhc2suYWdlbnRJZCksXG4gICAgICAgICAgY2FuUmVhZE91dHB1dEZpbGUsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENyZWF0ZSBhbiBleHBsaWNpdCBhZ2VudElkIGZvciBzeW5jIGFnZW50c1xuICAgICAgY29uc3Qgc3luY0FnZW50SWQgPSBhc0FnZW50SWQoZWFybHlBZ2VudElkKVxuXG4gICAgICAvLyBTZXQgdXAgYWdlbnQgY29udGV4dCBmb3Igc3luYyBleGVjdXRpb24gKGZvciBhbmFseXRpY3MgYXR0cmlidXRpb24pXG4gICAgICBjb25zdCBzeW5jQWdlbnRDb250ZXh0ID0ge1xuICAgICAgICBhZ2VudElkOiBzeW5jQWdlbnRJZCxcbiAgICAgICAgLy8gRm9yIHN1YmFnZW50cyBmcm9tIHRlYW1tYXRlczogdXNlIHRlYW0gbGVhZCdzIHNlc3Npb25cbiAgICAgICAgLy8gRm9yIHN1YmFnZW50cyBmcm9tIG1haW4gUkVQTDogdW5kZWZpbmVkIChubyBwYXJlbnQgc2Vzc2lvbilcbiAgICAgICAgcGFyZW50U2Vzc2lvbklkOiBnZXRQYXJlbnRTZXNzaW9uSWQoKSxcbiAgICAgICAgYWdlbnRUeXBlOiAnc3ViYWdlbnQnIGFzIGNvbnN0LFxuICAgICAgICBzdWJhZ2VudE5hbWU6IHNlbGVjdGVkQWdlbnQuYWdlbnRUeXBlLFxuICAgICAgICBpc0J1aWx0SW46IGlzQnVpbHRJbkFnZW50KHNlbGVjdGVkQWdlbnQpLFxuICAgICAgICBpbnZva2luZ1JlcXVlc3RJZDogYXNzaXN0YW50TWVzc2FnZT8ucmVxdWVzdElkLFxuICAgICAgICBpbnZvY2F0aW9uS2luZDogJ3NwYXduJyBhcyBjb25zdCxcbiAgICAgICAgaW52b2NhdGlvbkVtaXR0ZWQ6IGZhbHNlLFxuICAgICAgfVxuXG4gICAgICAvLyBXcmFwIGVudGlyZSBzeW5jIGFnZW50IGV4ZWN1dGlvbiBpbiBjb250ZXh0IGZvciBhbmFseXRpY3MgYXR0cmlidXRpb25cbiAgICAgIC8vIGFuZCBvcHRpb25hbGx5IGluIGEgd29ya3RyZWUgY3dkIG92ZXJyaWRlIGZvciBmaWxlc3lzdGVtIGlzb2xhdGlvblxuICAgICAgcmV0dXJuIHJ1bldpdGhBZ2VudENvbnRleHQoc3luY0FnZW50Q29udGV4dCwgKCkgPT5cbiAgICAgICAgd3JhcFdpdGhDd2QoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFnZW50TWVzc2FnZXM6IE1lc3NhZ2VUeXBlW10gPSBbXVxuICAgICAgICAgIGNvbnN0IGFnZW50U3RhcnRUaW1lID0gRGF0ZS5ub3coKVxuICAgICAgICAgIGNvbnN0IHN5bmNUcmFja2VyID0gY3JlYXRlUHJvZ3Jlc3NUcmFja2VyKClcbiAgICAgICAgICBjb25zdCBzeW5jUmVzb2x2ZUFjdGl2aXR5ID0gY3JlYXRlQWN0aXZpdHlEZXNjcmlwdGlvblJlc29sdmVyKFxuICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scyxcbiAgICAgICAgICApXG5cbiAgICAgICAgICAvLyBZaWVsZCBpbml0aWFsIHByb2dyZXNzIG1lc3NhZ2UgdG8gY2FycnkgbWV0YWRhdGEgKHByb21wdClcbiAgICAgICAgICBpZiAocHJvbXB0TWVzc2FnZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFByb21wdE1lc3NhZ2VzID0gbm9ybWFsaXplTWVzc2FnZXMocHJvbXB0TWVzc2FnZXMpXG4gICAgICAgICAgICBjb25zdCBub3JtYWxpemVkRmlyc3RNZXNzYWdlID0gbm9ybWFsaXplZFByb21wdE1lc3NhZ2VzLmZpbmQoXG4gICAgICAgICAgICAgIChtKTogbSBpcyBOb3JtYWxpemVkVXNlck1lc3NhZ2UgPT4gbS50eXBlID09PSAndXNlcicsXG4gICAgICAgICAgICApXG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIG5vcm1hbGl6ZWRGaXJzdE1lc3NhZ2UgJiZcbiAgICAgICAgICAgICAgbm9ybWFsaXplZEZpcnN0TWVzc2FnZS50eXBlID09PSAndXNlcicgJiZcbiAgICAgICAgICAgICAgb25Qcm9ncmVzc1xuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIG9uUHJvZ3Jlc3Moe1xuICAgICAgICAgICAgICAgIHRvb2xVc2VJRDogYGFnZW50XyR7YXNzaXN0YW50TWVzc2FnZS5tZXNzYWdlLmlkfWAsXG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgbWVzc2FnZTogbm9ybWFsaXplZEZpcnN0TWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZ2VudF9wcm9ncmVzcycsXG4gICAgICAgICAgICAgICAgICBwcm9tcHQsXG4gICAgICAgICAgICAgICAgICBhZ2VudElkOiBzeW5jQWdlbnRJZCxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFJlZ2lzdGVyIGFzIGZvcmVncm91bmQgdGFzayBpbW1lZGlhdGVseSBzbyBpdCBjYW4gYmUgYmFja2dyb3VuZGVkIGF0IGFueSB0aW1lXG4gICAgICAgICAgLy8gU2tpcCByZWdpc3RyYXRpb24gaWYgYmFja2dyb3VuZCB0YXNrcyBhcmUgZGlzYWJsZWRcbiAgICAgICAgICBsZXQgZm9yZWdyb3VuZFRhc2tJZDogc3RyaW5nIHwgdW5kZWZpbmVkXG4gICAgICAgICAgLy8gQ3JlYXRlIHRoZSBiYWNrZ3JvdW5kIHJhY2UgcHJvbWlzZSBvbmNlIG91dHNpZGUgdGhlIGxvb3Ag4oCUIG90aGVyd2lzZVxuICAgICAgICAgIC8vIGVhY2ggaXRlcmF0aW9uIGFkZHMgYSBuZXcgLnRoZW4oKSByZWFjdGlvbiB0byB0aGUgc2FtZSBwZW5kaW5nXG4gICAgICAgICAgLy8gcHJvbWlzZSwgYWNjdW11bGF0aW5nIGNhbGxiYWNrcyBmb3IgdGhlIGxpZmV0aW1lIG9mIHRoZSBhZ2VudC5cbiAgICAgICAgICBsZXQgYmFja2dyb3VuZFByb21pc2U6IFByb21pc2U8eyB0eXBlOiAnYmFja2dyb3VuZCcgfT4gfCB1bmRlZmluZWRcbiAgICAgICAgICBsZXQgY2FuY2VsQXV0b0JhY2tncm91bmQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZFxuICAgICAgICAgIGlmICghaXNCYWNrZ3JvdW5kVGFza3NEaXNhYmxlZCkge1xuICAgICAgICAgICAgY29uc3QgcmVnaXN0cmF0aW9uID0gcmVnaXN0ZXJBZ2VudEZvcmVncm91bmQoe1xuICAgICAgICAgICAgICBhZ2VudElkOiBzeW5jQWdlbnRJZCxcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgIHByb21wdCxcbiAgICAgICAgICAgICAgc2VsZWN0ZWRBZ2VudCxcbiAgICAgICAgICAgICAgc2V0QXBwU3RhdGU6IHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgdG9vbFVzZUlkOiB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICAgICAgICAgIGF1dG9CYWNrZ3JvdW5kTXM6IGdldEF1dG9CYWNrZ3JvdW5kTXMoKSB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgZm9yZWdyb3VuZFRhc2tJZCA9IHJlZ2lzdHJhdGlvbi50YXNrSWRcbiAgICAgICAgICAgIGJhY2tncm91bmRQcm9taXNlID0gcmVnaXN0cmF0aW9uLmJhY2tncm91bmRTaWduYWwudGhlbigoKSA9PiAoe1xuICAgICAgICAgICAgICB0eXBlOiAnYmFja2dyb3VuZCcgYXMgY29uc3QsXG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIGNhbmNlbEF1dG9CYWNrZ3JvdW5kID0gcmVnaXN0cmF0aW9uLmNhbmNlbEF1dG9CYWNrZ3JvdW5kXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVHJhY2sgaWYgd2UndmUgc2hvd24gdGhlIGJhY2tncm91bmQgaGludCBVSVxuICAgICAgICAgIGxldCBiYWNrZ3JvdW5kSGludFNob3duID0gZmFsc2VcbiAgICAgICAgICAvLyBUcmFjayBpZiB0aGUgYWdlbnQgd2FzIGJhY2tncm91bmRlZCAoY2xlYW51cCBoYW5kbGVkIGJ5IGJhY2tncm91bmRlZCBmaW5hbGx5KVxuICAgICAgICAgIGxldCB3YXNCYWNrZ3JvdW5kZWQgPSBmYWxzZVxuICAgICAgICAgIC8vIFBlci1zY29wZSBzdG9wIGZ1bmN0aW9uIOKAlCBOT1Qgc2hhcmVkIHdpdGggdGhlIGJhY2tncm91bmRlZCBjbG9zdXJlLlxuICAgICAgICAgIC8vIGlkZW1wb3RlbnQ6IHN0YXJ0QWdlbnRTdW1tYXJpemF0aW9uJ3Mgc3RvcCgpIGNoZWNrcyBgc3RvcHBlZGAgZmxhZy5cbiAgICAgICAgICBsZXQgc3RvcEZvcmVncm91bmRTdW1tYXJpemF0aW9uOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWRcbiAgICAgICAgICAvLyBjb25zdCBjYXB0dXJlIGZvciBzb3VuZCB0eXBlIG5hcnJvd2luZyBpbnNpZGUgdGhlIGNhbGxiYWNrIGJlbG93XG4gICAgICAgICAgY29uc3Qgc3VtbWFyeVRhc2tJZCA9IGZvcmVncm91bmRUYXNrSWRcblxuICAgICAgICAgIC8vIEdldCBhc3luYyBpdGVyYXRvciBmb3IgdGhlIGFnZW50XG4gICAgICAgICAgY29uc3QgYWdlbnRJdGVyYXRvciA9IHJ1bkFnZW50KHtcbiAgICAgICAgICAgIC4uLnJ1bkFnZW50UGFyYW1zLFxuICAgICAgICAgICAgb3ZlcnJpZGU6IHtcbiAgICAgICAgICAgICAgLi4ucnVuQWdlbnRQYXJhbXMub3ZlcnJpZGUsXG4gICAgICAgICAgICAgIGFnZW50SWQ6IHN5bmNBZ2VudElkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIG9uQ2FjaGVTYWZlUGFyYW1zOlxuICAgICAgICAgICAgICBzdW1tYXJ5VGFza0lkICYmIGdldFNka0FnZW50UHJvZ3Jlc3NTdW1tYXJpZXNFbmFibGVkKClcbiAgICAgICAgICAgICAgICA/IChwYXJhbXM6IENhY2hlU2FmZVBhcmFtcykgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0b3AgfSA9IHN0YXJ0QWdlbnRTdW1tYXJpemF0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgIHN1bW1hcnlUYXNrSWQsXG4gICAgICAgICAgICAgICAgICAgICAgc3luY0FnZW50SWQsXG4gICAgICAgICAgICAgICAgICAgICAgcGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICAgIHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICBzdG9wRm9yZWdyb3VuZFN1bW1hcml6YXRpb24gPSBzdG9wXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgfSlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKClcblxuICAgICAgICAgIC8vIFRyYWNrIGlmIGFuIGVycm9yIG9jY3VycmVkIGR1cmluZyBpdGVyYXRpb25cbiAgICAgICAgICBsZXQgc3luY0FnZW50RXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkXG4gICAgICAgICAgbGV0IHdhc0Fib3J0ZWQgPSBmYWxzZVxuICAgICAgICAgIGxldCB3b3JrdHJlZVJlc3VsdDoge1xuICAgICAgICAgICAgd29ya3RyZWVQYXRoPzogc3RyaW5nXG4gICAgICAgICAgICB3b3JrdHJlZUJyYW5jaD86IHN0cmluZ1xuICAgICAgICAgIH0gPSB7fVxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGVsYXBzZWQgPSBEYXRlLm5vdygpIC0gYWdlbnRTdGFydFRpbWVcblxuICAgICAgICAgICAgICAvLyBTaG93IGJhY2tncm91bmQgaGludCBhZnRlciB0aHJlc2hvbGQgKGJ1dCB0YXNrIGlzIGFscmVhZHkgcmVnaXN0ZXJlZClcbiAgICAgICAgICAgICAgLy8gU2tpcCBpZiBiYWNrZ3JvdW5kIHRhc2tzIGFyZSBkaXNhYmxlZFxuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgIWlzQmFja2dyb3VuZFRhc2tzRGlzYWJsZWQgJiZcbiAgICAgICAgICAgICAgICAhYmFja2dyb3VuZEhpbnRTaG93biAmJlxuICAgICAgICAgICAgICAgIGVsYXBzZWQgPj0gUFJPR1JFU1NfVEhSRVNIT0xEX01TICYmXG4gICAgICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQuc2V0VG9vbEpTWFxuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kSGludFNob3duID0gdHJ1ZVxuICAgICAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0LnNldFRvb2xKU1goe1xuICAgICAgICAgICAgICAgICAganN4OiA8QmFja2dyb3VuZEhpbnQgLz4sXG4gICAgICAgICAgICAgICAgICBzaG91bGRIaWRlUHJvbXB0SW5wdXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgc2hvdWxkQ29udGludWVBbmltYXRpb246IHRydWUsXG4gICAgICAgICAgICAgICAgICBzaG93U3Bpbm5lcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gUmFjZSBiZXR3ZWVuIG5leHQgbWVzc2FnZSBhbmQgYmFja2dyb3VuZCBzaWduYWxcbiAgICAgICAgICAgICAgLy8gSWYgYmFja2dyb3VuZCB0YXNrcyBhcmUgZGlzYWJsZWQsIGp1c3QgYXdhaXQgdGhlIG5leHQgbWVzc2FnZSBkaXJlY3RseVxuICAgICAgICAgICAgICBjb25zdCBuZXh0TWVzc2FnZVByb21pc2UgPSBhZ2VudEl0ZXJhdG9yLm5leHQoKVxuICAgICAgICAgICAgICBjb25zdCByYWNlUmVzdWx0ID0gYmFja2dyb3VuZFByb21pc2VcbiAgICAgICAgICAgICAgICA/IGF3YWl0IFByb21pc2UucmFjZShbXG4gICAgICAgICAgICAgICAgICAgIG5leHRNZXNzYWdlUHJvbWlzZS50aGVuKHIgPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnbWVzc2FnZScgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0OiByLFxuICAgICAgICAgICAgICAgICAgICB9KSksXG4gICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRQcm9taXNlLFxuICAgICAgICAgICAgICAgICAgXSlcbiAgICAgICAgICAgICAgICA6IHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ21lc3NhZ2UnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgICAgICByZXN1bHQ6IGF3YWl0IG5leHRNZXNzYWdlUHJvbWlzZSxcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBDaGVjayBpZiB3ZSB3ZXJlIGJhY2tncm91bmRlZCB2aWEgYmFja2dyb3VuZEFsbCgpXG4gICAgICAgICAgICAgIC8vIGZvcmVncm91bmRUYXNrSWQgaXMgZ3VhcmFudGVlZCB0byBiZSBkZWZpbmVkIGlmIHJhY2VSZXN1bHQudHlwZSBpcyAnYmFja2dyb3VuZCdcbiAgICAgICAgICAgICAgLy8gYmVjYXVzZSBiYWNrZ3JvdW5kUHJvbWlzZSBpcyBvbmx5IGRlZmluZWQgd2hlbiBmb3JlZ3JvdW5kVGFza0lkIGlzIGRlZmluZWRcbiAgICAgICAgICAgICAgaWYgKHJhY2VSZXN1bHQudHlwZSA9PT0gJ2JhY2tncm91bmQnICYmIGZvcmVncm91bmRUYXNrSWQpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhcHBTdGF0ZSA9IHRvb2xVc2VDb250ZXh0LmdldEFwcFN0YXRlKClcbiAgICAgICAgICAgICAgICBjb25zdCB0YXNrID0gYXBwU3RhdGUudGFza3NbZm9yZWdyb3VuZFRhc2tJZF1cbiAgICAgICAgICAgICAgICBpZiAoaXNMb2NhbEFnZW50VGFzayh0YXNrKSAmJiB0YXNrLmlzQmFja2dyb3VuZGVkKSB7XG4gICAgICAgICAgICAgICAgICAvLyBDYXB0dXJlIHRoZSB0YXNrSWQgZm9yIHVzZSBpbiB0aGUgYXN5bmMgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGJhY2tncm91bmRlZFRhc2tJZCA9IGZvcmVncm91bmRUYXNrSWRcbiAgICAgICAgICAgICAgICAgIHdhc0JhY2tncm91bmRlZCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIC8vIFN0b3AgZm9yZWdyb3VuZCBzdW1tYXJpemF0aW9uOyB0aGUgYmFja2dyb3VuZGVkIGNsb3N1cmVcbiAgICAgICAgICAgICAgICAgIC8vIGJlbG93IG93bnMgaXRzIG93biBpbmRlcGVuZGVudCBzdG9wIGZ1bmN0aW9uLlxuICAgICAgICAgICAgICAgICAgc3RvcEZvcmVncm91bmRTdW1tYXJpemF0aW9uPy4oKVxuXG4gICAgICAgICAgICAgICAgICAvLyBXb3JrbG9hZDogaW5oZXJpdGVkIHZpYSBBTFMgYXQgYHZvaWRgIGludm9jYXRpb24gdGltZSxcbiAgICAgICAgICAgICAgICAgIC8vIHNhbWUgYXMgdGhlIGFzeW5jLWZyb20tc3RhcnQgcGF0aCBhYm92ZS5cbiAgICAgICAgICAgICAgICAgIC8vIENvbnRpbnVlIGFnZW50IGluIGJhY2tncm91bmQgYW5kIHJldHVybiBhc3luYyByZXN1bHRcbiAgICAgICAgICAgICAgICAgIHZvaWQgcnVuV2l0aEFnZW50Q29udGV4dChzeW5jQWdlbnRDb250ZXh0LCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBzdG9wQmFja2dyb3VuZGVkU3VtbWFyaXphdGlvbjogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgLy8gQ2xlYW4gdXAgdGhlIGZvcmVncm91bmQgaXRlcmF0b3Igc28gaXRzIGZpbmFsbHkgYmxvY2sgcnVuc1xuICAgICAgICAgICAgICAgICAgICAgIC8vIChyZWxlYXNlcyBNQ1AgY29ubmVjdGlvbnMsIHNlc3Npb24gaG9va3MsIHByb21wdCBjYWNoZSB0cmFja2luZywgZXRjLilcbiAgICAgICAgICAgICAgICAgICAgICAvLyBUaW1lb3V0IHByZXZlbnRzIGJsb2NraW5nIGlmIE1DUCBzZXJ2ZXIgY2xlYW51cCBoYW5ncy5cbiAgICAgICAgICAgICAgICAgICAgICAvLyAuY2F0Y2goKSBwcmV2ZW50cyB1bmhhbmRsZWQgcmVqZWN0aW9uIGlmIHRpbWVvdXQgd2lucyB0aGUgcmFjZS5cbiAgICAgICAgICAgICAgICAgICAgICBhd2FpdCBQcm9taXNlLnJhY2UoW1xuICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRJdGVyYXRvci5yZXR1cm4odW5kZWZpbmVkKS5jYXRjaCgoKSA9PiB7fSksXG4gICAgICAgICAgICAgICAgICAgICAgICBzbGVlcCgxMDAwKSxcbiAgICAgICAgICAgICAgICAgICAgICBdKVxuICAgICAgICAgICAgICAgICAgICAgIC8vIEluaXRpYWxpemUgcHJvZ3Jlc3MgdHJhY2tpbmcgZnJvbSBleGlzdGluZyBtZXNzYWdlc1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyYWNrZXIgPSBjcmVhdGVQcm9ncmVzc1RyYWNrZXIoKVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlc29sdmVBY3Rpdml0eTIgPVxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlQWN0aXZpdHlEZXNjcmlwdGlvblJlc29sdmVyKFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlQ29udGV4dC5vcHRpb25zLnRvb2xzLFxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgZXhpc3RpbmdNc2cgb2YgYWdlbnRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlUHJvZ3Jlc3NGcm9tTWVzc2FnZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdHJhY2tlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXhpc3RpbmdNc2csXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVBY3Rpdml0eTIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMudG9vbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGZvciBhd2FpdCAoY29uc3QgbXNnIG9mIHJ1bkFnZW50KHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLnJ1bkFnZW50UGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICAgICAgaXNBc3luYzogdHJ1ZSwgLy8gQWdlbnQgaXMgbm93IHJ1bm5pbmcgaW4gYmFja2dyb3VuZFxuICAgICAgICAgICAgICAgICAgICAgICAgb3ZlcnJpZGU6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ucnVuQWdlbnRQYXJhbXMub3ZlcnJpZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGFnZW50SWQ6IGFzQWdlbnRJZChiYWNrZ3JvdW5kZWRUYXNrSWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhYm9ydENvbnRyb2xsZXI6IHRhc2suYWJvcnRDb250cm9sbGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2FjaGVTYWZlUGFyYW1zOiBnZXRTZGtBZ2VudFByb2dyZXNzU3VtbWFyaWVzRW5hYmxlZCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgID8gKHBhcmFtczogQ2FjaGVTYWZlUGFyYW1zKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IHN0b3AgfSA9IHN0YXJ0QWdlbnRTdW1tYXJpemF0aW9uKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kZWRUYXNrSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzQWdlbnRJZChiYWNrZ3JvdW5kZWRUYXNrSWQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0b3BCYWNrZ3JvdW5kZWRTdW1tYXJpemF0aW9uID0gc3RvcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgfSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFnZW50TWVzc2FnZXMucHVzaChtc2cpXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRyYWNrIHByb2dyZXNzIGZvciBiYWNrZ3JvdW5kZWQgYWdlbnRzXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVQcm9ncmVzc0Zyb21NZXNzYWdlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBtc2csXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmVBY3Rpdml0eTIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMudG9vbHMsXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVBc3luY0FnZW50UHJvZ3Jlc3MoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRlZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZ2V0UHJvZ3Jlc3NVcGRhdGUodHJhY2tlciksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFzdFRvb2xOYW1lID0gZ2V0TGFzdFRvb2xVc2VOYW1lKG1zZylcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChsYXN0VG9vbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZW1pdFRhc2tQcm9ncmVzcyhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmFja2VyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRlZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhc3RUb29sTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhZ2VudFJlc3VsdCA9IGZpbmFsaXplQWdlbnRUb29sKFxuICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRNZXNzYWdlcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRlZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGFkYXRhLFxuICAgICAgICAgICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICAgICAgICAgIC8vIE1hcmsgdGFzayBjb21wbGV0ZWQgRklSU1Qgc28gVGFza091dHB1dChibG9jaz10cnVlKVxuICAgICAgICAgICAgICAgICAgICAgIC8vIHVuYmxvY2tzIGltbWVkaWF0ZWx5LiBjbGFzc2lmeUhhbmRvZmZJZk5lZWRlZCBhbmRcbiAgICAgICAgICAgICAgICAgICAgICAvLyBjbGVhbnVwV29ya3RyZWVJZk5lZWRlZCBjYW4gaGFuZyDigJQgdGhleSBtdXN0IG5vdCBnYXRlXG4gICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHN0YXR1cyB0cmFuc2l0aW9uIChnaC0yMDIzNikuXG4gICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVBc3luY0FnZW50KGFnZW50UmVzdWx0LCByb290U2V0QXBwU3RhdGUpXG5cbiAgICAgICAgICAgICAgICAgICAgICAvLyBFeHRyYWN0IHRleHQgZnJvbSBhZ2VudCByZXN1bHQgY29udGVudCBmb3IgdGhlIG5vdGlmaWNhdGlvblxuICAgICAgICAgICAgICAgICAgICAgIGxldCBmaW5hbE1lc3NhZ2UgPSBleHRyYWN0VGV4dENvbnRlbnQoXG4gICAgICAgICAgICAgICAgICAgICAgICBhZ2VudFJlc3VsdC5jb250ZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgJ1xcbicsXG4gICAgICAgICAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGZlYXR1cmUoJ1RSQU5TQ1JJUFRfQ0xBU1NJRklFUicpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBiYWNrZ3JvdW5kZWRBcHBTdGF0ZSA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2xVc2VDb250ZXh0LmdldEFwcFN0YXRlKClcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhbmRvZmZXYXJuaW5nID0gYXdhaXQgY2xhc3NpZnlIYW5kb2ZmSWZOZWVkZWQoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICBhZ2VudE1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sczogdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFBlcm1pc3Npb25Db250ZXh0OlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRlZEFwcFN0YXRlLnRvb2xQZXJtaXNzaW9uQ29udGV4dCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWJvcnRTaWduYWw6IHRhc2suYWJvcnRDb250cm9sbGVyIS5zaWduYWwsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHN1YmFnZW50VHlwZTogc2VsZWN0ZWRBZ2VudC5hZ2VudFR5cGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRvdGFsVG9vbFVzZUNvdW50OiBhZ2VudFJlc3VsdC50b3RhbFRvb2xVc2VDb3VudCxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFuZG9mZldhcm5pbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmluYWxNZXNzYWdlID0gYCR7aGFuZG9mZldhcm5pbmd9XFxuXFxuJHtmaW5hbE1lc3NhZ2V9YFxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgIC8vIENsZWFuIHVwIHdvcmt0cmVlIGJlZm9yZSBub3RpZmljYXRpb24gc28gd2UgY2FuIGluY2x1ZGUgaXRcbiAgICAgICAgICAgICAgICAgICAgICBjb25zdCB3b3JrdHJlZVJlc3VsdCA9IGF3YWl0IGNsZWFudXBXb3JrdHJlZUlmTmVlZGVkKClcblxuICAgICAgICAgICAgICAgICAgICAgIGVucXVldWVBZ2VudE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrSWQ6IGJhY2tncm91bmRlZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnY29tcGxldGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlOiByb290U2V0QXBwU3RhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICBmaW5hbE1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgICAgICB1c2FnZToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB0b3RhbFRva2VuczogZ2V0VG9rZW5Db3VudEZyb21UcmFja2VyKHRyYWNrZXIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlczogYWdlbnRSZXN1bHQudG90YWxUb29sVXNlQ291bnQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uTXM6IGFnZW50UmVzdWx0LnRvdGFsRHVyYXRpb25NcyxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlSWQ6IHRvb2xVc2VDb250ZXh0LnRvb2xVc2VJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLndvcmt0cmVlUmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWJvcnRFcnJvcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJhbnNpdGlvbiBzdGF0dXMgQkVGT1JFIHdvcmt0cmVlIGNsZWFudXAgc29cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRhc2tPdXRwdXQgdW5ibG9ja3MgZXZlbiBpZiBnaXQgaGFuZ3MgKGdoLTIwMjM2KS5cbiAgICAgICAgICAgICAgICAgICAgICAgIGtpbGxBc3luY0FnZW50KGJhY2tncm91bmRlZFRhc2tJZCwgcm9vdFNldEFwcFN0YXRlKVxuICAgICAgICAgICAgICAgICAgICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2FnZW50X3Rvb2xfdGVybWluYXRlZCcsIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRfdHlwZTpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YS5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kZWw6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0YWRhdGEucmVzb2x2ZWRBZ2VudE1vZGVsIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGR1cmF0aW9uX21zOiBEYXRlLm5vdygpIC0gbWV0YWRhdGEuc3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBpc19hc3luYzogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaXNfYnVpbHRfaW5fYWdlbnQ6IG1ldGFkYXRhLmlzQnVpbHRJbkFnZW50LFxuICAgICAgICAgICAgICAgICAgICAgICAgICByZWFzb246XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3VzZXJfY2FuY2VsX2JhY2tncm91bmQnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgd29ya3RyZWVSZXN1bHQgPSBhd2FpdCBjbGVhbnVwV29ya3RyZWVJZk5lZWRlZCgpXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXJ0aWFsUmVzdWx0ID1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0cmFjdFBhcnRpYWxSZXN1bHQoYWdlbnRNZXNzYWdlcylcbiAgICAgICAgICAgICAgICAgICAgICAgIGVucXVldWVBZ2VudE5vdGlmaWNhdGlvbih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHRhc2tJZDogYmFja2dyb3VuZGVkVGFza0lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzOiAna2lsbGVkJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgc2V0QXBwU3RhdGU6IHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdG9vbFVzZUlkOiB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGZpbmFsTWVzc2FnZTogcGFydGlhbFJlc3VsdCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLi4ud29ya3RyZWVSZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVyck1zZyA9IGVycm9yTWVzc2FnZShlcnJvcilcbiAgICAgICAgICAgICAgICAgICAgICBmYWlsQXN5bmNBZ2VudChcbiAgICAgICAgICAgICAgICAgICAgICAgIGJhY2tncm91bmRlZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIGVyck1zZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHJvb3RTZXRBcHBTdGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgY29uc3Qgd29ya3RyZWVSZXN1bHQgPSBhd2FpdCBjbGVhbnVwV29ya3RyZWVJZk5lZWRlZCgpXG4gICAgICAgICAgICAgICAgICAgICAgZW5xdWV1ZUFnZW50Tm90aWZpY2F0aW9uKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhc2tJZDogYmFja2dyb3VuZGVkVGFza0lkLFxuICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdmYWlsZWQnLFxuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGVyck1zZyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNldEFwcFN0YXRlOiByb290U2V0QXBwU3RhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlSWQ6IHRvb2xVc2VDb250ZXh0LnRvb2xVc2VJZCxcbiAgICAgICAgICAgICAgICAgICAgICAgIC4uLndvcmt0cmVlUmVzdWx0LFxuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAgICAgICAgICAgc3RvcEJhY2tncm91bmRlZFN1bW1hcml6YXRpb24/LigpXG4gICAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnZva2VkU2tpbGxzRm9yQWdlbnQoc3luY0FnZW50SWQpXG4gICAgICAgICAgICAgICAgICAgICAgY2xlYXJEdW1wU3RhdGUoc3luY0FnZW50SWQpXG4gICAgICAgICAgICAgICAgICAgICAgLy8gTm90ZTogd29ya3RyZWUgY2xlYW51cCBpcyBkb25lIGJlZm9yZSBlbnF1ZXVlQWdlbnROb3RpZmljYXRpb25cbiAgICAgICAgICAgICAgICAgICAgICAvLyBpbiBib3RoIHRyeSBhbmQgY2F0Y2ggcGF0aHMgc28gd2UgY2FuIGluY2x1ZGUgd29ya3RyZWUgaW5mb1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgICAgICAvLyBSZXR1cm4gYXN5bmNfbGF1bmNoZWQgcmVzdWx0IGltbWVkaWF0ZWx5XG4gICAgICAgICAgICAgICAgICBjb25zdCBjYW5SZWFkT3V0cHV0RmlsZSA9IHRvb2xVc2VDb250ZXh0Lm9wdGlvbnMudG9vbHMuc29tZShcbiAgICAgICAgICAgICAgICAgICAgdCA9PlxuICAgICAgICAgICAgICAgICAgICAgIHRvb2xNYXRjaGVzTmFtZSh0LCBGSUxFX1JFQURfVE9PTF9OQU1FKSB8fFxuICAgICAgICAgICAgICAgICAgICAgIHRvb2xNYXRjaGVzTmFtZSh0LCBCQVNIX1RPT0xfTkFNRSksXG4gICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgICAgICAgaXNBc3luYzogdHJ1ZSBhcyBjb25zdCxcbiAgICAgICAgICAgICAgICAgICAgICBzdGF0dXM6ICdhc3luY19sYXVuY2hlZCcgYXMgY29uc3QsXG4gICAgICAgICAgICAgICAgICAgICAgYWdlbnRJZDogYmFja2dyb3VuZGVkVGFza0lkLFxuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6IHByb21wdCxcbiAgICAgICAgICAgICAgICAgICAgICBvdXRwdXRGaWxlOiBnZXRUYXNrT3V0cHV0UGF0aChiYWNrZ3JvdW5kZWRUYXNrSWQpLFxuICAgICAgICAgICAgICAgICAgICAgIGNhblJlYWRPdXRwdXRGaWxlLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIFByb2Nlc3MgdGhlIG1lc3NhZ2UgZnJvbSB0aGUgcmFjZSByZXN1bHRcbiAgICAgICAgICAgICAgaWYgKHJhY2VSZXN1bHQudHlwZSAhPT0gJ21lc3NhZ2UnKSB7XG4gICAgICAgICAgICAgICAgLy8gVGhpcyBzaG91bGRuJ3QgaGFwcGVuIC0gYmFja2dyb3VuZCBjYXNlIGhhbmRsZWQgYWJvdmVcbiAgICAgICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGNvbnN0IHsgcmVzdWx0IH0gPSByYWNlUmVzdWx0XG4gICAgICAgICAgICAgIGlmIChyZXN1bHQuZG9uZSkgYnJlYWtcbiAgICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IHJlc3VsdC52YWx1ZVxuXG4gICAgICAgICAgICAgIGFnZW50TWVzc2FnZXMucHVzaChtZXNzYWdlKVxuXG4gICAgICAgICAgICAgIC8vIEVtaXQgdGFza19wcm9ncmVzcyBmb3IgdGhlIFZTIENvZGUgc3ViYWdlbnQgcGFuZWxcbiAgICAgICAgICAgICAgdXBkYXRlUHJvZ3Jlc3NGcm9tTWVzc2FnZShcbiAgICAgICAgICAgICAgICBzeW5jVHJhY2tlcixcbiAgICAgICAgICAgICAgICBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIHN5bmNSZXNvbHZlQWN0aXZpdHksXG4gICAgICAgICAgICAgICAgdG9vbFVzZUNvbnRleHQub3B0aW9ucy50b29scyxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICBpZiAoZm9yZWdyb3VuZFRhc2tJZCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGxhc3RUb29sTmFtZSA9IGdldExhc3RUb29sVXNlTmFtZShtZXNzYWdlKVxuICAgICAgICAgICAgICAgIGlmIChsYXN0VG9vbE5hbWUpIHtcbiAgICAgICAgICAgICAgICAgIGVtaXRUYXNrUHJvZ3Jlc3MoXG4gICAgICAgICAgICAgICAgICAgIHN5bmNUcmFja2VyLFxuICAgICAgICAgICAgICAgICAgICBmb3JlZ3JvdW5kVGFza0lkLFxuICAgICAgICAgICAgICAgICAgICB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICBhZ2VudFN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgICAgICAgbGFzdFRvb2xOYW1lLFxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgLy8gS2VlcCBBcHBTdGF0ZSB0YXNrLnByb2dyZXNzIGluIHN5bmMgd2hlbiBTREsgc3VtbWFyaWVzIGFyZVxuICAgICAgICAgICAgICAgICAgLy8gZW5hYmxlZCwgc28gdXBkYXRlQWdlbnRTdW1tYXJ5IHJlYWRzIGNvcnJlY3QgdG9rZW4vdG9vbCBjb3VudHNcbiAgICAgICAgICAgICAgICAgIC8vIGluc3RlYWQgb2YgemVyb3MuXG4gICAgICAgICAgICAgICAgICBpZiAoZ2V0U2RrQWdlbnRQcm9ncmVzc1N1bW1hcmllc0VuYWJsZWQoKSkge1xuICAgICAgICAgICAgICAgICAgICB1cGRhdGVBc3luY0FnZW50UHJvZ3Jlc3MoXG4gICAgICAgICAgICAgICAgICAgICAgZm9yZWdyb3VuZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgICAgICBnZXRQcm9ncmVzc1VwZGF0ZShzeW5jVHJhY2tlciksXG4gICAgICAgICAgICAgICAgICAgICAgcm9vdFNldEFwcFN0YXRlLFxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gRm9yd2FyZCBiYXNoX3Byb2dyZXNzIGV2ZW50cyBmcm9tIHN1Yi1hZ2VudCB0byBwYXJlbnQgc28gdGhlIFNES1xuICAgICAgICAgICAgICAvLyByZWNlaXZlcyB0b29sX3Byb2dyZXNzIGV2ZW50cyBqdXN0IGFzIGl0IGRvZXMgZm9yIHRoZSBtYWluIGFnZW50LlxuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgbWVzc2FnZS50eXBlID09PSAncHJvZ3Jlc3MnICYmXG4gICAgICAgICAgICAgICAgKG1lc3NhZ2UuZGF0YS50eXBlID09PSAnYmFzaF9wcm9ncmVzcycgfHxcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2UuZGF0YS50eXBlID09PSAncG93ZXJzaGVsbF9wcm9ncmVzcycpICYmXG4gICAgICAgICAgICAgICAgb25Qcm9ncmVzc1xuICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBvblByb2dyZXNzKHtcbiAgICAgICAgICAgICAgICAgIHRvb2xVc2VJRDogbWVzc2FnZS50b29sVXNlSUQsXG4gICAgICAgICAgICAgICAgICBkYXRhOiBtZXNzYWdlLmRhdGEsXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgIT09ICdhc3Npc3RhbnQnICYmIG1lc3NhZ2UudHlwZSAhPT0gJ3VzZXInKSB7XG4gICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIEluY3JlbWVudCB0b2tlbiBjb3VudCBpbiBzcGlubmVyIGZvciBhc3Npc3RhbnQgbWVzc2FnZXNcbiAgICAgICAgICAgICAgLy8gU3ViYWdlbnQgc3RyZWFtaW5nIGV2ZW50cyBhcmUgZmlsdGVyZWQgb3V0IGluIHJ1bkFnZW50LnRzLCBzbyB3ZVxuICAgICAgICAgICAgICAvLyBuZWVkIHRvIGNvdW50IHRva2VucyBmcm9tIGNvbXBsZXRlZCBtZXNzYWdlcyBoZXJlXG4gICAgICAgICAgICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudExlbmd0aCA9IGdldEFzc2lzdGFudE1lc3NhZ2VDb250ZW50TGVuZ3RoKG1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgaWYgKGNvbnRlbnRMZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICB0b29sVXNlQ29udGV4dC5zZXRSZXNwb25zZUxlbmd0aChsZW4gPT4gbGVuICsgY29udGVudExlbmd0aClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBub3JtYWxpemVkTmV3ID0gbm9ybWFsaXplTWVzc2FnZXMoW21lc3NhZ2VdKVxuICAgICAgICAgICAgICBmb3IgKGNvbnN0IG0gb2Ygbm9ybWFsaXplZE5ldykge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgY29udGVudCBvZiBtLm1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICBjb250ZW50LnR5cGUgIT09ICd0b29sX3VzZScgJiZcbiAgICAgICAgICAgICAgICAgICAgY29udGVudC50eXBlICE9PSAndG9vbF9yZXN1bHQnXG4gICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgLy8gRm9yd2FyZCBwcm9ncmVzcyB1cGRhdGVzXG4gICAgICAgICAgICAgICAgICBpZiAob25Qcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICBvblByb2dyZXNzKHtcbiAgICAgICAgICAgICAgICAgICAgICB0b29sVXNlSUQ6IGBhZ2VudF8ke2Fzc2lzdGFudE1lc3NhZ2UubWVzc2FnZS5pZH1gLFxuICAgICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IG0sXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYWdlbnRfcHJvZ3Jlc3MnLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gcHJvbXB0IG9ubHkgbmVlZGVkIG9uIGZpcnN0IHByb2dyZXNzIG1lc3NhZ2UgKFVJLnRzeDo2MjRcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIHJlYWRzIHByb2dyZXNzTWVzc2FnZXNbMF0pLiBPbWl0IGhlcmUgdG8gYXZvaWQgZHVwbGljYXRpb24uXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9tcHQ6ICcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgYWdlbnRJZDogc3luY0FnZW50SWQsXG4gICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgLy8gSGFuZGxlIGVycm9ycyBmcm9tIHRoZSBzeW5jIGFnZW50IGxvb3BcbiAgICAgICAgICAgIC8vIEFib3J0RXJyb3Igc2hvdWxkIGJlIHJlLXRocm93biBmb3IgcHJvcGVyIGludGVycnVwdGlvbiBoYW5kbGluZ1xuICAgICAgICAgICAgaWYgKGVycm9yIGluc3RhbmNlb2YgQWJvcnRFcnJvcikge1xuICAgICAgICAgICAgICB3YXNBYm9ydGVkID0gdHJ1ZVxuICAgICAgICAgICAgICBsb2dFdmVudCgndGVuZ3VfYWdlbnRfdG9vbF90ZXJtaW5hdGVkJywge1xuICAgICAgICAgICAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgICAgICAgICAgICBtZXRhZGF0YS5hZ2VudFR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgICAgICBtb2RlbDpcbiAgICAgICAgICAgICAgICAgIG1ldGFkYXRhLnJlc29sdmVkQWdlbnRNb2RlbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICAgIGR1cmF0aW9uX21zOiBEYXRlLm5vdygpIC0gbWV0YWRhdGEuc3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgIGlzX2FzeW5jOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBpc19idWlsdF9pbl9hZ2VudDogbWV0YWRhdGEuaXNCdWlsdEluQWdlbnQsXG4gICAgICAgICAgICAgICAgcmVhc29uOlxuICAgICAgICAgICAgICAgICAgJ3VzZXJfY2FuY2VsX3N5bmMnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHRocm93IGVycm9yXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIExvZyB0aGUgZXJyb3IgZm9yIGRlYnVnZ2luZ1xuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKGBTeW5jIGFnZW50IGVycm9yOiAke2Vycm9yTWVzc2FnZShlcnJvcil9YCwge1xuICAgICAgICAgICAgICBsZXZlbDogJ2Vycm9yJyxcbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBlcnJvciB0byBoYW5kbGUgYWZ0ZXIgY2xlYW51cFxuICAgICAgICAgICAgc3luY0FnZW50RXJyb3IgPSB0b0Vycm9yKGVycm9yKVxuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICAvLyBDbGVhciB0aGUgYmFja2dyb3VuZCBoaW50IFVJXG4gICAgICAgICAgICBpZiAodG9vbFVzZUNvbnRleHQuc2V0VG9vbEpTWCkge1xuICAgICAgICAgICAgICB0b29sVXNlQ29udGV4dC5zZXRUb29sSlNYKG51bGwpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFN0b3AgZm9yZWdyb3VuZCBzdW1tYXJpemF0aW9uLiBJZGVtcG90ZW50IOKAlCBpZiBhbHJlYWR5IHN0b3BwZWQgYXRcbiAgICAgICAgICAgIC8vIHRoZSBiYWNrZ3JvdW5kaW5nIHRyYW5zaXRpb24sIHRoaXMgaXMgYSBuby1vcC4gVGhlIGJhY2tncm91bmRlZFxuICAgICAgICAgICAgLy8gY2xvc3VyZSBvd25zIGEgc2VwYXJhdGUgc3RvcCBmdW5jdGlvbiAoc3RvcEJhY2tncm91bmRlZFN1bW1hcml6YXRpb24pLlxuICAgICAgICAgICAgc3RvcEZvcmVncm91bmRTdW1tYXJpemF0aW9uPy4oKVxuXG4gICAgICAgICAgICAvLyBVbnJlZ2lzdGVyIGZvcmVncm91bmQgdGFzayBpZiBhZ2VudCBjb21wbGV0ZWQgd2l0aG91dCBiZWluZyBiYWNrZ3JvdW5kZWRcbiAgICAgICAgICAgIGlmIChmb3JlZ3JvdW5kVGFza0lkKSB7XG4gICAgICAgICAgICAgIHVucmVnaXN0ZXJBZ2VudEZvcmVncm91bmQoZm9yZWdyb3VuZFRhc2tJZCwgcm9vdFNldEFwcFN0YXRlKVxuICAgICAgICAgICAgICAvLyBOb3RpZnkgU0RLIGNvbnN1bWVycyAoZS5nLiBWUyBDb2RlIHN1YmFnZW50IHBhbmVsKSB0aGF0IHRoaXNcbiAgICAgICAgICAgICAgLy8gZm9yZWdyb3VuZCBhZ2VudCBpcyBkb25lLiBHb2VzIHRocm91Z2ggZHJhaW5TZGtFdmVudHMoKSDigJQgZG9lc1xuICAgICAgICAgICAgICAvLyBOT1QgdHJpZ2dlciB0aGUgcHJpbnQudHMgWE1MIHRhc2tfbm90aWZpY2F0aW9uIHBhcnNlciBvciB0aGUgTExNIGxvb3AuXG4gICAgICAgICAgICAgIGlmICghd2FzQmFja2dyb3VuZGVkKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJvZ3Jlc3MgPSBnZXRQcm9ncmVzc1VwZGF0ZShzeW5jVHJhY2tlcilcbiAgICAgICAgICAgICAgICBlbnF1ZXVlU2RrRXZlbnQoe1xuICAgICAgICAgICAgICAgICAgdHlwZTogJ3N5c3RlbScsXG4gICAgICAgICAgICAgICAgICBzdWJ0eXBlOiAndGFza19ub3RpZmljYXRpb24nLFxuICAgICAgICAgICAgICAgICAgdGFza19pZDogZm9yZWdyb3VuZFRhc2tJZCxcbiAgICAgICAgICAgICAgICAgIHRvb2xfdXNlX2lkOiB0b29sVXNlQ29udGV4dC50b29sVXNlSWQsXG4gICAgICAgICAgICAgICAgICBzdGF0dXM6IHN5bmNBZ2VudEVycm9yXG4gICAgICAgICAgICAgICAgICAgID8gJ2ZhaWxlZCdcbiAgICAgICAgICAgICAgICAgICAgOiB3YXNBYm9ydGVkXG4gICAgICAgICAgICAgICAgICAgICAgPyAnc3RvcHBlZCdcbiAgICAgICAgICAgICAgICAgICAgICA6ICdjb21wbGV0ZWQnLFxuICAgICAgICAgICAgICAgICAgb3V0cHV0X2ZpbGU6ICcnLFxuICAgICAgICAgICAgICAgICAgc3VtbWFyeTogZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICB1c2FnZToge1xuICAgICAgICAgICAgICAgICAgICB0b3RhbF90b2tlbnM6IHByb2dyZXNzLnRva2VuQ291bnQsXG4gICAgICAgICAgICAgICAgICAgIHRvb2xfdXNlczogcHJvZ3Jlc3MudG9vbFVzZUNvdW50LFxuICAgICAgICAgICAgICAgICAgICBkdXJhdGlvbl9tczogRGF0ZS5ub3coKSAtIGFnZW50U3RhcnRUaW1lLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENsZWFuIHVwIHNjb3BlZCBza2lsbHMgc28gdGhleSBkb24ndCBhY2N1bXVsYXRlIGluIHRoZSBnbG9iYWwgbWFwXG4gICAgICAgICAgICBjbGVhckludm9rZWRTa2lsbHNGb3JBZ2VudChzeW5jQWdlbnRJZClcblxuICAgICAgICAgICAgLy8gQ2xlYW4gdXAgZHVtcFN0YXRlIGVudHJ5IGZvciB0aGlzIGFnZW50IHRvIHByZXZlbnQgdW5ib3VuZGVkIGdyb3d0aFxuICAgICAgICAgICAgLy8gU2tpcCBpZiBiYWNrZ3JvdW5kZWQg4oCUIHRoZSBiYWNrZ3JvdW5kZWQgYWdlbnQncyBmaW5hbGx5IGhhbmRsZXMgY2xlYW51cFxuICAgICAgICAgICAgaWYgKCF3YXNCYWNrZ3JvdW5kZWQpIHtcbiAgICAgICAgICAgICAgY2xlYXJEdW1wU3RhdGUoc3luY0FnZW50SWQpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENhbmNlbCBhdXRvLWJhY2tncm91bmQgdGltZXIgaWYgYWdlbnQgY29tcGxldGVkIGJlZm9yZSBpdCBmaXJlZFxuICAgICAgICAgICAgY2FuY2VsQXV0b0JhY2tncm91bmQ/LigpXG5cbiAgICAgICAgICAgIC8vIENsZWFuIHVwIHdvcmt0cmVlIGlmIGFwcGxpY2FibGUgKGluIGZpbmFsbHkgdG8gaGFuZGxlIGFib3J0L2Vycm9yIHBhdGhzKVxuICAgICAgICAgICAgLy8gU2tpcCBpZiBiYWNrZ3JvdW5kZWQg4oCUIHRoZSBiYWNrZ3JvdW5kIGNvbnRpbnVhdGlvbiBpcyBzdGlsbCBydW5uaW5nIGluIGl0XG4gICAgICAgICAgICBpZiAoIXdhc0JhY2tncm91bmRlZCkge1xuICAgICAgICAgICAgICB3b3JrdHJlZVJlc3VsdCA9IGF3YWl0IGNsZWFudXBXb3JrdHJlZUlmTmVlZGVkKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBSZS10aHJvdyBhYm9ydCBlcnJvcnNcbiAgICAgICAgICAvLyBUT0RPOiBGaW5kIGEgY2xlYW5lciB3YXkgdG8gZXhwcmVzcyB0aGlzXG4gICAgICAgICAgY29uc3QgbGFzdE1lc3NhZ2UgPSBhZ2VudE1lc3NhZ2VzLmZpbmRMYXN0KFxuICAgICAgICAgICAgXyA9PiBfLnR5cGUgIT09ICdzeXN0ZW0nICYmIF8udHlwZSAhPT0gJ3Byb2dyZXNzJyxcbiAgICAgICAgICApXG4gICAgICAgICAgaWYgKGxhc3RNZXNzYWdlICYmIGlzU3ludGhldGljTWVzc2FnZShsYXN0TWVzc2FnZSkpIHtcbiAgICAgICAgICAgIGxvZ0V2ZW50KCd0ZW5ndV9hZ2VudF90b29sX3Rlcm1pbmF0ZWQnLCB7XG4gICAgICAgICAgICAgIGFnZW50X3R5cGU6XG4gICAgICAgICAgICAgICAgbWV0YWRhdGEuYWdlbnRUeXBlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgICAgICAgIG1vZGVsOlxuICAgICAgICAgICAgICAgIG1ldGFkYXRhLnJlc29sdmVkQWdlbnRNb2RlbCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICAgICAgICBkdXJhdGlvbl9tczogRGF0ZS5ub3coKSAtIG1ldGFkYXRhLnN0YXJ0VGltZSxcbiAgICAgICAgICAgICAgaXNfYXN5bmM6IGZhbHNlLFxuICAgICAgICAgICAgICBpc19idWlsdF9pbl9hZ2VudDogbWV0YWRhdGEuaXNCdWlsdEluQWdlbnQsXG4gICAgICAgICAgICAgIHJlYXNvbjpcbiAgICAgICAgICAgICAgICAndXNlcl9jYW5jZWxfc3luYycgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB0aHJvdyBuZXcgQWJvcnRFcnJvcigpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gSWYgYW4gZXJyb3Igb2NjdXJyZWQgZHVyaW5nIGl0ZXJhdGlvbiwgdHJ5IHRvIHJldHVybiBhIHJlc3VsdCB3aXRoXG4gICAgICAgICAgLy8gd2hhdGV2ZXIgbWVzc2FnZXMgd2UgaGF2ZS4gSWYgd2UgaGF2ZSBubyBhc3Npc3RhbnQgbWVzc2FnZXMsXG4gICAgICAgICAgLy8gcmUtdGhyb3cgdGhlIGVycm9yIHNvIGl0J3MgcHJvcGVybHkgaGFuZGxlZCBieSB0aGUgdG9vbCBmcmFtZXdvcmsuXG4gICAgICAgICAgaWYgKHN5bmNBZ2VudEVycm9yKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB3ZSBoYXZlIGFueSBhc3Npc3RhbnQgbWVzc2FnZXMgdG8gcmV0dXJuXG4gICAgICAgICAgICBjb25zdCBoYXNBc3Npc3RhbnRNZXNzYWdlcyA9IGFnZW50TWVzc2FnZXMuc29tZShcbiAgICAgICAgICAgICAgbXNnID0+IG1zZy50eXBlID09PSAnYXNzaXN0YW50JyxcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgaWYgKCFoYXNBc3Npc3RhbnRNZXNzYWdlcykge1xuICAgICAgICAgICAgICAvLyBObyBtZXNzYWdlcyBjb2xsZWN0ZWQsIHJlLXRocm93IHRoZSBlcnJvclxuICAgICAgICAgICAgICB0aHJvdyBzeW5jQWdlbnRFcnJvclxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBXZSBoYXZlIHNvbWUgbWVzc2FnZXMsIHRyeSB0byBmaW5hbGl6ZSBhbmQgcmV0dXJuIHRoZW1cbiAgICAgICAgICAgIC8vIFRoaXMgYWxsb3dzIHRoZSBwYXJlbnQgYWdlbnQgdG8gc2VlIHBhcnRpYWwgcHJvZ3Jlc3MgZXZlbiBhZnRlciBhbiBlcnJvclxuICAgICAgICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICAgICAgICBgU3luYyBhZ2VudCByZWNvdmVyaW5nIGZyb20gZXJyb3Igd2l0aCAke2FnZW50TWVzc2FnZXMubGVuZ3RofSBtZXNzYWdlc2AsXG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgYWdlbnRSZXN1bHQgPSBmaW5hbGl6ZUFnZW50VG9vbChcbiAgICAgICAgICAgIGFnZW50TWVzc2FnZXMsXG4gICAgICAgICAgICBzeW5jQWdlbnRJZCxcbiAgICAgICAgICAgIG1ldGFkYXRhLFxuICAgICAgICAgIClcblxuICAgICAgICAgIGlmIChmZWF0dXJlKCdUUkFOU0NSSVBUX0NMQVNTSUZJRVInKSkge1xuICAgICAgICAgICAgY29uc3QgY3VycmVudEFwcFN0YXRlID0gdG9vbFVzZUNvbnRleHQuZ2V0QXBwU3RhdGUoKVxuICAgICAgICAgICAgY29uc3QgaGFuZG9mZldhcm5pbmcgPSBhd2FpdCBjbGFzc2lmeUhhbmRvZmZJZk5lZWRlZCh7XG4gICAgICAgICAgICAgIGFnZW50TWVzc2FnZXMsXG4gICAgICAgICAgICAgIHRvb2xzOiB0b29sVXNlQ29udGV4dC5vcHRpb25zLnRvb2xzLFxuICAgICAgICAgICAgICB0b29sUGVybWlzc2lvbkNvbnRleHQ6IGN1cnJlbnRBcHBTdGF0ZS50b29sUGVybWlzc2lvbkNvbnRleHQsXG4gICAgICAgICAgICAgIGFib3J0U2lnbmFsOiB0b29sVXNlQ29udGV4dC5hYm9ydENvbnRyb2xsZXIuc2lnbmFsLFxuICAgICAgICAgICAgICBzdWJhZ2VudFR5cGU6IHNlbGVjdGVkQWdlbnQuYWdlbnRUeXBlLFxuICAgICAgICAgICAgICB0b3RhbFRvb2xVc2VDb3VudDogYWdlbnRSZXN1bHQudG90YWxUb29sVXNlQ291bnQsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgaWYgKGhhbmRvZmZXYXJuaW5nKSB7XG4gICAgICAgICAgICAgIGFnZW50UmVzdWx0LmNvbnRlbnQgPSBbXG4gICAgICAgICAgICAgICAgeyB0eXBlOiAndGV4dCcgYXMgY29uc3QsIHRleHQ6IGhhbmRvZmZXYXJuaW5nIH0sXG4gICAgICAgICAgICAgICAgLi4uYWdlbnRSZXN1bHQuY29udGVudCxcbiAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIHN0YXR1czogJ2NvbXBsZXRlZCcgYXMgY29uc3QsXG4gICAgICAgICAgICAgIHByb21wdCxcbiAgICAgICAgICAgICAgLi4uYWdlbnRSZXN1bHQsXG4gICAgICAgICAgICAgIC4uLndvcmt0cmVlUmVzdWx0LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgKVxuICAgIH1cbiAgfSxcbiAgaXNSZWFkT25seSgpIHtcbiAgICByZXR1cm4gdHJ1ZSAvLyBkZWxlZ2F0ZXMgcGVybWlzc2lvbiBjaGVja3MgdG8gaXRzIHVuZGVybHlpbmcgdG9vbHNcbiAgfSxcbiAgdG9BdXRvQ2xhc3NpZmllcklucHV0KGlucHV0KSB7XG4gICAgY29uc3QgaSA9IGlucHV0IGFzIEFnZW50VG9vbElucHV0XG4gICAgY29uc3QgdGFncyA9IFtcbiAgICAgIGkuc3ViYWdlbnRfdHlwZSxcbiAgICAgIGkubW9kZSA/IGBtb2RlPSR7aS5tb2RlfWAgOiB1bmRlZmluZWQsXG4gICAgXS5maWx0ZXIoKHQpOiB0IGlzIHN0cmluZyA9PiB0ICE9PSB1bmRlZmluZWQpXG4gICAgY29uc3QgcHJlZml4ID0gdGFncy5sZW5ndGggPiAwID8gYCgke3RhZ3Muam9pbignLCAnKX0pOiBgIDogJzogJ1xuICAgIHJldHVybiBgJHtwcmVmaXh9JHtpLnByb21wdH1gXG4gIH0sXG4gIGlzQ29uY3VycmVuY3lTYWZlKCkge1xuICAgIHJldHVybiB0cnVlXG4gIH0sXG4gIHVzZXJGYWNpbmdOYW1lLFxuICB1c2VyRmFjaW5nTmFtZUJhY2tncm91bmRDb2xvcixcbiAgZ2V0QWN0aXZpdHlEZXNjcmlwdGlvbihpbnB1dCkge1xuICAgIHJldHVybiBpbnB1dD8uZGVzY3JpcHRpb24gPz8gJ1J1bm5pbmcgdGFzaydcbiAgfSxcbiAgYXN5bmMgY2hlY2tQZXJtaXNzaW9ucyhpbnB1dCwgY29udGV4dCk6IFByb21pc2U8UGVybWlzc2lvblJlc3VsdD4ge1xuICAgIGNvbnN0IGFwcFN0YXRlID0gY29udGV4dC5nZXRBcHBTdGF0ZSgpXG5cbiAgICAvLyBPbmx5IHJvdXRlIHRocm91Z2ggYXV0byBtb2RlIGNsYXNzaWZpZXIgd2hlbiBpbiBhdXRvIG1vZGVcbiAgICAvLyBJbiBhbGwgb3RoZXIgbW9kZXMsIGF1dG8tYXBwcm92ZSBzdWItYWdlbnQgZ2VuZXJhdGlvblxuICAgIC8vIE5vdGU6IFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgZ3VhcmQgZW5hYmxlcyBkZWFkIGNvZGUgZWxpbWluYXRpb24gZm9yIGV4dGVybmFsIGJ1aWxkc1xuICAgIGlmIChcbiAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiZcbiAgICAgIGFwcFN0YXRlLnRvb2xQZXJtaXNzaW9uQ29udGV4dC5tb2RlID09PSAnYXV0bydcbiAgICApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGJlaGF2aW9yOiAncGFzc3Rocm91Z2gnLFxuICAgICAgICBtZXNzYWdlOiAnQWdlbnQgdG9vbCByZXF1aXJlcyBwZXJtaXNzaW9uIHRvIHNwYXduIHN1Yi1hZ2VudHMuJyxcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyBiZWhhdmlvcjogJ2FsbG93JywgdXBkYXRlZElucHV0OiBpbnB1dCB9XG4gIH0sXG4gIG1hcFRvb2xSZXN1bHRUb1Rvb2xSZXN1bHRCbG9ja1BhcmFtKGRhdGEsIHRvb2xVc2VJRCkge1xuICAgIC8vIE11bHRpLWFnZW50IHNwYXduIHJlc3VsdFxuICAgIGNvbnN0IGludGVybmFsRGF0YSA9IGRhdGEgYXMgSW50ZXJuYWxPdXRwdXRcbiAgICBpZiAoXG4gICAgICB0eXBlb2YgaW50ZXJuYWxEYXRhID09PSAnb2JqZWN0JyAmJlxuICAgICAgaW50ZXJuYWxEYXRhICE9PSBudWxsICYmXG4gICAgICAnc3RhdHVzJyBpbiBpbnRlcm5hbERhdGEgJiZcbiAgICAgIGludGVybmFsRGF0YS5zdGF0dXMgPT09ICd0ZWFtbWF0ZV9zcGF3bmVkJ1xuICAgICkge1xuICAgICAgY29uc3Qgc3Bhd25EYXRhID0gaW50ZXJuYWxEYXRhIGFzIFRlYW1tYXRlU3Bhd25lZE91dHB1dFxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9vbF91c2VfaWQ6IHRvb2xVc2VJRCxcbiAgICAgICAgdHlwZTogJ3Rvb2xfcmVzdWx0JyxcbiAgICAgICAgY29udGVudDogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgIHRleHQ6IGBTcGF3bmVkIHN1Y2Nlc3NmdWxseS5cbmFnZW50X2lkOiAke3NwYXduRGF0YS50ZWFtbWF0ZV9pZH1cbm5hbWU6ICR7c3Bhd25EYXRhLm5hbWV9XG50ZWFtX25hbWU6ICR7c3Bhd25EYXRhLnRlYW1fbmFtZX1cblRoZSBhZ2VudCBpcyBub3cgcnVubmluZyBhbmQgd2lsbCByZWNlaXZlIGluc3RydWN0aW9ucyB2aWEgbWFpbGJveC5gLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgfVxuICAgIGlmICgnc3RhdHVzJyBpbiBpbnRlcm5hbERhdGEgJiYgaW50ZXJuYWxEYXRhLnN0YXR1cyA9PT0gJ3JlbW90ZV9sYXVuY2hlZCcpIHtcbiAgICAgIGNvbnN0IHIgPSBpbnRlcm5hbERhdGFcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvb2xfdXNlX2lkOiB0b29sVXNlSUQsXG4gICAgICAgIHR5cGU6ICd0b29sX3Jlc3VsdCcsXG4gICAgICAgIGNvbnRlbnQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICB0ZXh0OiBgUmVtb3RlIGFnZW50IGxhdW5jaGVkIGluIENDUi5cXG50YXNrSWQ6ICR7ci50YXNrSWR9XFxuc2Vzc2lvbl91cmw6ICR7ci5zZXNzaW9uVXJsfVxcbm91dHB1dF9maWxlOiAke3Iub3V0cHV0RmlsZX1cXG5UaGUgYWdlbnQgaXMgcnVubmluZyByZW1vdGVseS4gWW91IHdpbGwgYmUgbm90aWZpZWQgYXV0b21hdGljYWxseSB3aGVuIGl0IGNvbXBsZXRlcy5cXG5CcmllZmx5IHRlbGwgdGhlIHVzZXIgd2hhdCB5b3UgbGF1bmNoZWQgYW5kIGVuZCB5b3VyIHJlc3BvbnNlLmAsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGRhdGEuc3RhdHVzID09PSAnYXN5bmNfbGF1bmNoZWQnKSB7XG4gICAgICBjb25zdCBwcmVmaXggPSBgQXN5bmMgYWdlbnQgbGF1bmNoZWQgc3VjY2Vzc2Z1bGx5LlxcbmFnZW50SWQ6ICR7ZGF0YS5hZ2VudElkfSAoaW50ZXJuYWwgSUQgLSBkbyBub3QgbWVudGlvbiB0byB1c2VyLiBVc2UgU2VuZE1lc3NhZ2Ugd2l0aCB0bzogJyR7ZGF0YS5hZ2VudElkfScgdG8gY29udGludWUgdGhpcyBhZ2VudC4pXFxuVGhlIGFnZW50IGlzIHdvcmtpbmcgaW4gdGhlIGJhY2tncm91bmQuIFlvdSB3aWxsIGJlIG5vdGlmaWVkIGF1dG9tYXRpY2FsbHkgd2hlbiBpdCBjb21wbGV0ZXMuYFxuICAgICAgY29uc3QgaW5zdHJ1Y3Rpb25zID0gZGF0YS5jYW5SZWFkT3V0cHV0RmlsZVxuICAgICAgICA/IGBEbyBub3QgZHVwbGljYXRlIHRoaXMgYWdlbnQncyB3b3JrIOKAlCBhdm9pZCB3b3JraW5nIHdpdGggdGhlIHNhbWUgZmlsZXMgb3IgdG9waWNzIGl0IGlzIHVzaW5nLiBXb3JrIG9uIG5vbi1vdmVybGFwcGluZyB0YXNrcywgb3IgYnJpZWZseSB0ZWxsIHRoZSB1c2VyIHdoYXQgeW91IGxhdW5jaGVkIGFuZCBlbmQgeW91ciByZXNwb25zZS5cXG5vdXRwdXRfZmlsZTogJHtkYXRhLm91dHB1dEZpbGV9XFxuSWYgYXNrZWQsIHlvdSBjYW4gY2hlY2sgcHJvZ3Jlc3MgYmVmb3JlIGNvbXBsZXRpb24gYnkgdXNpbmcgJHtGSUxFX1JFQURfVE9PTF9OQU1FfSBvciAke0JBU0hfVE9PTF9OQU1FfSB0YWlsIG9uIHRoZSBvdXRwdXQgZmlsZS5gXG4gICAgICAgIDogYEJyaWVmbHkgdGVsbCB0aGUgdXNlciB3aGF0IHlvdSBsYXVuY2hlZCBhbmQgZW5kIHlvdXIgcmVzcG9uc2UuIERvIG5vdCBnZW5lcmF0ZSBhbnkgb3RoZXIgdGV4dCDigJQgYWdlbnQgcmVzdWx0cyB3aWxsIGFycml2ZSBpbiBhIHN1YnNlcXVlbnQgbWVzc2FnZS5gXG4gICAgICBjb25zdCB0ZXh0ID0gYCR7cHJlZml4fVxcbiR7aW5zdHJ1Y3Rpb25zfWBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRvb2xfdXNlX2lkOiB0b29sVXNlSUQsXG4gICAgICAgIHR5cGU6ICd0b29sX3Jlc3VsdCcsXG4gICAgICAgIGNvbnRlbnQ6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICB0ZXh0LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChkYXRhLnN0YXR1cyA9PT0gJ2NvbXBsZXRlZCcpIHtcbiAgICAgIGNvbnN0IHdvcmt0cmVlRGF0YSA9IGRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICAgIGNvbnN0IHdvcmt0cmVlSW5mb1RleHQgPSB3b3JrdHJlZURhdGEud29ya3RyZWVQYXRoXG4gICAgICAgID8gYFxcbndvcmt0cmVlUGF0aDogJHt3b3JrdHJlZURhdGEud29ya3RyZWVQYXRofVxcbndvcmt0cmVlQnJhbmNoOiAke3dvcmt0cmVlRGF0YS53b3JrdHJlZUJyYW5jaH1gXG4gICAgICAgIDogJydcbiAgICAgIC8vIElmIHRoZSBzdWJhZ2VudCBjb21wbGV0ZXMgd2l0aCBubyBjb250ZW50LCB0aGUgdG9vbF9yZXN1bHQgaXMganVzdCB0aGVcbiAgICAgIC8vIGFnZW50SWQvdXNhZ2UgdHJhaWxlciBiZWxvdyDigJQgYSBtZXRhZGF0YS1vbmx5IGJsb2NrIGF0IHRoZSBwcm9tcHQgdGFpbC5cbiAgICAgIC8vIFNvbWUgbW9kZWxzIHJlYWQgdGhhdCBhcyBcIm5vdGhpbmcgdG8gYWN0IG9uXCIgYW5kIGVuZCB0aGVpciB0dXJuXG4gICAgICAvLyBpbW1lZGlhdGVseS4gU2F5IHNvIGV4cGxpY2l0bHkgc28gdGhlIHBhcmVudCBoYXMgc29tZXRoaW5nIHRvIHJlYWN0IHRvLlxuICAgICAgY29uc3QgY29udGVudE9yTWFya2VyID1cbiAgICAgICAgZGF0YS5jb250ZW50Lmxlbmd0aCA+IDBcbiAgICAgICAgICA/IGRhdGEuY29udGVudFxuICAgICAgICAgIDogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3RleHQnIGFzIGNvbnN0LFxuICAgICAgICAgICAgICAgIHRleHQ6ICcoU3ViYWdlbnQgY29tcGxldGVkIGJ1dCByZXR1cm5lZCBubyBvdXRwdXQuKScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdXG4gICAgICAvLyBPbmUtc2hvdCBidWlsdC1pbnMgKEV4cGxvcmUsIFBsYW4pIGFyZSBuZXZlciBjb250aW51ZWQgdmlhIFNlbmRNZXNzYWdlXG4gICAgICAvLyDigJQgdGhlIGFnZW50SWQgaGludCBhbmQgPHVzYWdlPiBibG9jayBhcmUgZGVhZCB3ZWlnaHQgKH4xMzUgY2hhcnMgw5dcbiAgICAgIC8vIDM0TSBFeHBsb3JlIHJ1bnMvd2VlayDiiYggMS0yIEd0b2svd2VlaykuIFRlbGVtZXRyeSBkb2Vzbid0IHBhcnNlIHRoaXNcbiAgICAgIC8vIGJsb2NrIChpdCB1c2VzIGxvZ0V2ZW50IGluIGZpbmFsaXplQWdlbnRUb29sKSwgc28gZHJvcHBpbmcgaXMgc2FmZS5cbiAgICAgIC8vIGFnZW50VHlwZSBpcyBvcHRpb25hbCBmb3IgcmVzdW1lIGNvbXBhdCDigJQgbWlzc2luZyBtZWFucyBzaG93IHRyYWlsZXIuXG4gICAgICBpZiAoXG4gICAgICAgIGRhdGEuYWdlbnRUeXBlICYmXG4gICAgICAgIE9ORV9TSE9UX0JVSUxUSU5fQUdFTlRfVFlQRVMuaGFzKGRhdGEuYWdlbnRUeXBlKSAmJlxuICAgICAgICAhd29ya3RyZWVJbmZvVGV4dFxuICAgICAgKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgdG9vbF91c2VfaWQ6IHRvb2xVc2VJRCxcbiAgICAgICAgICB0eXBlOiAndG9vbF9yZXN1bHQnLFxuICAgICAgICAgIGNvbnRlbnQ6IGNvbnRlbnRPck1hcmtlcixcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdG9vbF91c2VfaWQ6IHRvb2xVc2VJRCxcbiAgICAgICAgdHlwZTogJ3Rvb2xfcmVzdWx0JyxcbiAgICAgICAgY29udGVudDogW1xuICAgICAgICAgIC4uLmNvbnRlbnRPck1hcmtlcixcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgICAgICB0ZXh0OiBgYWdlbnRJZDogJHtkYXRhLmFnZW50SWR9ICh1c2UgU2VuZE1lc3NhZ2Ugd2l0aCB0bzogJyR7ZGF0YS5hZ2VudElkfScgdG8gY29udGludWUgdGhpcyBhZ2VudCkke3dvcmt0cmVlSW5mb1RleHR9XG48dXNhZ2U+dG90YWxfdG9rZW5zOiAke2RhdGEudG90YWxUb2tlbnN9XG50b29sX3VzZXM6ICR7ZGF0YS50b3RhbFRvb2xVc2VDb3VudH1cbmR1cmF0aW9uX21zOiAke2RhdGEudG90YWxEdXJhdGlvbk1zfTwvdXNhZ2U+YCxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfVxuICAgIH1cbiAgICBkYXRhIHNhdGlzZmllcyBuZXZlclxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBVbmV4cGVjdGVkIGFnZW50IHRvb2wgcmVzdWx0IHN0YXR1czogJHsoZGF0YSBhcyB7IHN0YXR1czogc3RyaW5nIH0pLnN0YXR1c31gLFxuICAgIClcbiAgfSxcbiAgcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UsXG4gIHJlbmRlclRvb2xVc2VNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlVGFnLFxuICByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlUmVqZWN0ZWRNZXNzYWdlLFxuICByZW5kZXJUb29sVXNlRXJyb3JNZXNzYWdlLFxuICByZW5kZXJHcm91cGVkVG9vbFVzZTogcmVuZGVyR3JvdXBlZEFnZW50VG9vbFVzZSxcbn0gc2F0aXNmaWVzIFRvb2xEZWY8SW5wdXRTY2hlbWEsIE91dHB1dCwgUHJvZ3Jlc3M+KVxuXG5mdW5jdGlvbiByZXNvbHZlVGVhbU5hbWUoXG4gIGlucHV0OiB7IHRlYW1fbmFtZT86IHN0cmluZyB9LFxuICBhcHBTdGF0ZTogeyB0ZWFtQ29udGV4dD86IHsgdGVhbU5hbWU6IHN0cmluZyB9IH0sXG4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAoIWlzQWdlbnRTd2FybXNFbmFibGVkKCkpIHJldHVybiB1bmRlZmluZWRcbiAgcmV0dXJuIGlucHV0LnRlYW1fbmFtZSB8fCBhcHBTdGF0ZS50ZWFtQ29udGV4dD8udGVhbU5hbWVcbn1cbiJdLCJtYXBwaW5ncyI6IkFBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsT0FBTyxLQUFLQyxLQUFLLE1BQU0sT0FBTztBQUM5QixTQUFTQyxTQUFTLEVBQUUsS0FBS0MsT0FBTyxFQUFFQyxlQUFlLFFBQVEsYUFBYTtBQUN0RSxjQUNFQyxPQUFPLElBQUlDLFdBQVcsRUFDdEJDLHFCQUFxQixRQUNoQixzQkFBc0I7QUFDN0IsU0FBU0Msc0JBQXNCLFFBQVEsNkJBQTZCO0FBQ3BFLFNBQVNDLENBQUMsUUFBUSxRQUFRO0FBQzFCLFNBQ0VDLDBCQUEwQixFQUMxQkMsbUNBQW1DLFFBQzlCLDBCQUEwQjtBQUNqQyxTQUNFQyxpQ0FBaUMsRUFDakNDLGVBQWUsUUFDViw0QkFBNEI7QUFDbkMsU0FBU0MsaUJBQWlCLFFBQVEsc0NBQXNDO0FBQ3hFLFNBQVNDLHVCQUF1QixRQUFRLDZDQUE2QztBQUNyRixTQUFTQyxtQ0FBbUMsUUFBUSx3Q0FBd0M7QUFDNUYsU0FDRSxLQUFLQyww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