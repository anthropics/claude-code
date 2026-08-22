import { feature } from 'bun:bundle';
import type { ContentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources';
import { randomUUID } from 'crypto';
import { setPromptId } from 'src/bootstrap/state.js';
import { builtInCommandNames, type Command, type CommandBase, findCommand, getCommand, getCommandName, hasCommand, type PromptCommand } from 'src/commands.js';
import { NO_CONTENT_MESSAGE } from 'src/constants/messages.js';
import type { SetToolJSXFn, ToolUseContext } from 'src/Tool.js';
import type { AssistantMessage, AttachmentMessage, Message, NormalizedUserMessage, ProgressMessage, UserMessage } from 'src/types/message.js';
import { addInvokedSkill, getSessionId } from '../../bootstrap/state.js';
import { COMMAND_MESSAGE_TAG, COMMAND_NAME_TAG } from '../../constants/xml.js';
import type { CanUseToolFn } from '../../hooks/useCanUseTool.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED, logEvent } from '../../services/analytics/index.js';
import { getDumpPromptsPath } from '../../services/api/dumpPrompts.js';
import { buildPostCompactMessages } from '../../services/compact/compact.js';
import { resetMicrocompactState } from '../../services/compact/microCompact.js';
import type { Progress as AgentProgress } from '../../tools/AgentTool/AgentTool.js';
import { runAgent } from '../../tools/AgentTool/runAgent.js';
import { renderToolUseProgressMessage } from '../../tools/AgentTool/UI.js';
import type { CommandResultDisplay } from '../../types/command.js';
import { createAbortController } from '../abortController.js';
import { getAgentContext } from '../agentContext.js';
import { createAttachmentMessage, getAttachmentMessages } from '../attachments.js';
import { logForDebugging } from '../debug.js';
import { isEnvTruthy } from '../envUtils.js';
import { AbortError, MalformedCommandError } from '../errors.js';
import { getDisplayPath } from '../file.js';
import { extractResultText, prepareForkedCommandContext } from '../forkedAgent.js';
import { getFsImplementation } from '../fsOperations.js';
import { isFullscreenEnvEnabled } from '../fullscreen.js';
import { toArray } from '../generators.js';
import { registerSkillHooks } from '../hooks/registerSkillHooks.js';
import { logError } from '../log.js';
import { enqueuePendingNotification } from '../messageQueueManager.js';
import { createCommandInputMessage, createSyntheticUserCaveatMessage, createSystemMessage, createUserInterruptionMessage, createUserMessage, formatCommandInputTags, isCompactBoundaryMessage, isSystemLocalCommandMessage, normalizeMessages, prepareUserContent } from '../messages.js';
import type { ModelAlias } from '../model/aliases.js';
import { parseToolListFromCLI } from '../permissions/permissionSetup.js';
import { hasPermissionsToUseTool } from '../permissions/permissions.js';
import { isOfficialMarketplaceName, parsePluginIdentifier } from '../plugins/pluginIdentifier.js';
import { isRestrictedToPluginOnly, isSourceAdminTrusted } from '../settings/pluginOnlyPolicy.js';
import { parseSlashCommand } from '../slashCommandParsing.js';
import { sleep } from '../sleep.js';
import { recordSkillUsage } from '../suggestions/skillUsageTracking.js';
import { logOTelEvent, redactIfDisabled } from '../telemetry/events.js';
import { buildPluginCommandTelemetryFields } from '../telemetry/pluginTelemetry.js';
import { getAssistantMessageContentLength } from '../tokens.js';
import { createAgentId } from '../uuid.js';
import { getWorkload } from '../workloadContext.js';
import type { ProcessUserInputBaseResult, ProcessUserInputContext } from './processUserInput.js';
type SlashCommandResult = ProcessUserInputBaseResult & {
  command: Command;
};

// Poll interval and deadline for MCP settle before launching a background
// forked subagent. MCP servers typically connect within 1-3s of startup;
// 10s headroom covers slow SSE handshakes.
const MCP_SETTLE_POLL_MS = 200;
const MCP_SETTLE_TIMEOUT_MS = 10_000;

/**
 * Executes a slash command with context: fork in a sub-agent.
 */
async function executeForkedSlashCommand(command: CommandBase & PromptCommand, args: string, context: ProcessUserInputContext, precedingInputBlocks: ContentBlockParam[], setToolJSX: SetToolJSXFn, canUseTool: CanUseToolFn): Promise<SlashCommandResult> {
  const agentId = createAgentId();
  const pluginMarketplace = command.pluginInfo ? parsePluginIdentifier(command.pluginInfo.repository).marketplace : undefined;
  logEvent('tengu_slash_command_forked', {
    command_name: command.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    invocation_trigger: 'user-slash' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    ...(command.pluginInfo && {
      _PROTO_plugin_name: command.pluginInfo.pluginManifest.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      ...(pluginMarketplace && {
        _PROTO_marketplace_name: pluginMarketplace as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED
      }),
      ...buildPluginCommandTelemetryFields(command.pluginInfo)
    })
  });
  const {
    skillContent,
    modifiedGetAppState,
    baseAgent,
    promptMessages
  } = await prepareForkedCommandContext(command, args, context);

  // Merge skill's effort into the agent definition so runAgent applies it
  const agentDefinition = command.effort !== undefined ? {
    ...baseAgent,
    effort: command.effort
  } : baseAgent;
  logForDebugging(`Executing forked slash command /${command.name} with agent ${agentDefinition.agentType}`);

  // Assistant mode: fire-and-forget. Launch subagent in background, return
  // immediately, re-enqueue the result as an isMeta prompt when done.
  // Without this, N scheduled tasks on startup = N serial (subagent + main
  // agent turn) cycles blocking user input. With this, N subagents run in
  // parallel and results trickle into the queue as they finish.
  //
  // Gated on kairosEnabled (not CLAUDE_CODE_BRIEF) because the closed loop
  // depends on assistant-mode invariants: scheduled_tasks.json exists,
  // the main agent knows to pipe results through SendUserMessage, and
  // isMeta prompts are hidden. Outside assistant mode, context:fork commands
  // are user-invoked skills (/commit etc.) that should run synchronously
  // with the progress UI.
  if (feature('KAIROS') && (await context.getAppState()).kairosEnabled) {
    // Standalone abortController — background subagents survive main-thread
    // ESC (same policy as AgentTool's async path). They're cron-driven; if
    // killed mid-run they just re-fire on the next schedule.
    const bgAbortController = createAbortController();
    const commandName = getCommandName(command);

    // Workload: handlePromptSubmit wraps the entire turn in runWithWorkload
    // (AsyncLocalStorage). ALS context is captured when this `void` fires
    // and survives every await inside — isolated from the parent's
    // continuation. The detached closure's runAgent calls see the cron tag
    // automatically. We still capture the value here ONLY for the
    // re-enqueued result prompt below: that second turn runs in a fresh
    // handlePromptSubmit → fresh runWithWorkload boundary (which always
    // establishes a new context, even for `undefined`) → so it needs its
    // own QueuedCommand.workload tag to preserve attribution.
    const spawnTimeWorkload = getWorkload();

    // Re-enter the queue as a hidden prompt. isMeta: hides from queue
    // preview + placeholder + transcript. skipSlashCommands: prevents
    // re-parsing if the result text happens to start with '/'. When
    // drained, this triggers a main-agent turn that sees the result and
    // decides whether to SendUserMessage. Propagate workload so that
    // second turn is also tagged.
    const enqueueResult = (value: string): void => enqueuePendingNotification({
      value,
      mode: 'prompt',
      priority: 'later',
      isMeta: true,
      skipSlashCommands: true,
      workload: spawnTimeWorkload
    });
    void (async () => {
      // Wait for MCP servers to settle. Scheduled tasks fire at startup and
      // all N drain within ~1ms (since we return immediately), capturing
      // context.options.tools before MCP connects. The sync path
      // accidentally avoided this — tasks serialized, so task N's drain
      // happened after task N-1's 30s run, by which time MCP was up.
      // Poll until no 'pending' clients remain, then refresh.
      const deadline = Date.now() + MCP_SETTLE_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const s = context.getAppState();
        if (!s.mcp.clients.some(c => c.type === 'pending')) break;
        await sleep(MCP_SETTLE_POLL_MS);
      }
      const freshTools = context.options.refreshTools?.() ?? context.options.tools;
      const agentMessages: Message[] = [];
      for await (const message of runAgent({
        agentDefinition,
        promptMessages,
        toolUseContext: {
          ...context,
          getAppState: modifiedGetAppState,
          abortController: bgAbortController
        },
        canUseTool,
        isAsync: true,
        querySource: 'agent:custom',
        model: command.model as ModelAlias | undefined,
        availableTools: freshTools,
        override: {
          agentId
        }
      })) {
        agentMessages.push(message);
      }
      const resultText = extractResultText(agentMessages, 'Command completed');
      logForDebugging(`Background forked command /${commandName} completed (agent ${agentId})`);
      enqueueResult(`<scheduled-task-result command="/${commandName}">\n${resultText}\n</scheduled-task-result>`);
    })().catch(err => {
      logError(err);
      enqueueResult(`<scheduled-task-result command="/${commandName}" status="failed">\n${err instanceof Error ? err.message : String(err)}\n</scheduled-task-result>`);
    });

    // Nothing to render, nothing to query — the background runner re-enters
    // the queue on its own schedule.
    return {
      messages: [],
      shouldQuery: false,
      command
    };
  }

  // Collect messages from the forked agent
  const agentMessages: Message[] = [];

  // Build progress messages for the agent progress UI
  const progressMessages: ProgressMessage<AgentProgress>[] = [];
  const parentToolUseID = `forked-command-${command.name}`;
  let toolUseCounter = 0;

  // Helper to create a progress message from an agent message
  const createProgressMessage = (message: AssistantMessage | NormalizedUserMessage): ProgressMessage<AgentProgress> => {
    toolUseCounter++;
    return {
      type: 'progress',
      data: {
        message,
        type: 'agent_progress',
        prompt: skillContent,
        agentId
      },
      parentToolUseID,
      toolUseID: `${parentToolUseID}-${toolUseCounter}`,
      timestamp: new Date().toISOString(),
      uuid: randomUUID()
    };
  };

  // Helper to update progress display using agent progress UI
  const updateProgress = (): void => {
    setToolJSX({
      jsx: renderToolUseProgressMessage(progressMessages, {
        tools: context.options.tools,
        verbose: false
      }),
      shouldHidePromptInput: false,
      shouldContinueAnimation: true,
      showSpinner: true
    });
  };

  // Show initial "Initializing…" state
  updateProgress();

  // Run the sub-agent
  try {
    for await (const message of runAgent({
      agentDefinition,
      promptMessages,
      toolUseContext: {
        ...context,
        getAppState: modifiedGetAppState
      },
      canUseTool,
      isAsync: false,
      querySource: 'agent:custom',
      model: command.model as ModelAlias | undefined,
      availableTools: context.options.tools
    })) {
      agentMessages.push(message);
      const normalizedNew = normalizeMessages([message]);

      // Add progress message for assistant messages (which contain tool uses)
      if (message.type === 'assistant') {
        // Increment token count in spinner for assistant messages
        const contentLength = getAssistantMessageContentLength(message);
        if (contentLength > 0) {
          context.setResponseLength(len => len + contentLength);
        }
        const normalizedMsg = normalizedNew[0];
        if (normalizedMsg && normalizedMsg.type === 'assistant') {
          progressMessages.push(createProgressMessage(message));
          updateProgress();
        }
      }

      // Add progress message for user messages (which contain tool results)
      if (message.type === 'user') {
        const normalizedMsg = normalizedNew[0];
        if (normalizedMsg && normalizedMsg.type === 'user') {
          progressMessages.push(createProgressMessage(normalizedMsg));
          updateProgress();
        }
      }
    }
  } finally {
    // Clear the progress display
    setToolJSX(null);
  }
  let resultText = extractResultText(agentMessages, 'Command completed');
  logForDebugging(`Forked slash command /${command.name} completed with agent ${agentId}`);

  // Prepend debug log for ant users so it appears inside the command output
  if ("external" === 'ant') {
    resultText = `[ANT-ONLY] API calls: ${getDisplayPath(getDumpPromptsPath(agentId))}\n${resultText}`;
  }

  // Return the result as a user message (simulates the agent's output)
  const messages: UserMessage[] = [createUserMessage({
    content: prepareUserContent({
      inputString: `/${getCommandName(command)} ${args}`.trim(),
      precedingInputBlocks
    })
  }), createUserMessage({
    content: `<local-command-stdout>\n${resultText}\n</local-command-stdout>`
  })];
  return {
    messages,
    shouldQuery: false,
    command,
    resultText
  };
}

/**
 * Determines if a string looks like a valid command name.
 * Valid command names only contain letters, numbers, colons, hyphens, and underscores.
 *
 * @param commandName - The potential command name to check
 * @returns true if it looks like a command name, false if it contains non-command characters
 */
export function looksLikeCommand(commandName: string): boolean {
  // Command names should only contain [a-zA-Z0-9:_-]
  // If it contains other characters, it's probably a file path or other input
  return !/[^a-zA-Z0-9:\-_]/.test(commandName);
}
export async function processSlashCommand(inputString: string, precedingInputBlocks: ContentBlockParam[], imageContentBlocks: ContentBlockParam[], attachmentMessages: AttachmentMessage[], context: ProcessUserInputContext, setToolJSX: SetToolJSXFn, uuid?: string, isAlreadyProcessing?: boolean, canUseTool?: CanUseToolFn): Promise<ProcessUserInputBaseResult> {
  const parsed = parseSlashCommand(inputString);
  if (!parsed) {
    logEvent('tengu_input_slash_missing', {});
    const errorMessage = 'Commands are in the form `/command [args]`';
    return {
      messages: [createSyntheticUserCaveatMessage(), ...attachmentMessages, createUserMessage({
        content: prepareUserContent({
          inputString: errorMessage,
          precedingInputBlocks
        })
      })],
      shouldQuery: false,
      resultText: errorMessage
    };
  }
  const {
    commandName,
    args: parsedArgs,
    isMcp
  } = parsed;
  const sanitizedCommandName = isMcp ? 'mcp' : !builtInCommandNames().has(commandName) ? 'custom' : commandName;

  // Check if it's a real command before processing
  if (!hasCommand(commandName, context.options.commands)) {
    // Check if this looks like a command name vs a file path or other input
    // Also check if it's an actual file path that exists
    let isFilePath = false;
    try {
      await getFsImplementation().stat(`/${commandName}`);
      isFilePath = true;
    } catch {
      // Not a file path — treat as command name
    }
    if (looksLikeCommand(commandName) && !isFilePath) {
      logEvent('tengu_input_slash_invalid', {
        input: commandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
      const unknownMessage = `Unknown skill: ${commandName}`;
      return {
        messages: [createSyntheticUserCaveatMessage(), ...attachmentMessages, createUserMessage({
          content: prepareUserContent({
            inputString: unknownMessage,
            precedingInputBlocks
          })
        }),
        // gh-32591: preserve args so the user can copy/resubmit without
        // retyping. System warning is UI-only (filtered before API).
        ...(parsedArgs ? [createSystemMessage(`Args from unknown skill: ${parsedArgs}`, 'warning')] : [])],
        shouldQuery: false,
        resultText: unknownMessage
      };
    }
    const promptId = randomUUID();
    setPromptId(promptId);
    logEvent('tengu_input_prompt', {});
    // Log user prompt event for OTLP
    void logOTelEvent('user_prompt', {
      prompt_length: String(inputString.length),
      prompt: redactIfDisabled(inputString),
      'prompt.id': promptId
    });
    return {
      messages: [createUserMessage({
        content: prepareUserContent({
          inputString,
          precedingInputBlocks
        }),
        uuid: uuid
      }), ...attachmentMessages],
      shouldQuery: true
    };
  }

  // Track slash command usage for feature discovery

  const {
    messages: newMessages,
    shouldQuery: messageShouldQuery,
    allowedTools,
    model,
    effort,
    command: returnedCommand,
    resultText,
    nextInput,
    submitNextInput
  } = await getMessagesForSlashCommand(commandName, parsedArgs, setToolJSX, context, precedingInputBlocks, imageContentBlocks, isAlreadyProcessing, canUseTool, uuid);

  // Local slash commands that skip messages
  if (newMessages.length === 0) {
    const eventData: Record<string, boolean | number | undefined> = {
      input: sanitizedCommandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    };

    // Add plugin metadata if this is a plugin command
    if (returnedCommand.type === 'prompt' && returnedCommand.pluginInfo) {
      const {
        pluginManifest,
        repository
      } = returnedCommand.pluginInfo;
      const {
        marketplace
      } = parsePluginIdentifier(repository);
      const isOfficial = isOfficialMarketplaceName(marketplace);
      // _PROTO_* routes to PII-tagged plugin_name/marketplace_name BQ columns
      // (unredacted, all users); plugin_name/plugin_repository stay in
      // additional_metadata as redacted variants for general-access dashboards.
      eventData._PROTO_plugin_name = pluginManifest.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED;
      if (marketplace) {
        eventData._PROTO_marketplace_name = marketplace as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED;
      }
      eventData.plugin_repository = (isOfficial ? repository : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
      eventData.plugin_name = (isOfficial ? pluginManifest.name : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
      if (isOfficial && pluginManifest.version) {
        eventData.plugin_version = pluginManifest.version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
      }
      Object.assign(eventData, buildPluginCommandTelemetryFields(returnedCommand.pluginInfo));
    }
    logEvent('tengu_input_command', {
      ...eventData,
      invocation_trigger: 'user-slash' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...("external" === 'ant' && {
        skill_name: commandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        ...(returnedCommand.type === 'prompt' && {
          skill_source: returnedCommand.source as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        }),
        ...(returnedCommand.loadedFrom && {
          skill_loaded_from: returnedCommand.loadedFrom as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        }),
        ...(returnedCommand.kind && {
          skill_kind: returnedCommand.kind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
        })
      })
    });
    return {
      messages: [],
      shouldQuery: false,
      model,
      nextInput,
      submitNextInput
    };
  }

  // For invalid commands, preserve both the user message and error
  if (newMessages.length === 2 && newMessages[1]!.type === 'user' && typeof newMessages[1]!.message.content === 'string' && newMessages[1]!.message.content.startsWith('Unknown command:')) {
    // Don't log as invalid if it looks like a common file path
    const looksLikeFilePath = inputString.startsWith('/var') || inputString.startsWith('/tmp') || inputString.startsWith('/private');
    if (!looksLikeFilePath) {
      logEvent('tengu_input_slash_invalid', {
        input: commandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      });
    }
    return {
      messages: [createSyntheticUserCaveatMessage(), ...newMessages],
      shouldQuery: messageShouldQuery,
      allowedTools,
      model
    };
  }

  // A valid command
  const eventData: Record<string, boolean | number | undefined> = {
    input: sanitizedCommandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
  };

  // Add plugin metadata if this is a plugin command
  if (returnedCommand.type === 'prompt' && returnedCommand.pluginInfo) {
    const {
      pluginManifest,
      repository
    } = returnedCommand.pluginInfo;
    const {
      marketplace
    } = parsePluginIdentifier(repository);
    const isOfficial = isOfficialMarketplaceName(marketplace);
    eventData._PROTO_plugin_name = pluginManifest.name as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED;
    if (marketplace) {
      eventData._PROTO_marketplace_name = marketplace as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED;
    }
    eventData.plugin_repository = (isOfficial ? repository : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    eventData.plugin_name = (isOfficial ? pluginManifest.name : 'third-party') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    if (isOfficial && pluginManifest.version) {
      eventData.plugin_version = pluginManifest.version as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS;
    }
    Object.assign(eventData, buildPluginCommandTelemetryFields(returnedCommand.pluginInfo));
  }
  logEvent('tengu_input_command', {
    ...eventData,
    invocation_trigger: 'user-slash' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    ...("external" === 'ant' && {
      skill_name: commandName as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      ...(returnedCommand.type === 'prompt' && {
        skill_source: returnedCommand.source as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      ...(returnedCommand.loadedFrom && {
        skill_loaded_from: returnedCommand.loadedFrom as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      }),
      ...(returnedCommand.kind && {
        skill_kind: returnedCommand.kind as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
      })
    })
  });

  // Check if this is a compact result which handle their own synthetic caveat message ordering
  const isCompactResult = newMessages.length > 0 && newMessages[0] && isCompactBoundaryMessage(newMessages[0]);
  return {
    messages: messageShouldQuery || newMessages.every(isSystemLocalCommandMessage) || isCompactResult ? newMessages : [createSyntheticUserCaveatMessage(), ...newMessages],
    shouldQuery: messageShouldQuery,
    allowedTools,
    model,
    effort,
    resultText,
    nextInput,
    submitNextInput
  };
}
async function getMessagesForSlashCommand(commandName: string, args: string, setToolJSX: SetToolJSXFn, context: ProcessUserInputContext, precedingInputBlocks: ContentBlockParam[], imageContentBlocks: ContentBlockParam[], _isAlreadyProcessing?: boolean, canUseTool?: CanUseToolFn, uuid?: string): Promise<SlashCommandResult> {
  const command = getCommand(commandName, context.options.commands);

  // Track skill usage for ranking (only for prompt commands that are user-invocable)
  if (command.type === 'prompt' && command.userInvocable !== false) {
    recordSkillUsage(commandName);
  }

  // Check if the command is user-invocable
  // Skills with userInvocable === false can only be invoked by the model via SkillTool
  if (command.userInvocable === false) {
    return {
      messages: [createUserMessage({
        content: prepareUserContent({
          inputString: `/${commandName}`,
          precedingInputBlocks
        })
      }), createUserMessage({
        content: `This skill can only be invoked by Claude, not directly by users. Ask Claude to use the "${commandName}" skill for you.`
      })],
      shouldQuery: false,
      command
    };
  }
  try {
    switch (command.type) {
      case 'local-jsx':
        {
          return new Promise<SlashCommandResult>(resolve => {
            let doneWasCalled = false;
            const onDone = (result?: string, options?: {
              display?: CommandResultDisplay;
              shouldQuery?: boolean;
              metaMessages?: string[];
              nextInput?: string;
              submitNextInput?: boolean;
            }) => {
              doneWasCalled = true;
              // If display is 'skip', don't add any messages to the conversation
              if (options?.display === 'skip') {
                void resolve({
                  messages: [],
                  shouldQuery: false,
                  command,
                  nextInput: options?.nextInput,
                  submitNextInput: options?.submitNextInput
                });
                return;
              }

              // Meta messages are model-visible but hidden from the user
              const metaMessages = (options?.metaMessages ?? []).map((content: string) => createUserMessage({
                content,
                isMeta: true
              }));

              // In fullscreen the command just showed as a centered modal
              // pane — the transient notification is enough feedback. The
              // "❯ /config" + "⎿ dismissed" transcript entries are
              // type:system subtype:local_command (user-visible but NOT sent
              // to the model), so skipping them doesn't affect model context.
              // Outside fullscreen keep them so scrollback shows what ran.
              // Only skip "<Name> dismissed" modal-close notifications —
              // commands that early-exit before showing a modal (/ultraplan
              // usage, /rename, /proactive) use display:system for actual
              // output that must reach the transcript.
              const skipTranscript = isFullscreenEnvEnabled() && typeof result === 'string' && result.endsWith(' dismissed');
              void resolve({
                messages: options?.display === 'system' ? skipTranscript ? metaMessages : [createCommandInputMessage(formatCommandInput(command, args)), createCommandInputMessage(`<local-command-stdout>${result}</local-command-stdout>`), ...metaMessages] : [createUserMessage({
                  content: prepareUserContent({
                    inputString: formatCommandInput(command, args),
                    precedingInputBlocks
                  })
                }), result ? createUserMessage({
                  content: `<local-command-stdout>${result}</local-command-stdout>`
                }) : createUserMessage({
                  content: `<local-command-stdout>${NO_CONTENT_MESSAGE}</local-command-stdout>`
                }), ...metaMessages],
                shouldQuery: options?.shouldQuery ?? false,
                command,
                nextInput: options?.nextInput,
                submitNextInput: options?.submitNextInput
              });
            };
            void command.load().then(mod => mod.call(onDone, {
              ...context,
              canUseTool
            }, args)).then(jsx => {
              if (jsx == null) return;
              if (context.options.isNonInteractiveSession) {
                void resolve({
                  messages: [],
                  shouldQuery: false,
                  command
                });
                return;
              }
              // Guard: if onDone fired during mod.call() (early-exit path
              // that calls onDone then returns JSX), skip setToolJSX. This
              // chain is fire-and-forget — the outer Promise resolves when
              // onDone is called, so executeUserInput may have already run
              // its setToolJSX({clearLocalJSX: true}) before we get here.
              // Setting isLocalJSXCommand after clear leaves it stuck true,
              // blocking useQueueProcessor and TextInput focus.
              if (doneWasCalled) return;
              setToolJSX({
                jsx,
                shouldHidePromptInput: true,
                showSpinner: false,
                isLocalJSXCommand: true,
                isImmediate: command.immediate === true
              });
            }).catch(e => {
              // If load()/call() throws and onDone never fired, the outer
              // Promise hangs forever, leaving queryGuard stuck in
              // 'dispatching' and deadlocking the queue processor.
              logError(e);
              if (doneWasCalled) return;
              doneWasCalled = true;
              setToolJSX({
                jsx: null,
                shouldHidePromptInput: false,
                clearLocalJSX: true
              });
              void resolve({
                messages: [],
                shouldQuery: false,
                command
              });
            });
          });
        }
      case 'local':
        {
          const displayArgs = command.isSensitive && args.trim() ? '***' : args;
          const userMessage = createUserMessage({
            content: prepareUserContent({
              inputString: formatCommandInput(command, displayArgs),
              precedingInputBlocks
            })
          });
          try {
            const syntheticCaveatMessage = createSyntheticUserCaveatMessage();
            const mod = await command.load();
            const result = await mod.call(args, context);
            if (result.type === 'skip') {
              return {
                messages: [],
                shouldQuery: false,
                command
              };
            }

            // Use discriminated union to handle different result types
            if (result.type === 'compact') {
              // Append slash command messages to messagesToKeep so that
              // attachments and hookResults come after user messages
              const slashCommandMessages = [syntheticCaveatMessage, userMessage, ...(result.displayText ? [createUserMessage({
                content: `<local-command-stdout>${result.displayText}</local-command-stdout>`,
                // --resume looks at latest timestamp message to determine which message to resume from
                // This is a perf optimization to avoid having to recaculcate the leaf node every time
                // Since we're creating a bunch of synthetic messages for compact, it's important to set
                // the timestamp of the last message to be slightly after the current time
                // This is mostly important for sdk / -p mode
                timestamp: new Date(Date.now() + 100).toISOString()
              })] : [])];
              const compactionResultWithSlashMessages = {
                ...result.compactionResult,
                messagesToKeep: [...(result.compactionResult.messagesToKeep ?? []), ...slashCommandMessages]
              };
              // Reset microcompact state since full compact replaces all
              // messages — old tool IDs are no longer relevant. Budget state
              // (on toolUseContext) needs no reset: stale entries are inert
              // (UUIDs never repeat, so they're never looked up).
              resetMicrocompactState();
              return {
                messages: buildPostCompactMessages(compactionResultWithSlashMessages),
                shouldQuery: false,
                command
              };
            }

            // Text result — use system message so it doesn't render as a user bubble
            return {
              messages: [userMessage, createCommandInputMessage(`<local-command-stdout>${result.value}</local-command-stdout>`)],
              shouldQuery: false,
              command,
              resultText: result.value
            };
          } catch (e) {
            logError(e);
            return {
              messages: [userMessage, createCommandInputMessage(`<local-command-stderr>${String(e)}</local-command-stderr>`)],
              shouldQuery: false,
              command
            };
          }
        }
      case 'prompt':
        {
          try {
            // Check if command should run as forked sub-agent
            if (command.context === 'fork') {
              return await executeForkedSlashCommand(command, args, context, precedingInputBlocks, setToolJSX, canUseTool ?? hasPermissionsToUseTool);
            }
            return await getMessagesForPromptSlashCommand(command, args, context, precedingInputBlocks, imageContentBlocks, uuid);
          } catch (e) {
            // Handle abort errors specially to show proper "Interrupted" message
            if (e instanceof AbortError) {
              return {
                messages: [createUserMessage({
                  content: prepareUserContent({
                    inputString: formatCommandInput(command, args),
                    precedingInputBlocks
                  })
                }), createUserInterruptionMessage({
                  toolUse: false
                })],
                shouldQuery: false,
                command
              };
            }
            return {
              messages: [createUserMessage({
                content: prepareUserContent({
                  inputString: formatCommandInput(command, args),
                  precedingInputBlocks
                })
              }), createUserMessage({
                content: `<local-command-stderr>${String(e)}</local-command-stderr>`
              })],
              shouldQuery: false,
              command
            };
          }
        }
    }
  } catch (e) {
    if (e instanceof MalformedCommandError) {
      return {
        messages: [createUserMessage({
          content: prepareUserContent({
            inputString: e.message,
            precedingInputBlocks
          })
        })],
        shouldQuery: false,
        command
      };
    }
    throw e;
  }
}
function formatCommandInput(command: CommandBase, args: string): string {
  return formatCommandInputTags(getCommandName(command), args);
}

/**
 * Formats the metadata for a skill loading message.
 * Used by the Skill tool and for subagent skill preloading.
 */
export function formatSkillLoadingMetadata(skillName: string, _progressMessage: string = 'loading'): string {
  // Use skill name only - UserCommandMessage renders as "Skill(name)"
  return [`<${COMMAND_MESSAGE_TAG}>${skillName}</${COMMAND_MESSAGE_TAG}>`, `<${COMMAND_NAME_TAG}>${skillName}</${COMMAND_NAME_TAG}>`, `<skill-format>true</skill-format>`].join('\n');
}

/**
 * Formats the metadata for a slash command loading message.
 */
function formatSlashCommandLoadingMetadata(commandName: string, args?: string): string {
  return [`<${COMMAND_MESSAGE_TAG}>${commandName}</${COMMAND_MESSAGE_TAG}>`, `<${COMMAND_NAME_TAG}>/${commandName}</${COMMAND_NAME_TAG}>`, args ? `<command-args>${args}</command-args>` : null].filter(Boolean).join('\n');
}

/**
 * Formats the loading metadata for a command (skill or slash command).
 * User-invocable skills use slash command format (/name), while model-only
 * skills use the skill format ("The X skill is running").
 */
function formatCommandLoadingMetadata(command: CommandBase & PromptCommand, args?: string): string {
  // Use command.name (the qualified name including plugin prefix, e.g.
  // "product-management:feature-spec") instead of userFacingName() which may
  // strip the plugin prefix via displayName fallback.
  // User-invocable skills should show as /command-name like regular slash commands
  if (command.userInvocable !== false) {
    return formatSlashCommandLoadingMetadata(command.name, args);
  }
  // Model-only skills (userInvocable: false) show as "The X skill is running"
  if (command.loadedFrom === 'skills' || command.loadedFrom === 'plugin' || command.loadedFrom === 'mcp') {
    return formatSkillLoadingMetadata(command.name, command.progressMessage);
  }
  return formatSlashCommandLoadingMetadata(command.name, args);
}
export async function processPromptSlashCommand(commandName: string, args: string, commands: Command[], context: ToolUseContext, imageContentBlocks: ContentBlockParam[] = []): Promise<SlashCommandResult> {
  const command = findCommand(commandName, commands);
  if (!command) {
    throw new MalformedCommandError(`Unknown command: ${commandName}`);
  }
  if (command.type !== 'prompt') {
    throw new Error(`Unexpected ${command.type} command. Expected 'prompt' command. Use /${commandName} directly in the main conversation.`);
  }
  return getMessagesForPromptSlashCommand(command, args, context, [], imageContentBlocks);
}
async function getMessagesForPromptSlashCommand(command: CommandBase & PromptCommand, args: string, context: ToolUseContext, precedingInputBlocks: ContentBlockParam[] = [], imageContentBlocks: ContentBlockParam[] = [], uuid?: string): Promise<SlashCommandResult> {
  // In coordinator mode (main thread only), skip loading the full skill content
  // and permissions. The coordinator only has Agent + TaskStop tools, so the
  // skill content and allowedTools are useless. Instead, send a brief summary
  // telling the coordinator how to delegate this skill to a worker.
  //
  // Workers run in-process and inherit CLAUDE_CODE_COORDINATOR_MODE from the
  // parent env, so we also check !context.agentId: agentId is only set for
  // subagents, letting workers fall through to getPromptForCommand and receive
  // the real skill content when they invoke the Skill tool.
  if (feature('COORDINATOR_MODE') && isEnvTruthy(process.env.CLAUDE_CODE_COORDINATOR_MODE) && !context.agentId) {
    const metadata = formatCommandLoadingMetadata(command, args);
    const parts: string[] = [`Skill "/${command.name}" is available for workers.`];
    if (command.description) {
      parts.push(`Description: ${command.description}`);
    }
    if (command.whenToUse) {
      parts.push(`When to use: ${command.whenToUse}`);
    }
    const skillAllowedTools = command.allowedTools ?? [];
    if (skillAllowedTools.length > 0) {
      parts.push(`This skill grants workers additional tool permissions: ${skillAllowedTools.join(', ')}`);
    }
    parts.push(`\nInstruct a worker to use this skill by including "Use the /${command.name} skill" in your Agent prompt. The worker has access to the Skill tool and will receive the skill's content and permissions when it invokes it.`);
    const summaryContent: ContentBlockParam[] = [{
      type: 'text',
      text: parts.join('\n')
    }];
    return {
      messages: [createUserMessage({
        content: metadata,
        uuid
      }), createUserMessage({
        content: summaryContent,
        isMeta: true
      })],
      shouldQuery: true,
      model: command.model,
      effort: command.effort,
      command
    };
  }
  const result = await command.getPromptForCommand(args, context);

  // Register skill hooks if defined. Under ["hooks"]-only (skills not locked),
  // user skills still load and reach this point — block hook REGISTRATION here
  // where source is known. Mirrors the agent frontmatter gate in runAgent.ts.
  const hooksAllowedForThisSkill = !isRestrictedToPluginOnly('hooks') || isSourceAdminTrusted(command.source);
  if (command.hooks && hooksAllowedForThisSkill) {
    const sessionId = getSessionId();
    registerSkillHooks(context.setAppState, sessionId, command.hooks, command.name, command.type === 'prompt' ? command.skillRoot : undefined);
  }

  // Record skill invocation for compaction preservation, scoped by agent context.
  // Skills are tagged with their agentId so only skills belonging to the current
  // agent are restored during compaction (preventing cross-agent leaks).
  const skillPath = command.source ? `${command.source}:${command.name}` : command.name;
  const skillContent = result.filter((b): b is TextBlockParam => b.type === 'text').map(b => b.text).join('\n\n');
  addInvokedSkill(command.name, skillPath, skillContent, getAgentContext()?.agentId ?? null);
  const metadata = formatCommandLoadingMetadata(command, args);
  const additionalAllowedTools = parseToolListFromCLI(command.allowedTools ?? []);

  // Create content for the main message, including any pasted images
  const mainMessageContent: ContentBlockParam[] = imageContentBlocks.length > 0 || precedingInputBlocks.length > 0 ? [...imageContentBlocks, ...precedingInputBlocks, ...result] : result;

  // Extract attachments from command arguments (@-mentions, MCP resources,
  // agent mentions in SKILL.md). skipSkillDiscovery prevents the SKILL.md
  // content itself from triggering discovery — it's meta-content, not user
  // intent, and a large SKILL.md (e.g. 110KB) would fire chunked AKI queries
  // adding seconds of latency to every skill invocation.
  const attachmentMessages = await toArray(getAttachmentMessages(result.filter((block): block is TextBlockParam => block.type === 'text').map(block => block.text).join(' '), context, null, [],
  // queuedCommands - handled by query.ts for mid-turn attachments
  context.messages, 'repl_main_thread', {
    skipSkillDiscovery: true
  }));
  const messages = [createUserMessage({
    content: metadata,
    uuid
  }), createUserMessage({
    content: mainMessageContent,
    isMeta: true
  }), ...attachmentMessages, createAttachmentMessage({
    type: 'command_permissions',
    allowedTools: additionalAllowedTools,
    model: command.model
  })];
  return {
    messages,
    shouldQuery: true,
    allowedTools: additionalAllowedTools,
    model: command.model,
    effort: command.effort,
    command
  };
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiQ29udGVudEJsb2NrUGFyYW0iLCJUZXh0QmxvY2tQYXJhbSIsInJhbmRvbVVVSUQiLCJzZXRQcm9tcHRJZCIsImJ1aWx0SW5Db21tYW5kTmFtZXMiLCJDb21tYW5kIiwiQ29tbWFuZEJhc2UiLCJmaW5kQ29tbWFuZCIsImdldENvbW1hbmQiLCJnZXRDb21tYW5kTmFtZSIsImhhc0NvbW1hbmQiLCJQcm9tcHRDb21tYW5kIiwiTk9fQ09OVEVOVF9NRVNTQUdFIiwiU2V0VG9vbEpTWEZuIiwiVG9vbFVzZUNvbnRleHQiLCJBc3Npc3RhbnRNZXNzYWdlIiwiQXR0YWNobWVudE1lc3NhZ2UiLCJNZXNzYWdlIiwiTm9ybWFsaXplZFVzZXJNZXNzYWdlIiwiUHJvZ3Jlc3NNZXNzYWdlIiwiVXNlck1lc3NhZ2UiLCJhZGRJbnZva2VkU2tpbGwiLCJnZXRTZXNzaW9uSWQiLCJDT01NQU5EX01FU1NBR0VfVEFHIiwiQ09NTUFORF9OQU1FX1RBRyIsIkNhblVzZVRvb2xGbiIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfUElJX1RBR0dFRCIsImxvZ0V2ZW50IiwiZ2V0RHVtcFByb21wdHNQYXRoIiwiYnVpbGRQb3N0Q29tcGFjdE1lc3NhZ2VzIiwicmVzZXRNaWNyb2NvbXBhY3RTdGF0ZSIsIlByb2dyZXNzIiwiQWdlbnRQcm9ncmVzcyIsInJ1bkFnZW50IiwicmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZSIsIkNvbW1hbmRSZXN1bHREaXNwbGF5IiwiY3JlYXRlQWJvcnRDb250cm9sbGVyIiwiZ2V0QWdlbnRDb250ZXh0IiwiY3JlYXRlQXR0YWNobWVudE1lc3NhZ2UiLCJnZXRBdHRhY2htZW50TWVzc2FnZXMiLCJsb2dGb3JEZWJ1Z2dpbmciLCJpc0VudlRydXRoeSIsIkFib3J0RXJyb3IiLCJNYWxmb3JtZWRDb21tYW5kRXJyb3IiLCJnZXREaXNwbGF5UGF0aCIsImV4dHJhY3RSZXN1bHRUZXh0IiwicHJlcGFyZUZvcmtlZENvbW1hbmRDb250ZXh0IiwiZ2V0RnNJbXBsZW1lbnRhdGlvbiIsImlzRnVsbHNjcmVlbkVudkVuYWJsZWQiLCJ0b0FycmF5IiwicmVnaXN0ZXJTa2lsbEhvb2tzIiwibG9nRXJyb3IiLCJlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiIsImNyZWF0ZUNvbW1hbmRJbnB1dE1lc3NhZ2UiLCJjcmVhdGVTeW50aGV0aWNVc2VyQ2F2ZWF0TWVzc2FnZSIsImNyZWF0ZVN5c3RlbU1lc3NhZ2UiLCJjcmVhdGVVc2VySW50ZXJydXB0aW9uTWVzc2FnZSIsImNyZWF0ZVVzZXJNZXNzYWdlIiwiZm9ybWF0Q29tbWFuZElucHV0VGFncyIsImlzQ29tcGFjdEJvdW5kYXJ5TWVzc2FnZSIsImlzU3lzdGVtTG9jYWxDb21tYW5kTWVzc2FnZSIsIm5vcm1hbGl6ZU1lc3NhZ2VzIiwicHJlcGFyZVVzZXJDb250ZW50IiwiTW9kZWxBbGlhcyIsInBhcnNlVG9vbExpc3RGcm9tQ0xJIiwiaGFzUGVybWlzc2lvbnNUb1VzZVRvb2wiLCJpc09mZmljaWFsTWFya2V0cGxhY2VOYW1lIiwicGFyc2VQbHVnaW5JZGVudGlmaWVyIiwiaXNSZXN0cmljdGVkVG9QbHVnaW5Pbmx5IiwiaXNTb3VyY2VBZG1pblRydXN0ZWQiLCJwYXJzZVNsYXNoQ29tbWFuZCIsInNsZWVwIiwicmVjb3JkU2tpbGxVc2FnZSIsImxvZ09UZWxFdmVudCIsInJlZGFjdElmRGlzYWJsZWQiLCJidWlsZFBsdWdpbkNvbW1hbmRUZWxlbWV0cnlGaWVsZHMiLCJnZXRBc3Npc3RhbnRNZXNzYWdlQ29udGVudExlbmd0aCIsImNyZWF0ZUFnZW50SWQiLCJnZXRXb3JrbG9hZCIsIlByb2Nlc3NVc2VySW5wdXRCYXNlUmVzdWx0IiwiUHJvY2Vzc1VzZXJJbnB1dENvbnRleHQiLCJTbGFzaENvbW1hbmRSZXN1bHQiLCJjb21tYW5kIiwiTUNQX1NFVFRMRV9QT0xMX01TIiwiTUNQX1NFVFRMRV9USU1FT1VUX01TIiwiZXhlY3V0ZUZvcmtlZFNsYXNoQ29tbWFuZCIsImFyZ3MiLCJjb250ZXh0IiwicHJlY2VkaW5nSW5wdXRCbG9ja3MiLCJzZXRUb29sSlNYIiwiY2FuVXNlVG9vbCIsIlByb21pc2UiLCJhZ2VudElkIiwicGx1Z2luTWFya2V0cGxhY2UiLCJwbHVnaW5JbmZvIiwicmVwb3NpdG9yeSIsIm1hcmtldHBsYWNlIiwidW5kZWZpbmVkIiwiY29tbWFuZF9uYW1lIiwibmFtZSIsImludm9jYXRpb25fdHJpZ2dlciIsIl9QUk9UT19wbHVnaW5fbmFtZSIsInBsdWdpbk1hbmlmZXN0IiwiX1BST1RPX21hcmtldHBsYWNlX25hbWUiLCJza2lsbENvbnRlbnQiLCJtb2RpZmllZEdldEFwcFN0YXRlIiwiYmFzZUFnZW50IiwicHJvbXB0TWVzc2FnZXMiLCJhZ2VudERlZmluaXRpb24iLCJlZmZvcnQiLCJhZ2VudFR5cGUiLCJnZXRBcHBTdGF0ZSIsImthaXJvc0VuYWJsZWQiLCJiZ0Fib3J0Q29udHJvbGxlciIsImNvbW1hbmROYW1lIiwic3Bhd25UaW1lV29ya2xvYWQiLCJlbnF1ZXVlUmVzdWx0IiwidmFsdWUiLCJtb2RlIiwicHJpb3JpdHkiLCJpc01ldGEiLCJza2lwU2xhc2hDb21tYW5kcyIsIndvcmtsb2FkIiwiZGVhZGxpbmUiLCJEYXRlIiwibm93IiwicyIsIm1jcCIsImNsaWVudHMiLCJzb21lIiwiYyIsInR5cGUiLCJmcmVzaFRvb2xzIiwib3B0aW9ucyIsInJlZnJlc2hUb29scyIsInRvb2xzIiwiYWdlbnRNZXNzYWdlcyIsIm1lc3NhZ2UiLCJ0b29sVXNlQ29udGV4dCIsImFib3J0Q29udHJvbGxlciIsImlzQXN5bmMiLCJxdWVyeVNvdXJjZSIsIm1vZGVsIiwiYXZhaWxhYmxlVG9vbHMiLCJvdmVycmlkZSIsInB1c2giLCJyZXN1bHRUZXh0IiwiY2F0Y2giLCJlcnIiLCJFcnJvciIsIlN0cmluZyIsIm1lc3NhZ2VzIiwic2hvdWxkUXVlcnkiLCJwcm9ncmVzc01lc3NhZ2VzIiwicGFyZW50VG9vbFVzZUlEIiwidG9vbFVzZUNvdW50ZXIiLCJjcmVhdGVQcm9ncmVzc01lc3NhZ2UiLCJkYXRhIiwicHJvbXB0IiwidG9vbFVzZUlEIiwidGltZXN0YW1wIiwidG9JU09TdHJpbmciLCJ1dWlkIiwidXBkYXRlUHJvZ3Jlc3MiLCJqc3giLCJ2ZXJib3NlIiwic2hvdWxkSGlkZVByb21wdElucHV0Iiwic2hvdWxkQ29udGludWVBbmltYXRpb24iLCJzaG93U3Bpbm5lciIsIm5vcm1hbGl6ZWROZXciLCJjb250ZW50TGVuZ3RoIiwic2V0UmVzcG9uc2VMZW5ndGgiLCJsZW4iLCJub3JtYWxpemVkTXNnIiwiY29udGVudCIsImlucHV0U3RyaW5nIiwidHJpbSIsImxvb2tzTGlrZUNvbW1hbmQiLCJ0ZXN0IiwicHJvY2Vzc1NsYXNoQ29tbWFuZCIsImltYWdlQ29udGVudEJsb2NrcyIsImF0dGFjaG1lbnRNZXNzYWdlcyIsImlzQWxyZWFkeVByb2Nlc3NpbmciLCJwYXJzZWQiLCJlcnJvck1lc3NhZ2UiLCJwYXJzZWRBcmdzIiwiaXNNY3AiLCJzYW5pdGl6ZWRDb21tYW5kTmFtZSIsImhhcyIsImNvbW1hbmRzIiwiaXNGaWxlUGF0aCIsInN0YXQiLCJpbnB1dCIsInVua25vd25NZXNzYWdlIiwicHJvbXB0SWQiLCJwcm9tcHRfbGVuZ3RoIiwibGVuZ3RoIiwibmV3TWVzc2FnZXMiLCJtZXNzYWdlU2hvdWxkUXVlcnkiLCJhbGxvd2VkVG9vbHMiLCJyZXR1cm5lZENvbW1hbmQiLCJuZXh0SW5wdXQiLCJzdWJtaXROZXh0SW5wdXQiLCJnZXRNZXNzYWdlc0ZvclNsYXNoQ29tbWFuZCIsImV2ZW50RGF0YSIsIlJlY29yZCIsImlzT2ZmaWNpYWwiLCJwbHVnaW5fcmVwb3NpdG9yeSIsInBsdWdpbl9uYW1lIiwidmVyc2lvbiIsInBsdWdpbl92ZXJzaW9uIiwiT2JqZWN0IiwiYXNzaWduIiwic2tpbGxfbmFtZSIsInNraWxsX3NvdXJjZSIsInNvdXJjZSIsImxvYWRlZEZyb20iLCJza2lsbF9sb2FkZWRfZnJvbSIsImtpbmQiLCJza2lsbF9raW5kIiwic3RhcnRzV2l0aCIsImxvb2tzTGlrZUZpbGVQYXRoIiwiaXNDb21wYWN0UmVzdWx0IiwiZXZlcnkiLCJfaXNBbHJlYWR5UHJvY2Vzc2luZyIsInVzZXJJbnZvY2FibGUiLCJyZXNvbHZlIiwiZG9uZVdhc0NhbGxlZCIsIm9uRG9uZSIsInJlc3VsdCIsImRpc3BsYXkiLCJtZXRhTWVzc2FnZXMiLCJtYXAiLCJza2lwVHJhbnNjcmlwdCIsImVuZHNXaXRoIiwiZm9ybWF0Q29tbWFuZElucHV0IiwibG9hZCIsInRoZW4iLCJtb2QiLCJjYWxsIiwiaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24iLCJpc0xvY2FsSlNYQ29tbWFuZCIsImlzSW1tZWRpYXRlIiwiaW1tZWRpYXRlIiwiZSIsImNsZWFyTG9jYWxKU1giLCJkaXNwbGF5QXJncyIsImlzU2Vuc2l0aXZlIiwidXNlck1lc3NhZ2UiLCJzeW50aGV0aWNDYXZlYXRNZXNzYWdlIiwic2xhc2hDb21tYW5kTWVzc2FnZXMiLCJkaXNwbGF5VGV4dCIsImNvbXBhY3Rpb25SZXN1bHRXaXRoU2xhc2hNZXNzYWdlcyIsImNvbXBhY3Rpb25SZXN1bHQiLCJtZXNzYWdlc1RvS2VlcCIsImdldE1lc3NhZ2VzRm9yUHJvbXB0U2xhc2hDb21tYW5kIiwidG9vbFVzZSIsImZvcm1hdFNraWxsTG9hZGluZ01ldGFkYXRhIiwic2tpbGxOYW1lIiwiX3Byb2dyZXNzTWVzc2FnZSIsImpvaW4iLCJmb3JtYXRTbGFzaENvbW1hbmRMb2FkaW5nTWV0YWRhdGEiLCJmaWx0ZXIiLCJCb29sZWFuIiwiZm9ybWF0Q29tbWFuZExvYWRpbmdNZXRhZGF0YSIsInByb2dyZXNzTWVzc2FnZSIsInByb2Nlc3NQcm9tcHRTbGFzaENvbW1hbmQiLCJwcm9jZXNzIiwiZW52IiwiQ0xBVURFX0NPREVfQ09PUkRJTkFUT1JfTU9ERSIsIm1ldGFkYXRhIiwicGFydHMiLCJkZXNjcmlwdGlvbiIsIndoZW5Ub1VzZSIsInNraWxsQWxsb3dlZFRvb2xzIiwic3VtbWFyeUNvbnRlbnQiLCJ0ZXh0IiwiZ2V0UHJvbXB0Rm9yQ29tbWFuZCIsImhvb2tzQWxsb3dlZEZvclRoaXNTa2lsbCIsImhvb2tzIiwic2Vzc2lvbklkIiwic2V0QXBwU3RhdGUiLCJza2lsbFJvb3QiLCJza2lsbFBhdGgiLCJiIiwiYWRkaXRpb25hbEFsbG93ZWRUb29scyIsIm1haW5NZXNzYWdlQ29udGVudCIsImJsb2NrIiwic2tpcFNraWxsRGlzY292ZXJ5Il0sInNvdXJjZXMiOlsicHJvY2Vzc1NsYXNoQ29tbWFuZC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgdHlwZSB7XG4gIENvbnRlbnRCbG9ja1BhcmFtLFxuICBUZXh0QmxvY2tQYXJhbSxcbn0gZnJvbSAnQGFudGhyb3BpYy1haS9zZGsvcmVzb3VyY2VzJ1xuaW1wb3J0IHsgcmFuZG9tVVVJRCB9IGZyb20gJ2NyeXB0bydcbmltcG9ydCB7IHNldFByb21wdElkIH0gZnJvbSAnc3JjL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7XG4gIGJ1aWx0SW5Db21tYW5kTmFtZXMsXG4gIHR5cGUgQ29tbWFuZCxcbiAgdHlwZSBDb21tYW5kQmFzZSxcbiAgZmluZENvbW1hbmQsXG4gIGdldENvbW1hbmQsXG4gIGdldENvbW1hbmROYW1lLFxuICBoYXNDb21tYW5kLFxuICB0eXBlIFByb21wdENvbW1hbmQsXG59IGZyb20gJ3NyYy9jb21tYW5kcy5qcydcbmltcG9ydCB7IE5PX0NPTlRFTlRfTUVTU0FHRSB9IGZyb20gJ3NyYy9jb25zdGFudHMvbWVzc2FnZXMuanMnXG5pbXBvcnQgdHlwZSB7IFNldFRvb2xKU1hGbiwgVG9vbFVzZUNvbnRleHQgfSBmcm9tICdzcmMvVG9vbC5qcydcbmltcG9ydCB0eXBlIHtcbiAgQXNzaXN0YW50TWVzc2FnZSxcbiAgQXR0YWNobWVudE1lc3NhZ2UsXG4gIE1lc3NhZ2UsXG4gIE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSxcbiAgUHJvZ3Jlc3NNZXNzYWdlLFxuICBVc2VyTWVzc2FnZSxcbn0gZnJvbSAnc3JjL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBhZGRJbnZva2VkU2tpbGwsIGdldFNlc3Npb25JZCB9IGZyb20gJy4uLy4uL2Jvb3RzdHJhcC9zdGF0ZS5qcydcbmltcG9ydCB7IENPTU1BTkRfTUVTU0FHRV9UQUcsIENPTU1BTkRfTkFNRV9UQUcgfSBmcm9tICcuLi8uLi9jb25zdGFudHMveG1sLmpzJ1xuaW1wb3J0IHR5cGUgeyBDYW5Vc2VUb29sRm4gfSBmcm9tICcuLi8uLi9ob29rcy91c2VDYW5Vc2VUb29sLmpzJ1xuaW1wb3J0IHtcbiAgdHlwZSBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19QSUlfVEFHR0VELFxuICBsb2dFdmVudCxcbn0gZnJvbSAnLi4vLi4vc2VydmljZXMvYW5hbHl0aWNzL2luZGV4LmpzJ1xuaW1wb3J0IHsgZ2V0RHVtcFByb21wdHNQYXRoIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXBpL2R1bXBQcm9tcHRzLmpzJ1xuaW1wb3J0IHsgYnVpbGRQb3N0Q29tcGFjdE1lc3NhZ2VzIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvY29tcGFjdC9jb21wYWN0LmpzJ1xuaW1wb3J0IHsgcmVzZXRNaWNyb2NvbXBhY3RTdGF0ZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2NvbXBhY3QvbWljcm9Db21wYWN0LmpzJ1xuaW1wb3J0IHR5cGUgeyBQcm9ncmVzcyBhcyBBZ2VudFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vdG9vbHMvQWdlbnRUb29sL0FnZW50VG9vbC5qcydcbmltcG9ydCB7IHJ1bkFnZW50IH0gZnJvbSAnLi4vLi4vdG9vbHMvQWdlbnRUb29sL3J1bkFnZW50LmpzJ1xuaW1wb3J0IHsgcmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZSB9IGZyb20gJy4uLy4uL3Rvb2xzL0FnZW50VG9vbC9VSS5qcydcbmltcG9ydCB0eXBlIHsgQ29tbWFuZFJlc3VsdERpc3BsYXkgfSBmcm9tICcuLi8uLi90eXBlcy9jb21tYW5kLmpzJ1xuaW1wb3J0IHsgY3JlYXRlQWJvcnRDb250cm9sbGVyIH0gZnJvbSAnLi4vYWJvcnRDb250cm9sbGVyLmpzJ1xuaW1wb3J0IHsgZ2V0QWdlbnRDb250ZXh0IH0gZnJvbSAnLi4vYWdlbnRDb250ZXh0LmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlQXR0YWNobWVudE1lc3NhZ2UsXG4gIGdldEF0dGFjaG1lbnRNZXNzYWdlcyxcbn0gZnJvbSAnLi4vYXR0YWNobWVudHMuanMnXG5pbXBvcnQgeyBsb2dGb3JEZWJ1Z2dpbmcgfSBmcm9tICcuLi9kZWJ1Zy5qcydcbmltcG9ydCB7IGlzRW52VHJ1dGh5IH0gZnJvbSAnLi4vZW52VXRpbHMuanMnXG5pbXBvcnQgeyBBYm9ydEVycm9yLCBNYWxmb3JtZWRDb21tYW5kRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMuanMnXG5pbXBvcnQgeyBnZXREaXNwbGF5UGF0aCB9IGZyb20gJy4uL2ZpbGUuanMnXG5pbXBvcnQge1xuICBleHRyYWN0UmVzdWx0VGV4dCxcbiAgcHJlcGFyZUZvcmtlZENvbW1hbmRDb250ZXh0LFxufSBmcm9tICcuLi9mb3JrZWRBZ2VudC5qcydcbmltcG9ydCB7IGdldEZzSW1wbGVtZW50YXRpb24gfSBmcm9tICcuLi9mc09wZXJhdGlvbnMuanMnXG5pbXBvcnQgeyBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIH0gZnJvbSAnLi4vZnVsbHNjcmVlbi5qcydcbmltcG9ydCB7IHRvQXJyYXkgfSBmcm9tICcuLi9nZW5lcmF0b3JzLmpzJ1xuaW1wb3J0IHsgcmVnaXN0ZXJTa2lsbEhvb2tzIH0gZnJvbSAnLi4vaG9va3MvcmVnaXN0ZXJTa2lsbEhvb2tzLmpzJ1xuaW1wb3J0IHsgbG9nRXJyb3IgfSBmcm9tICcuLi9sb2cuanMnXG5pbXBvcnQgeyBlbnF1ZXVlUGVuZGluZ05vdGlmaWNhdGlvbiB9IGZyb20gJy4uL21lc3NhZ2VRdWV1ZU1hbmFnZXIuanMnXG5pbXBvcnQge1xuICBjcmVhdGVDb21tYW5kSW5wdXRNZXNzYWdlLFxuICBjcmVhdGVTeW50aGV0aWNVc2VyQ2F2ZWF0TWVzc2FnZSxcbiAgY3JlYXRlU3lzdGVtTWVzc2FnZSxcbiAgY3JlYXRlVXNlckludGVycnVwdGlvbk1lc3NhZ2UsXG4gIGNyZWF0ZVVzZXJNZXNzYWdlLFxuICBmb3JtYXRDb21tYW5kSW5wdXRUYWdzLFxuICBpc0NvbXBhY3RCb3VuZGFyeU1lc3NhZ2UsXG4gIGlzU3lzdGVtTG9jYWxDb21tYW5kTWVzc2FnZSxcbiAgbm9ybWFsaXplTWVzc2FnZXMsXG4gIHByZXBhcmVVc2VyQ29udGVudCxcbn0gZnJvbSAnLi4vbWVzc2FnZXMuanMnXG5pbXBvcnQgdHlwZSB7IE1vZGVsQWxpYXMgfSBmcm9tICcuLi9tb2RlbC9hbGlhc2VzLmpzJ1xuaW1wb3J0IHsgcGFyc2VUb29sTGlzdEZyb21DTEkgfSBmcm9tICcuLi9wZXJtaXNzaW9ucy9wZXJtaXNzaW9uU2V0dXAuanMnXG5pbXBvcnQgeyBoYXNQZXJtaXNzaW9uc1RvVXNlVG9vbCB9IGZyb20gJy4uL3Blcm1pc3Npb25zL3Blcm1pc3Npb25zLmpzJ1xuaW1wb3J0IHtcbiAgaXNPZmZpY2lhbE1hcmtldHBsYWNlTmFtZSxcbiAgcGFyc2VQbHVnaW5JZGVudGlmaWVyLFxufSBmcm9tICcuLi9wbHVnaW5zL3BsdWdpbklkZW50aWZpZXIuanMnXG5pbXBvcnQge1xuICBpc1Jlc3RyaWN0ZWRUb1BsdWdpbk9ubHksXG4gIGlzU291cmNlQWRtaW5UcnVzdGVkLFxufSBmcm9tICcuLi9zZXR0aW5ncy9wbHVnaW5Pbmx5UG9saWN5LmpzJ1xuaW1wb3J0IHsgcGFyc2VTbGFzaENvbW1hbmQgfSBmcm9tICcuLi9zbGFzaENvbW1hbmRQYXJzaW5nLmpzJ1xuaW1wb3J0IHsgc2xlZXAgfSBmcm9tICcuLi9zbGVlcC5qcydcbmltcG9ydCB7IHJlY29yZFNraWxsVXNhZ2UgfSBmcm9tICcuLi9zdWdnZXN0aW9ucy9za2lsbFVzYWdlVHJhY2tpbmcuanMnXG5pbXBvcnQgeyBsb2dPVGVsRXZlbnQsIHJlZGFjdElmRGlzYWJsZWQgfSBmcm9tICcuLi90ZWxlbWV0cnkvZXZlbnRzLmpzJ1xuaW1wb3J0IHsgYnVpbGRQbHVnaW5Db21tYW5kVGVsZW1ldHJ5RmllbGRzIH0gZnJvbSAnLi4vdGVsZW1ldHJ5L3BsdWdpblRlbGVtZXRyeS5qcydcbmltcG9ydCB7IGdldEFzc2lzdGFudE1lc3NhZ2VDb250ZW50TGVuZ3RoIH0gZnJvbSAnLi4vdG9rZW5zLmpzJ1xuaW1wb3J0IHsgY3JlYXRlQWdlbnRJZCB9IGZyb20gJy4uL3V1aWQuanMnXG5pbXBvcnQgeyBnZXRXb3JrbG9hZCB9IGZyb20gJy4uL3dvcmtsb2FkQ29udGV4dC5qcydcbmltcG9ydCB0eXBlIHtcbiAgUHJvY2Vzc1VzZXJJbnB1dEJhc2VSZXN1bHQsXG4gIFByb2Nlc3NVc2VySW5wdXRDb250ZXh0LFxufSBmcm9tICcuL3Byb2Nlc3NVc2VySW5wdXQuanMnXG5cbnR5cGUgU2xhc2hDb21tYW5kUmVzdWx0ID0gUHJvY2Vzc1VzZXJJbnB1dEJhc2VSZXN1bHQgJiB7XG4gIGNvbW1hbmQ6IENvbW1hbmRcbn1cblxuLy8gUG9sbCBpbnRlcnZhbCBhbmQgZGVhZGxpbmUgZm9yIE1DUCBzZXR0bGUgYmVmb3JlIGxhdW5jaGluZyBhIGJhY2tncm91bmRcbi8vIGZvcmtlZCBzdWJhZ2VudC4gTUNQIHNlcnZlcnMgdHlwaWNhbGx5IGNvbm5lY3Qgd2l0aGluIDEtM3Mgb2Ygc3RhcnR1cDtcbi8vIDEwcyBoZWFkcm9vbSBjb3ZlcnMgc2xvdyBTU0UgaGFuZHNoYWtlcy5cbmNvbnN0IE1DUF9TRVRUTEVfUE9MTF9NUyA9IDIwMFxuY29uc3QgTUNQX1NFVFRMRV9USU1FT1VUX01TID0gMTBfMDAwXG5cbi8qKlxuICogRXhlY3V0ZXMgYSBzbGFzaCBjb21tYW5kIHdpdGggY29udGV4dDogZm9yayBpbiBhIHN1Yi1hZ2VudC5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZUZvcmtlZFNsYXNoQ29tbWFuZChcbiAgY29tbWFuZDogQ29tbWFuZEJhc2UgJiBQcm9tcHRDb21tYW5kLFxuICBhcmdzOiBzdHJpbmcsXG4gIGNvbnRleHQ6IFByb2Nlc3NVc2VySW5wdXRDb250ZXh0LFxuICBwcmVjZWRpbmdJbnB1dEJsb2NrczogQ29udGVudEJsb2NrUGFyYW1bXSxcbiAgc2V0VG9vbEpTWDogU2V0VG9vbEpTWEZuLFxuICBjYW5Vc2VUb29sOiBDYW5Vc2VUb29sRm4sXG4pOiBQcm9taXNlPFNsYXNoQ29tbWFuZFJlc3VsdD4ge1xuICBjb25zdCBhZ2VudElkID0gY3JlYXRlQWdlbnRJZCgpXG5cbiAgY29uc3QgcGx1Z2luTWFya2V0cGxhY2UgPSBjb21tYW5kLnBsdWdpbkluZm9cbiAgICA/IHBhcnNlUGx1Z2luSWRlbnRpZmllcihjb21tYW5kLnBsdWdpbkluZm8ucmVwb3NpdG9yeSkubWFya2V0cGxhY2VcbiAgICA6IHVuZGVmaW5lZFxuICBsb2dFdmVudCgndGVuZ3Vfc2xhc2hfY29tbWFuZF9mb3JrZWQnLCB7XG4gICAgY29tbWFuZF9uYW1lOlxuICAgICAgY29tbWFuZC5uYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgaW52b2NhdGlvbl90cmlnZ2VyOlxuICAgICAgJ3VzZXItc2xhc2gnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgLi4uKGNvbW1hbmQucGx1Z2luSW5mbyAmJiB7XG4gICAgICBfUFJPVE9fcGx1Z2luX25hbWU6IGNvbW1hbmQucGx1Z2luSW5mby5wbHVnaW5NYW5pZmVzdFxuICAgICAgICAubmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfUElJX1RBR0dFRCxcbiAgICAgIC4uLihwbHVnaW5NYXJrZXRwbGFjZSAmJiB7XG4gICAgICAgIF9QUk9UT19tYXJrZXRwbGFjZV9uYW1lOlxuICAgICAgICAgIHBsdWdpbk1hcmtldHBsYWNlIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19QSUlfVEFHR0VELFxuICAgICAgfSksXG4gICAgICAuLi5idWlsZFBsdWdpbkNvbW1hbmRUZWxlbWV0cnlGaWVsZHMoY29tbWFuZC5wbHVnaW5JbmZvKSxcbiAgICB9KSxcbiAgfSlcblxuICBjb25zdCB7IHNraWxsQ29udGVudCwgbW9kaWZpZWRHZXRBcHBTdGF0ZSwgYmFzZUFnZW50LCBwcm9tcHRNZXNzYWdlcyB9ID1cbiAgICBhd2FpdCBwcmVwYXJlRm9ya2VkQ29tbWFuZENvbnRleHQoY29tbWFuZCwgYXJncywgY29udGV4dClcblxuICAvLyBNZXJnZSBza2lsbCdzIGVmZm9ydCBpbnRvIHRoZSBhZ2VudCBkZWZpbml0aW9uIHNvIHJ1bkFnZW50IGFwcGxpZXMgaXRcbiAgY29uc3QgYWdlbnREZWZpbml0aW9uID1cbiAgICBjb21tYW5kLmVmZm9ydCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IHsgLi4uYmFzZUFnZW50LCBlZmZvcnQ6IGNvbW1hbmQuZWZmb3J0IH1cbiAgICAgIDogYmFzZUFnZW50XG5cbiAgbG9nRm9yRGVidWdnaW5nKFxuICAgIGBFeGVjdXRpbmcgZm9ya2VkIHNsYXNoIGNvbW1hbmQgLyR7Y29tbWFuZC5uYW1lfSB3aXRoIGFnZW50ICR7YWdlbnREZWZpbml0aW9uLmFnZW50VHlwZX1gLFxuICApXG5cbiAgLy8gQXNzaXN0YW50IG1vZGU6IGZpcmUtYW5kLWZvcmdldC4gTGF1bmNoIHN1YmFnZW50IGluIGJhY2tncm91bmQsIHJldHVyblxuICAvLyBpbW1lZGlhdGVseSwgcmUtZW5xdWV1ZSB0aGUgcmVzdWx0IGFzIGFuIGlzTWV0YSBwcm9tcHQgd2hlbiBkb25lLlxuICAvLyBXaXRob3V0IHRoaXMsIE4gc2NoZWR1bGVkIHRhc2tzIG9uIHN0YXJ0dXAgPSBOIHNlcmlhbCAoc3ViYWdlbnQgKyBtYWluXG4gIC8vIGFnZW50IHR1cm4pIGN5Y2xlcyBibG9ja2luZyB1c2VyIGlucHV0LiBXaXRoIHRoaXMsIE4gc3ViYWdlbnRzIHJ1biBpblxuICAvLyBwYXJhbGxlbCBhbmQgcmVzdWx0cyB0cmlja2xlIGludG8gdGhlIHF1ZXVlIGFzIHRoZXkgZmluaXNoLlxuICAvL1xuICAvLyBHYXRlZCBvbiBrYWlyb3NFbmFibGVkIChub3QgQ0xBVURFX0NPREVfQlJJRUYpIGJlY2F1c2UgdGhlIGNsb3NlZCBsb29wXG4gIC8vIGRlcGVuZHMgb24gYXNzaXN0YW50LW1vZGUgaW52YXJpYW50czogc2NoZWR1bGVkX3Rhc2tzLmpzb24gZXhpc3RzLFxuICAvLyB0aGUgbWFpbiBhZ2VudCBrbm93cyB0byBwaXBlIHJlc3VsdHMgdGhyb3VnaCBTZW5kVXNlck1lc3NhZ2UsIGFuZFxuICAvLyBpc01ldGEgcHJvbXB0cyBhcmUgaGlkZGVuLiBPdXRzaWRlIGFzc2lzdGFudCBtb2RlLCBjb250ZXh0OmZvcmsgY29tbWFuZHNcbiAgLy8gYXJlIHVzZXItaW52b2tlZCBza2lsbHMgKC9jb21taXQgZXRjLikgdGhhdCBzaG91bGQgcnVuIHN5bmNocm9ub3VzbHlcbiAgLy8gd2l0aCB0aGUgcHJvZ3Jlc3MgVUkuXG4gIGlmIChmZWF0dXJlKCdLQUlST1MnKSAmJiAoYXdhaXQgY29udGV4dC5nZXRBcHBTdGF0ZSgpKS5rYWlyb3NFbmFibGVkKSB7XG4gICAgLy8gU3RhbmRhbG9uZSBhYm9ydENvbnRyb2xsZXIg4oCUIGJhY2tncm91bmQgc3ViYWdlbnRzIHN1cnZpdmUgbWFpbi10aHJlYWRcbiAgICAvLyBFU0MgKHNhbWUgcG9saWN5IGFzIEFnZW50VG9vbCdzIGFzeW5jIHBhdGgpLiBUaGV5J3JlIGNyb24tZHJpdmVuOyBpZlxuICAgIC8vIGtpbGxlZCBtaWQtcnVuIHRoZXkganVzdCByZS1maXJlIG9uIHRoZSBuZXh0IHNjaGVkdWxlLlxuICAgIGNvbnN0IGJnQWJvcnRDb250cm9sbGVyID0gY3JlYXRlQWJvcnRDb250cm9sbGVyKClcbiAgICBjb25zdCBjb21tYW5kTmFtZSA9IGdldENvbW1hbmROYW1lKGNvbW1hbmQpXG5cbiAgICAvLyBXb3JrbG9hZDogaGFuZGxlUHJvbXB0U3VibWl0IHdyYXBzIHRoZSBlbnRpcmUgdHVybiBpbiBydW5XaXRoV29ya2xvYWRcbiAgICAvLyAoQXN5bmNMb2NhbFN0b3JhZ2UpLiBBTFMgY29udGV4dCBpcyBjYXB0dXJlZCB3aGVuIHRoaXMgYHZvaWRgIGZpcmVzXG4gICAgLy8gYW5kIHN1cnZpdmVzIGV2ZXJ5IGF3YWl0IGluc2lkZSDigJQgaXNvbGF0ZWQgZnJvbSB0aGUgcGFyZW50J3NcbiAgICAvLyBjb250aW51YXRpb24uIFRoZSBkZXRhY2hlZCBjbG9zdXJlJ3MgcnVuQWdlbnQgY2FsbHMgc2VlIHRoZSBjcm9uIHRhZ1xuICAgIC8vIGF1dG9tYXRpY2FsbHkuIFdlIHN0aWxsIGNhcHR1cmUgdGhlIHZhbHVlIGhlcmUgT05MWSBmb3IgdGhlXG4gICAgLy8gcmUtZW5xdWV1ZWQgcmVzdWx0IHByb21wdCBiZWxvdzogdGhhdCBzZWNvbmQgdHVybiBydW5zIGluIGEgZnJlc2hcbiAgICAvLyBoYW5kbGVQcm9tcHRTdWJtaXQg4oaSIGZyZXNoIHJ1bldpdGhXb3JrbG9hZCBib3VuZGFyeSAod2hpY2ggYWx3YXlzXG4gICAgLy8gZXN0YWJsaXNoZXMgYSBuZXcgY29udGV4dCwgZXZlbiBmb3IgYHVuZGVmaW5lZGApIOKGkiBzbyBpdCBuZWVkcyBpdHNcbiAgICAvLyBvd24gUXVldWVkQ29tbWFuZC53b3JrbG9hZCB0YWcgdG8gcHJlc2VydmUgYXR0cmlidXRpb24uXG4gICAgY29uc3Qgc3Bhd25UaW1lV29ya2xvYWQgPSBnZXRXb3JrbG9hZCgpXG5cbiAgICAvLyBSZS1lbnRlciB0aGUgcXVldWUgYXMgYSBoaWRkZW4gcHJvbXB0LiBpc01ldGE6IGhpZGVzIGZyb20gcXVldWVcbiAgICAvLyBwcmV2aWV3ICsgcGxhY2Vob2xkZXIgKyB0cmFuc2NyaXB0LiBza2lwU2xhc2hDb21tYW5kczogcHJldmVudHNcbiAgICAvLyByZS1wYXJzaW5nIGlmIHRoZSByZXN1bHQgdGV4dCBoYXBwZW5zIHRvIHN0YXJ0IHdpdGggJy8nLiBXaGVuXG4gICAgLy8gZHJhaW5lZCwgdGhpcyB0cmlnZ2VycyBhIG1haW4tYWdlbnQgdHVybiB0aGF0IHNlZXMgdGhlIHJlc3VsdCBhbmRcbiAgICAvLyBkZWNpZGVzIHdoZXRoZXIgdG8gU2VuZFVzZXJNZXNzYWdlLiBQcm9wYWdhdGUgd29ya2xvYWQgc28gdGhhdFxuICAgIC8vIHNlY29uZCB0dXJuIGlzIGFsc28gdGFnZ2VkLlxuICAgIGNvbnN0IGVucXVldWVSZXN1bHQgPSAodmFsdWU6IHN0cmluZyk6IHZvaWQgPT5cbiAgICAgIGVucXVldWVQZW5kaW5nTm90aWZpY2F0aW9uKHtcbiAgICAgICAgdmFsdWUsXG4gICAgICAgIG1vZGU6ICdwcm9tcHQnLFxuICAgICAgICBwcmlvcml0eTogJ2xhdGVyJyxcbiAgICAgICAgaXNNZXRhOiB0cnVlLFxuICAgICAgICBza2lwU2xhc2hDb21tYW5kczogdHJ1ZSxcbiAgICAgICAgd29ya2xvYWQ6IHNwYXduVGltZVdvcmtsb2FkLFxuICAgICAgfSlcblxuICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgIC8vIFdhaXQgZm9yIE1DUCBzZXJ2ZXJzIHRvIHNldHRsZS4gU2NoZWR1bGVkIHRhc2tzIGZpcmUgYXQgc3RhcnR1cCBhbmRcbiAgICAgIC8vIGFsbCBOIGRyYWluIHdpdGhpbiB+MW1zIChzaW5jZSB3ZSByZXR1cm4gaW1tZWRpYXRlbHkpLCBjYXB0dXJpbmdcbiAgICAgIC8vIGNvbnRleHQub3B0aW9ucy50b29scyBiZWZvcmUgTUNQIGNvbm5lY3RzLiBUaGUgc3luYyBwYXRoXG4gICAgICAvLyBhY2NpZGVudGFsbHkgYXZvaWRlZCB0aGlzIOKAlCB0YXNrcyBzZXJpYWxpemVkLCBzbyB0YXNrIE4ncyBkcmFpblxuICAgICAgLy8gaGFwcGVuZWQgYWZ0ZXIgdGFzayBOLTEncyAzMHMgcnVuLCBieSB3aGljaCB0aW1lIE1DUCB3YXMgdXAuXG4gICAgICAvLyBQb2xsIHVudGlsIG5vICdwZW5kaW5nJyBjbGllbnRzIHJlbWFpbiwgdGhlbiByZWZyZXNoLlxuICAgICAgY29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgTUNQX1NFVFRMRV9USU1FT1VUX01TXG4gICAgICB3aGlsZSAoRGF0ZS5ub3coKSA8IGRlYWRsaW5lKSB7XG4gICAgICAgIGNvbnN0IHMgPSBjb250ZXh0LmdldEFwcFN0YXRlKClcbiAgICAgICAgaWYgKCFzLm1jcC5jbGllbnRzLnNvbWUoYyA9PiBjLnR5cGUgPT09ICdwZW5kaW5nJykpIGJyZWFrXG4gICAgICAgIGF3YWl0IHNsZWVwKE1DUF9TRVRUTEVfUE9MTF9NUylcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZyZXNoVG9vbHMgPVxuICAgICAgICBjb250ZXh0Lm9wdGlvbnMucmVmcmVzaFRvb2xzPy4oKSA/PyBjb250ZXh0Lm9wdGlvbnMudG9vbHNcblxuICAgICAgY29uc3QgYWdlbnRNZXNzYWdlczogTWVzc2FnZVtdID0gW11cbiAgICAgIGZvciBhd2FpdCAoY29uc3QgbWVzc2FnZSBvZiBydW5BZ2VudCh7XG4gICAgICAgIGFnZW50RGVmaW5pdGlvbixcbiAgICAgICAgcHJvbXB0TWVzc2FnZXMsXG4gICAgICAgIHRvb2xVc2VDb250ZXh0OiB7XG4gICAgICAgICAgLi4uY29udGV4dCxcbiAgICAgICAgICBnZXRBcHBTdGF0ZTogbW9kaWZpZWRHZXRBcHBTdGF0ZSxcbiAgICAgICAgICBhYm9ydENvbnRyb2xsZXI6IGJnQWJvcnRDb250cm9sbGVyLFxuICAgICAgICB9LFxuICAgICAgICBjYW5Vc2VUb29sLFxuICAgICAgICBpc0FzeW5jOiB0cnVlLFxuICAgICAgICBxdWVyeVNvdXJjZTogJ2FnZW50OmN1c3RvbScsXG4gICAgICAgIG1vZGVsOiBjb21tYW5kLm1vZGVsIGFzIE1vZGVsQWxpYXMgfCB1bmRlZmluZWQsXG4gICAgICAgIGF2YWlsYWJsZVRvb2xzOiBmcmVzaFRvb2xzLFxuICAgICAgICBvdmVycmlkZTogeyBhZ2VudElkIH0sXG4gICAgICB9KSkge1xuICAgICAgICBhZ2VudE1lc3NhZ2VzLnB1c2gobWVzc2FnZSlcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJlc3VsdFRleHQgPSBleHRyYWN0UmVzdWx0VGV4dChhZ2VudE1lc3NhZ2VzLCAnQ29tbWFuZCBjb21wbGV0ZWQnKVxuICAgICAgbG9nRm9yRGVidWdnaW5nKFxuICAgICAgICBgQmFja2dyb3VuZCBmb3JrZWQgY29tbWFuZCAvJHtjb21tYW5kTmFtZX0gY29tcGxldGVkIChhZ2VudCAke2FnZW50SWR9KWAsXG4gICAgICApXG4gICAgICBlbnF1ZXVlUmVzdWx0KFxuICAgICAgICBgPHNjaGVkdWxlZC10YXNrLXJlc3VsdCBjb21tYW5kPVwiLyR7Y29tbWFuZE5hbWV9XCI+XFxuJHtyZXN1bHRUZXh0fVxcbjwvc2NoZWR1bGVkLXRhc2stcmVzdWx0PmAsXG4gICAgICApXG4gICAgfSkoKS5jYXRjaChlcnIgPT4ge1xuICAgICAgbG9nRXJyb3IoZXJyKVxuICAgICAgZW5xdWV1ZVJlc3VsdChcbiAgICAgICAgYDxzY2hlZHVsZWQtdGFzay1yZXN1bHQgY29tbWFuZD1cIi8ke2NvbW1hbmROYW1lfVwiIHN0YXR1cz1cImZhaWxlZFwiPlxcbiR7ZXJyIGluc3RhbmNlb2YgRXJyb3IgPyBlcnIubWVzc2FnZSA6IFN0cmluZyhlcnIpfVxcbjwvc2NoZWR1bGVkLXRhc2stcmVzdWx0PmAsXG4gICAgICApXG4gICAgfSlcblxuICAgIC8vIE5vdGhpbmcgdG8gcmVuZGVyLCBub3RoaW5nIHRvIHF1ZXJ5IOKAlCB0aGUgYmFja2dyb3VuZCBydW5uZXIgcmUtZW50ZXJzXG4gICAgLy8gdGhlIHF1ZXVlIG9uIGl0cyBvd24gc2NoZWR1bGUuXG4gICAgcmV0dXJuIHsgbWVzc2FnZXM6IFtdLCBzaG91bGRRdWVyeTogZmFsc2UsIGNvbW1hbmQgfVxuICB9XG5cbiAgLy8gQ29sbGVjdCBtZXNzYWdlcyBmcm9tIHRoZSBmb3JrZWQgYWdlbnRcbiAgY29uc3QgYWdlbnRNZXNzYWdlczogTWVzc2FnZVtdID0gW11cblxuICAvLyBCdWlsZCBwcm9ncmVzcyBtZXNzYWdlcyBmb3IgdGhlIGFnZW50IHByb2dyZXNzIFVJXG4gIGNvbnN0IHByb2dyZXNzTWVzc2FnZXM6IFByb2dyZXNzTWVzc2FnZTxBZ2VudFByb2dyZXNzPltdID0gW11cbiAgY29uc3QgcGFyZW50VG9vbFVzZUlEID0gYGZvcmtlZC1jb21tYW5kLSR7Y29tbWFuZC5uYW1lfWBcbiAgbGV0IHRvb2xVc2VDb3VudGVyID0gMFxuXG4gIC8vIEhlbHBlciB0byBjcmVhdGUgYSBwcm9ncmVzcyBtZXNzYWdlIGZyb20gYW4gYWdlbnQgbWVzc2FnZVxuICBjb25zdCBjcmVhdGVQcm9ncmVzc01lc3NhZ2UgPSAoXG4gICAgbWVzc2FnZTogQXNzaXN0YW50TWVzc2FnZSB8IE5vcm1hbGl6ZWRVc2VyTWVzc2FnZSxcbiAgKTogUHJvZ3Jlc3NNZXNzYWdlPEFnZW50UHJvZ3Jlc3M+ID0+IHtcbiAgICB0b29sVXNlQ291bnRlcisrXG4gICAgcmV0dXJuIHtcbiAgICAgIHR5cGU6ICdwcm9ncmVzcycsXG4gICAgICBkYXRhOiB7XG4gICAgICAgIG1lc3NhZ2UsXG4gICAgICAgIHR5cGU6ICdhZ2VudF9wcm9ncmVzcycsXG4gICAgICAgIHByb21wdDogc2tpbGxDb250ZW50LFxuICAgICAgICBhZ2VudElkLFxuICAgICAgfSxcbiAgICAgIHBhcmVudFRvb2xVc2VJRCxcbiAgICAgIHRvb2xVc2VJRDogYCR7cGFyZW50VG9vbFVzZUlEfS0ke3Rvb2xVc2VDb3VudGVyfWAsXG4gICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgIHV1aWQ6IHJhbmRvbVVVSUQoKSxcbiAgICB9XG4gIH1cblxuICAvLyBIZWxwZXIgdG8gdXBkYXRlIHByb2dyZXNzIGRpc3BsYXkgdXNpbmcgYWdlbnQgcHJvZ3Jlc3MgVUlcbiAgY29uc3QgdXBkYXRlUHJvZ3Jlc3MgPSAoKTogdm9pZCA9PiB7XG4gICAgc2V0VG9vbEpTWCh7XG4gICAgICBqc3g6IHJlbmRlclRvb2xVc2VQcm9ncmVzc01lc3NhZ2UocHJvZ3Jlc3NNZXNzYWdlcywge1xuICAgICAgICB0b29sczogY29udGV4dC5vcHRpb25zLnRvb2xzLFxuICAgICAgICB2ZXJib3NlOiBmYWxzZSxcbiAgICAgIH0pLFxuICAgICAgc2hvdWxkSGlkZVByb21wdElucHV0OiBmYWxzZSxcbiAgICAgIHNob3VsZENvbnRpbnVlQW5pbWF0aW9uOiB0cnVlLFxuICAgICAgc2hvd1NwaW5uZXI6IHRydWUsXG4gICAgfSlcbiAgfVxuXG4gIC8vIFNob3cgaW5pdGlhbCBcIkluaXRpYWxpemluZ+KAplwiIHN0YXRlXG4gIHVwZGF0ZVByb2dyZXNzKClcblxuICAvLyBSdW4gdGhlIHN1Yi1hZ2VudFxuICB0cnkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgbWVzc2FnZSBvZiBydW5BZ2VudCh7XG4gICAgICBhZ2VudERlZmluaXRpb24sXG4gICAgICBwcm9tcHRNZXNzYWdlcyxcbiAgICAgIHRvb2xVc2VDb250ZXh0OiB7XG4gICAgICAgIC4uLmNvbnRleHQsXG4gICAgICAgIGdldEFwcFN0YXRlOiBtb2RpZmllZEdldEFwcFN0YXRlLFxuICAgICAgfSxcbiAgICAgIGNhblVzZVRvb2wsXG4gICAgICBpc0FzeW5jOiBmYWxzZSxcbiAgICAgIHF1ZXJ5U291cmNlOiAnYWdlbnQ6Y3VzdG9tJyxcbiAgICAgIG1vZGVsOiBjb21tYW5kLm1vZGVsIGFzIE1vZGVsQWxpYXMgfCB1bmRlZmluZWQsXG4gICAgICBhdmFpbGFibGVUb29sczogY29udGV4dC5vcHRpb25zLnRvb2xzLFxuICAgIH0pKSB7XG4gICAgICBhZ2VudE1lc3NhZ2VzLnB1c2gobWVzc2FnZSlcbiAgICAgIGNvbnN0IG5vcm1hbGl6ZWROZXcgPSBub3JtYWxpemVNZXNzYWdlcyhbbWVzc2FnZV0pXG5cbiAgICAgIC8vIEFkZCBwcm9ncmVzcyBtZXNzYWdlIGZvciBhc3Npc3RhbnQgbWVzc2FnZXMgKHdoaWNoIGNvbnRhaW4gdG9vbCB1c2VzKVxuICAgICAgaWYgKG1lc3NhZ2UudHlwZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgICAgLy8gSW5jcmVtZW50IHRva2VuIGNvdW50IGluIHNwaW5uZXIgZm9yIGFzc2lzdGFudCBtZXNzYWdlc1xuICAgICAgICBjb25zdCBjb250ZW50TGVuZ3RoID0gZ2V0QXNzaXN0YW50TWVzc2FnZUNvbnRlbnRMZW5ndGgobWVzc2FnZSlcbiAgICAgICAgaWYgKGNvbnRlbnRMZW5ndGggPiAwKSB7XG4gICAgICAgICAgY29udGV4dC5zZXRSZXNwb25zZUxlbmd0aChsZW4gPT4gbGVuICsgY29udGVudExlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5vcm1hbGl6ZWRNc2cgPSBub3JtYWxpemVkTmV3WzBdXG4gICAgICAgIGlmIChub3JtYWxpemVkTXNnICYmIG5vcm1hbGl6ZWRNc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzLnB1c2goY3JlYXRlUHJvZ3Jlc3NNZXNzYWdlKG1lc3NhZ2UpKVxuICAgICAgICAgIHVwZGF0ZVByb2dyZXNzKClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBZGQgcHJvZ3Jlc3MgbWVzc2FnZSBmb3IgdXNlciBtZXNzYWdlcyAod2hpY2ggY29udGFpbiB0b29sIHJlc3VsdHMpXG4gICAgICBpZiAobWVzc2FnZS50eXBlID09PSAndXNlcicpIHtcbiAgICAgICAgY29uc3Qgbm9ybWFsaXplZE1zZyA9IG5vcm1hbGl6ZWROZXdbMF1cbiAgICAgICAgaWYgKG5vcm1hbGl6ZWRNc2cgJiYgbm9ybWFsaXplZE1zZy50eXBlID09PSAndXNlcicpIHtcbiAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzLnB1c2goY3JlYXRlUHJvZ3Jlc3NNZXNzYWdlKG5vcm1hbGl6ZWRNc2cpKVxuICAgICAgICAgIHVwZGF0ZVByb2dyZXNzKClcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBmaW5hbGx5IHtcbiAgICAvLyBDbGVhciB0aGUgcHJvZ3Jlc3MgZGlzcGxheVxuICAgIHNldFRvb2xKU1gobnVsbClcbiAgfVxuXG4gIGxldCByZXN1bHRUZXh0ID0gZXh0cmFjdFJlc3VsdFRleHQoYWdlbnRNZXNzYWdlcywgJ0NvbW1hbmQgY29tcGxldGVkJylcblxuICBsb2dGb3JEZWJ1Z2dpbmcoXG4gICAgYEZvcmtlZCBzbGFzaCBjb21tYW5kIC8ke2NvbW1hbmQubmFtZX0gY29tcGxldGVkIHdpdGggYWdlbnQgJHthZ2VudElkfWAsXG4gIClcblxuICAvLyBQcmVwZW5kIGRlYnVnIGxvZyBmb3IgYW50IHVzZXJzIHNvIGl0IGFwcGVhcnMgaW5zaWRlIHRoZSBjb21tYW5kIG91dHB1dFxuICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgIHJlc3VsdFRleHQgPSBgW0FOVC1PTkxZXSBBUEkgY2FsbHM6ICR7Z2V0RGlzcGxheVBhdGgoZ2V0RHVtcFByb21wdHNQYXRoKGFnZW50SWQpKX1cXG4ke3Jlc3VsdFRleHR9YFxuICB9XG5cbiAgLy8gUmV0dXJuIHRoZSByZXN1bHQgYXMgYSB1c2VyIG1lc3NhZ2UgKHNpbXVsYXRlcyB0aGUgYWdlbnQncyBvdXRwdXQpXG4gIGNvbnN0IG1lc3NhZ2VzOiBVc2VyTWVzc2FnZVtdID0gW1xuICAgIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgIGNvbnRlbnQ6IHByZXBhcmVVc2VyQ29udGVudCh7XG4gICAgICAgIGlucHV0U3RyaW5nOiBgLyR7Z2V0Q29tbWFuZE5hbWUoY29tbWFuZCl9ICR7YXJnc31gLnRyaW0oKSxcbiAgICAgICAgcHJlY2VkaW5nSW5wdXRCbG9ja3MsXG4gICAgICB9KSxcbiAgICB9KSxcbiAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICBjb250ZW50OiBgPGxvY2FsLWNvbW1hbmQtc3Rkb3V0PlxcbiR7cmVzdWx0VGV4dH1cXG48L2xvY2FsLWNvbW1hbmQtc3Rkb3V0PmAsXG4gICAgfSksXG4gIF1cblxuICByZXR1cm4ge1xuICAgIG1lc3NhZ2VzLFxuICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcbiAgICBjb21tYW5kLFxuICAgIHJlc3VsdFRleHQsXG4gIH1cbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIGEgc3RyaW5nIGxvb2tzIGxpa2UgYSB2YWxpZCBjb21tYW5kIG5hbWUuXG4gKiBWYWxpZCBjb21tYW5kIG5hbWVzIG9ubHkgY29udGFpbiBsZXR0ZXJzLCBudW1iZXJzLCBjb2xvbnMsIGh5cGhlbnMsIGFuZCB1bmRlcnNjb3Jlcy5cbiAqXG4gKiBAcGFyYW0gY29tbWFuZE5hbWUgLSBUaGUgcG90ZW50aWFsIGNvbW1hbmQgbmFtZSB0byBjaGVja1xuICogQHJldHVybnMgdHJ1ZSBpZiBpdCBsb29rcyBsaWtlIGEgY29tbWFuZCBuYW1lLCBmYWxzZSBpZiBpdCBjb250YWlucyBub24tY29tbWFuZCBjaGFyYWN0ZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsb29rc0xpa2VDb21tYW5kKGNvbW1hbmROYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgLy8gQ29tbWFuZCBuYW1lcyBzaG91bGQgb25seSBjb250YWluIFthLXpBLVowLTk6Xy1dXG4gIC8vIElmIGl0IGNvbnRhaW5zIG90aGVyIGNoYXJhY3RlcnMsIGl0J3MgcHJvYmFibHkgYSBmaWxlIHBhdGggb3Igb3RoZXIgaW5wdXRcbiAgcmV0dXJuICEvW15hLXpBLVowLTk6XFwtX10vLnRlc3QoY29tbWFuZE5hbWUpXG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9jZXNzU2xhc2hDb21tYW5kKFxuICBpbnB1dFN0cmluZzogc3RyaW5nLFxuICBwcmVjZWRpbmdJbnB1dEJsb2NrczogQ29udGVudEJsb2NrUGFyYW1bXSxcbiAgaW1hZ2VDb250ZW50QmxvY2tzOiBDb250ZW50QmxvY2tQYXJhbVtdLFxuICBhdHRhY2htZW50TWVzc2FnZXM6IEF0dGFjaG1lbnRNZXNzYWdlW10sXG4gIGNvbnRleHQ6IFByb2Nlc3NVc2VySW5wdXRDb250ZXh0LFxuICBzZXRUb29sSlNYOiBTZXRUb29sSlNYRm4sXG4gIHV1aWQ/OiBzdHJpbmcsXG4gIGlzQWxyZWFkeVByb2Nlc3Npbmc/OiBib29sZWFuLFxuICBjYW5Vc2VUb29sPzogQ2FuVXNlVG9vbEZuLFxuKTogUHJvbWlzZTxQcm9jZXNzVXNlcklucHV0QmFzZVJlc3VsdD4ge1xuICBjb25zdCBwYXJzZWQgPSBwYXJzZVNsYXNoQ29tbWFuZChpbnB1dFN0cmluZylcbiAgaWYgKCFwYXJzZWQpIHtcbiAgICBsb2dFdmVudCgndGVuZ3VfaW5wdXRfc2xhc2hfbWlzc2luZycsIHt9KVxuICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9ICdDb21tYW5kcyBhcmUgaW4gdGhlIGZvcm0gYC9jb21tYW5kIFthcmdzXWAnXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgIGNyZWF0ZVN5bnRoZXRpY1VzZXJDYXZlYXRNZXNzYWdlKCksXG4gICAgICAgIC4uLmF0dGFjaG1lbnRNZXNzYWdlcyxcbiAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgIGNvbnRlbnQ6IHByZXBhcmVVc2VyQ29udGVudCh7XG4gICAgICAgICAgICBpbnB1dFN0cmluZzogZXJyb3JNZXNzYWdlLFxuICAgICAgICAgICAgcHJlY2VkaW5nSW5wdXRCbG9ja3MsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcbiAgICAgIHJlc3VsdFRleHQ6IGVycm9yTWVzc2FnZSxcbiAgICB9XG4gIH1cblxuICBjb25zdCB7IGNvbW1hbmROYW1lLCBhcmdzOiBwYXJzZWRBcmdzLCBpc01jcCB9ID0gcGFyc2VkXG5cbiAgY29uc3Qgc2FuaXRpemVkQ29tbWFuZE5hbWUgPSBpc01jcFxuICAgID8gJ21jcCdcbiAgICA6ICFidWlsdEluQ29tbWFuZE5hbWVzKCkuaGFzKGNvbW1hbmROYW1lKVxuICAgICAgPyAnY3VzdG9tJ1xuICAgICAgOiBjb21tYW5kTmFtZVxuXG4gIC8vIENoZWNrIGlmIGl0J3MgYSByZWFsIGNvbW1hbmQgYmVmb3JlIHByb2Nlc3NpbmdcbiAgaWYgKCFoYXNDb21tYW5kKGNvbW1hbmROYW1lLCBjb250ZXh0Lm9wdGlvbnMuY29tbWFuZHMpKSB7XG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBsb29rcyBsaWtlIGEgY29tbWFuZCBuYW1lIHZzIGEgZmlsZSBwYXRoIG9yIG90aGVyIGlucHV0XG4gICAgLy8gQWxzbyBjaGVjayBpZiBpdCdzIGFuIGFjdHVhbCBmaWxlIHBhdGggdGhhdCBleGlzdHNcbiAgICBsZXQgaXNGaWxlUGF0aCA9IGZhbHNlXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGdldEZzSW1wbGVtZW50YXRpb24oKS5zdGF0KGAvJHtjb21tYW5kTmFtZX1gKVxuICAgICAgaXNGaWxlUGF0aCA9IHRydWVcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8vIE5vdCBhIGZpbGUgcGF0aCDigJQgdHJlYXQgYXMgY29tbWFuZCBuYW1lXG4gICAgfVxuICAgIGlmIChsb29rc0xpa2VDb21tYW5kKGNvbW1hbmROYW1lKSAmJiAhaXNGaWxlUGF0aCkge1xuICAgICAgbG9nRXZlbnQoJ3Rlbmd1X2lucHV0X3NsYXNoX2ludmFsaWQnLCB7XG4gICAgICAgIGlucHV0OlxuICAgICAgICAgIGNvbW1hbmROYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICB9KVxuXG4gICAgICBjb25zdCB1bmtub3duTWVzc2FnZSA9IGBVbmtub3duIHNraWxsOiAke2NvbW1hbmROYW1lfWBcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgY3JlYXRlU3ludGhldGljVXNlckNhdmVhdE1lc3NhZ2UoKSxcbiAgICAgICAgICAuLi5hdHRhY2htZW50TWVzc2FnZXMsXG4gICAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgICAgY29udGVudDogcHJlcGFyZVVzZXJDb250ZW50KHtcbiAgICAgICAgICAgICAgaW5wdXRTdHJpbmc6IHVua25vd25NZXNzYWdlLFxuICAgICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pLFxuICAgICAgICAgIC8vIGdoLTMyNTkxOiBwcmVzZXJ2ZSBhcmdzIHNvIHRoZSB1c2VyIGNhbiBjb3B5L3Jlc3VibWl0IHdpdGhvdXRcbiAgICAgICAgICAvLyByZXR5cGluZy4gU3lzdGVtIHdhcm5pbmcgaXMgVUktb25seSAoZmlsdGVyZWQgYmVmb3JlIEFQSSkuXG4gICAgICAgICAgLi4uKHBhcnNlZEFyZ3NcbiAgICAgICAgICAgID8gW1xuICAgICAgICAgICAgICAgIGNyZWF0ZVN5c3RlbU1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICBgQXJncyBmcm9tIHVua25vd24gc2tpbGw6ICR7cGFyc2VkQXJnc31gLFxuICAgICAgICAgICAgICAgICAgJ3dhcm5pbmcnLFxuICAgICAgICAgICAgICAgICksXG4gICAgICAgICAgICAgIF1cbiAgICAgICAgICAgIDogW10pLFxuICAgICAgICBdLFxuICAgICAgICBzaG91bGRRdWVyeTogZmFsc2UsXG4gICAgICAgIHJlc3VsdFRleHQ6IHVua25vd25NZXNzYWdlLFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHByb21wdElkID0gcmFuZG9tVVVJRCgpXG4gICAgc2V0UHJvbXB0SWQocHJvbXB0SWQpXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X2lucHV0X3Byb21wdCcsIHt9KVxuICAgIC8vIExvZyB1c2VyIHByb21wdCBldmVudCBmb3IgT1RMUFxuICAgIHZvaWQgbG9nT1RlbEV2ZW50KCd1c2VyX3Byb21wdCcsIHtcbiAgICAgIHByb21wdF9sZW5ndGg6IFN0cmluZyhpbnB1dFN0cmluZy5sZW5ndGgpLFxuICAgICAgcHJvbXB0OiByZWRhY3RJZkRpc2FibGVkKGlucHV0U3RyaW5nKSxcbiAgICAgICdwcm9tcHQuaWQnOiBwcm9tcHRJZCxcbiAgICB9KVxuICAgIHJldHVybiB7XG4gICAgICBtZXNzYWdlczogW1xuICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgY29udGVudDogcHJlcGFyZVVzZXJDb250ZW50KHsgaW5wdXRTdHJpbmcsIHByZWNlZGluZ0lucHV0QmxvY2tzIH0pLFxuICAgICAgICAgIHV1aWQ6IHV1aWQsXG4gICAgICAgIH0pLFxuICAgICAgICAuLi5hdHRhY2htZW50TWVzc2FnZXMsXG4gICAgICBdLFxuICAgICAgc2hvdWxkUXVlcnk6IHRydWUsXG4gICAgfVxuICB9XG5cbiAgLy8gVHJhY2sgc2xhc2ggY29tbWFuZCB1c2FnZSBmb3IgZmVhdHVyZSBkaXNjb3ZlcnlcblxuICBjb25zdCB7XG4gICAgbWVzc2FnZXM6IG5ld01lc3NhZ2VzLFxuICAgIHNob3VsZFF1ZXJ5OiBtZXNzYWdlU2hvdWxkUXVlcnksXG4gICAgYWxsb3dlZFRvb2xzLFxuICAgIG1vZGVsLFxuICAgIGVmZm9ydCxcbiAgICBjb21tYW5kOiByZXR1cm5lZENvbW1hbmQsXG4gICAgcmVzdWx0VGV4dCxcbiAgICBuZXh0SW5wdXQsXG4gICAgc3VibWl0TmV4dElucHV0LFxuICB9ID0gYXdhaXQgZ2V0TWVzc2FnZXNGb3JTbGFzaENvbW1hbmQoXG4gICAgY29tbWFuZE5hbWUsXG4gICAgcGFyc2VkQXJncyxcbiAgICBzZXRUb29sSlNYLFxuICAgIGNvbnRleHQsXG4gICAgcHJlY2VkaW5nSW5wdXRCbG9ja3MsXG4gICAgaW1hZ2VDb250ZW50QmxvY2tzLFxuICAgIGlzQWxyZWFkeVByb2Nlc3NpbmcsXG4gICAgY2FuVXNlVG9vbCxcbiAgICB1dWlkLFxuICApXG5cbiAgLy8gTG9jYWwgc2xhc2ggY29tbWFuZHMgdGhhdCBza2lwIG1lc3NhZ2VzXG4gIGlmIChuZXdNZXNzYWdlcy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zdCBldmVudERhdGE6IFJlY29yZDxzdHJpbmcsIGJvb2xlYW4gfCBudW1iZXIgfCB1bmRlZmluZWQ+ID0ge1xuICAgICAgaW5wdXQ6XG4gICAgICAgIHNhbml0aXplZENvbW1hbmROYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgfVxuXG4gICAgLy8gQWRkIHBsdWdpbiBtZXRhZGF0YSBpZiB0aGlzIGlzIGEgcGx1Z2luIGNvbW1hbmRcbiAgICBpZiAocmV0dXJuZWRDb21tYW5kLnR5cGUgPT09ICdwcm9tcHQnICYmIHJldHVybmVkQ29tbWFuZC5wbHVnaW5JbmZvKSB7XG4gICAgICBjb25zdCB7IHBsdWdpbk1hbmlmZXN0LCByZXBvc2l0b3J5IH0gPSByZXR1cm5lZENvbW1hbmQucGx1Z2luSW5mb1xuICAgICAgY29uc3QgeyBtYXJrZXRwbGFjZSB9ID0gcGFyc2VQbHVnaW5JZGVudGlmaWVyKHJlcG9zaXRvcnkpXG4gICAgICBjb25zdCBpc09mZmljaWFsID0gaXNPZmZpY2lhbE1hcmtldHBsYWNlTmFtZShtYXJrZXRwbGFjZSlcbiAgICAgIC8vIF9QUk9UT18qIHJvdXRlcyB0byBQSUktdGFnZ2VkIHBsdWdpbl9uYW1lL21hcmtldHBsYWNlX25hbWUgQlEgY29sdW1uc1xuICAgICAgLy8gKHVucmVkYWN0ZWQsIGFsbCB1c2Vycyk7IHBsdWdpbl9uYW1lL3BsdWdpbl9yZXBvc2l0b3J5IHN0YXkgaW5cbiAgICAgIC8vIGFkZGl0aW9uYWxfbWV0YWRhdGEgYXMgcmVkYWN0ZWQgdmFyaWFudHMgZm9yIGdlbmVyYWwtYWNjZXNzIGRhc2hib2FyZHMuXG4gICAgICBldmVudERhdGEuX1BST1RPX3BsdWdpbl9uYW1lID1cbiAgICAgICAgcGx1Z2luTWFuaWZlc3QubmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfUElJX1RBR0dFRFxuICAgICAgaWYgKG1hcmtldHBsYWNlKSB7XG4gICAgICAgIGV2ZW50RGF0YS5fUFJPVE9fbWFya2V0cGxhY2VfbmFtZSA9XG4gICAgICAgICAgbWFya2V0cGxhY2UgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX1BJSV9UQUdHRURcbiAgICAgIH1cbiAgICAgIGV2ZW50RGF0YS5wbHVnaW5fcmVwb3NpdG9yeSA9IChcbiAgICAgICAgaXNPZmZpY2lhbCA/IHJlcG9zaXRvcnkgOiAndGhpcmQtcGFydHknXG4gICAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICAgIGV2ZW50RGF0YS5wbHVnaW5fbmFtZSA9IChcbiAgICAgICAgaXNPZmZpY2lhbCA/IHBsdWdpbk1hbmlmZXN0Lm5hbWUgOiAndGhpcmQtcGFydHknXG4gICAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICAgIGlmIChpc09mZmljaWFsICYmIHBsdWdpbk1hbmlmZXN0LnZlcnNpb24pIHtcbiAgICAgICAgZXZlbnREYXRhLnBsdWdpbl92ZXJzaW9uID1cbiAgICAgICAgICBwbHVnaW5NYW5pZmVzdC52ZXJzaW9uIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICAgIH1cbiAgICAgIE9iamVjdC5hc3NpZ24oXG4gICAgICAgIGV2ZW50RGF0YSxcbiAgICAgICAgYnVpbGRQbHVnaW5Db21tYW5kVGVsZW1ldHJ5RmllbGRzKHJldHVybmVkQ29tbWFuZC5wbHVnaW5JbmZvKSxcbiAgICAgIClcbiAgICB9XG5cbiAgICBsb2dFdmVudCgndGVuZ3VfaW5wdXRfY29tbWFuZCcsIHtcbiAgICAgIC4uLmV2ZW50RGF0YSxcbiAgICAgIGludm9jYXRpb25fdHJpZ2dlcjpcbiAgICAgICAgJ3VzZXItc2xhc2gnIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAuLi4oXCJleHRlcm5hbFwiID09PSAnYW50JyAmJiB7XG4gICAgICAgIHNraWxsX25hbWU6XG4gICAgICAgICAgY29tbWFuZE5hbWUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgICAgLi4uKHJldHVybmVkQ29tbWFuZC50eXBlID09PSAncHJvbXB0JyAmJiB7XG4gICAgICAgICAgc2tpbGxfc291cmNlOlxuICAgICAgICAgICAgcmV0dXJuZWRDb21tYW5kLnNvdXJjZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJldHVybmVkQ29tbWFuZC5sb2FkZWRGcm9tICYmIHtcbiAgICAgICAgICBza2lsbF9sb2FkZWRfZnJvbTpcbiAgICAgICAgICAgIHJldHVybmVkQ29tbWFuZC5sb2FkZWRGcm9tIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4ocmV0dXJuZWRDb21tYW5kLmtpbmQgJiYge1xuICAgICAgICAgIHNraWxsX2tpbmQ6XG4gICAgICAgICAgICByZXR1cm5lZENvbW1hbmQua2luZCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgICB9KSxcbiAgICAgIH0pLFxuICAgIH0pXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcblxuICAgICAgbW9kZWwsXG4gICAgICBuZXh0SW5wdXQsXG4gICAgICBzdWJtaXROZXh0SW5wdXQsXG4gICAgfVxuICB9XG5cbiAgLy8gRm9yIGludmFsaWQgY29tbWFuZHMsIHByZXNlcnZlIGJvdGggdGhlIHVzZXIgbWVzc2FnZSBhbmQgZXJyb3JcbiAgaWYgKFxuICAgIG5ld01lc3NhZ2VzLmxlbmd0aCA9PT0gMiAmJlxuICAgIG5ld01lc3NhZ2VzWzFdIS50eXBlID09PSAndXNlcicgJiZcbiAgICB0eXBlb2YgbmV3TWVzc2FnZXNbMV0hLm1lc3NhZ2UuY29udGVudCA9PT0gJ3N0cmluZycgJiZcbiAgICBuZXdNZXNzYWdlc1sxXSEubWVzc2FnZS5jb250ZW50LnN0YXJ0c1dpdGgoJ1Vua25vd24gY29tbWFuZDonKVxuICApIHtcbiAgICAvLyBEb24ndCBsb2cgYXMgaW52YWxpZCBpZiBpdCBsb29rcyBsaWtlIGEgY29tbW9uIGZpbGUgcGF0aFxuICAgIGNvbnN0IGxvb2tzTGlrZUZpbGVQYXRoID1cbiAgICAgIGlucHV0U3RyaW5nLnN0YXJ0c1dpdGgoJy92YXInKSB8fFxuICAgICAgaW5wdXRTdHJpbmcuc3RhcnRzV2l0aCgnL3RtcCcpIHx8XG4gICAgICBpbnB1dFN0cmluZy5zdGFydHNXaXRoKCcvcHJpdmF0ZScpXG5cbiAgICBpZiAoIWxvb2tzTGlrZUZpbGVQYXRoKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3VfaW5wdXRfc2xhc2hfaW52YWxpZCcsIHtcbiAgICAgICAgaW5wdXQ6XG4gICAgICAgICAgY29tbWFuZE5hbWUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2VzOiBbY3JlYXRlU3ludGhldGljVXNlckNhdmVhdE1lc3NhZ2UoKSwgLi4ubmV3TWVzc2FnZXNdLFxuICAgICAgc2hvdWxkUXVlcnk6IG1lc3NhZ2VTaG91bGRRdWVyeSxcbiAgICAgIGFsbG93ZWRUb29scyxcblxuICAgICAgbW9kZWwsXG4gICAgfVxuICB9XG5cbiAgLy8gQSB2YWxpZCBjb21tYW5kXG4gIGNvbnN0IGV2ZW50RGF0YTogUmVjb3JkPHN0cmluZywgYm9vbGVhbiB8IG51bWJlciB8IHVuZGVmaW5lZD4gPSB7XG4gICAgaW5wdXQ6XG4gICAgICBzYW5pdGl6ZWRDb21tYW5kTmFtZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICB9XG5cbiAgLy8gQWRkIHBsdWdpbiBtZXRhZGF0YSBpZiB0aGlzIGlzIGEgcGx1Z2luIGNvbW1hbmRcbiAgaWYgKHJldHVybmVkQ29tbWFuZC50eXBlID09PSAncHJvbXB0JyAmJiByZXR1cm5lZENvbW1hbmQucGx1Z2luSW5mbykge1xuICAgIGNvbnN0IHsgcGx1Z2luTWFuaWZlc3QsIHJlcG9zaXRvcnkgfSA9IHJldHVybmVkQ29tbWFuZC5wbHVnaW5JbmZvXG4gICAgY29uc3QgeyBtYXJrZXRwbGFjZSB9ID0gcGFyc2VQbHVnaW5JZGVudGlmaWVyKHJlcG9zaXRvcnkpXG4gICAgY29uc3QgaXNPZmZpY2lhbCA9IGlzT2ZmaWNpYWxNYXJrZXRwbGFjZU5hbWUobWFya2V0cGxhY2UpXG4gICAgZXZlbnREYXRhLl9QUk9UT19wbHVnaW5fbmFtZSA9XG4gICAgICBwbHVnaW5NYW5pZmVzdC5uYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19QSUlfVEFHR0VEXG4gICAgaWYgKG1hcmtldHBsYWNlKSB7XG4gICAgICBldmVudERhdGEuX1BST1RPX21hcmtldHBsYWNlX25hbWUgPVxuICAgICAgICBtYXJrZXRwbGFjZSBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfUElJX1RBR0dFRFxuICAgIH1cbiAgICBldmVudERhdGEucGx1Z2luX3JlcG9zaXRvcnkgPSAoXG4gICAgICBpc09mZmljaWFsID8gcmVwb3NpdG9yeSA6ICd0aGlyZC1wYXJ0eSdcbiAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICBldmVudERhdGEucGx1Z2luX25hbWUgPSAoXG4gICAgICBpc09mZmljaWFsID8gcGx1Z2luTWFuaWZlc3QubmFtZSA6ICd0aGlyZC1wYXJ0eSdcbiAgICApIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICBpZiAoaXNPZmZpY2lhbCAmJiBwbHVnaW5NYW5pZmVzdC52ZXJzaW9uKSB7XG4gICAgICBldmVudERhdGEucGx1Z2luX3ZlcnNpb24gPVxuICAgICAgICBwbHVnaW5NYW5pZmVzdC52ZXJzaW9uIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFNcbiAgICB9XG4gICAgT2JqZWN0LmFzc2lnbihcbiAgICAgIGV2ZW50RGF0YSxcbiAgICAgIGJ1aWxkUGx1Z2luQ29tbWFuZFRlbGVtZXRyeUZpZWxkcyhyZXR1cm5lZENvbW1hbmQucGx1Z2luSW5mbyksXG4gICAgKVxuICB9XG5cbiAgbG9nRXZlbnQoJ3Rlbmd1X2lucHV0X2NvbW1hbmQnLCB7XG4gICAgLi4uZXZlbnREYXRhLFxuICAgIGludm9jYXRpb25fdHJpZ2dlcjpcbiAgICAgICd1c2VyLXNsYXNoJyBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIC4uLihcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIHtcbiAgICAgIHNraWxsX25hbWU6XG4gICAgICAgIGNvbW1hbmROYW1lIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAuLi4ocmV0dXJuZWRDb21tYW5kLnR5cGUgPT09ICdwcm9tcHQnICYmIHtcbiAgICAgICAgc2tpbGxfc291cmNlOlxuICAgICAgICAgIHJldHVybmVkQ29tbWFuZC5zb3VyY2UgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pLFxuICAgICAgLi4uKHJldHVybmVkQ29tbWFuZC5sb2FkZWRGcm9tICYmIHtcbiAgICAgICAgc2tpbGxfbG9hZGVkX2Zyb206XG4gICAgICAgICAgcmV0dXJuZWRDb21tYW5kLmxvYWRlZEZyb20gYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIH0pLFxuICAgICAgLi4uKHJldHVybmVkQ29tbWFuZC5raW5kICYmIHtcbiAgICAgICAgc2tpbGxfa2luZDpcbiAgICAgICAgICByZXR1cm5lZENvbW1hbmQua2luZCBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgICAgfSksXG4gICAgfSksXG4gIH0pXG5cbiAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbXBhY3QgcmVzdWx0IHdoaWNoIGhhbmRsZSB0aGVpciBvd24gc3ludGhldGljIGNhdmVhdCBtZXNzYWdlIG9yZGVyaW5nXG4gIGNvbnN0IGlzQ29tcGFjdFJlc3VsdCA9XG4gICAgbmV3TWVzc2FnZXMubGVuZ3RoID4gMCAmJlxuICAgIG5ld01lc3NhZ2VzWzBdICYmXG4gICAgaXNDb21wYWN0Qm91bmRhcnlNZXNzYWdlKG5ld01lc3NhZ2VzWzBdKVxuXG4gIHJldHVybiB7XG4gICAgbWVzc2FnZXM6XG4gICAgICBtZXNzYWdlU2hvdWxkUXVlcnkgfHxcbiAgICAgIG5ld01lc3NhZ2VzLmV2ZXJ5KGlzU3lzdGVtTG9jYWxDb21tYW5kTWVzc2FnZSkgfHxcbiAgICAgIGlzQ29tcGFjdFJlc3VsdFxuICAgICAgICA/IG5ld01lc3NhZ2VzXG4gICAgICAgIDogW2NyZWF0ZVN5bnRoZXRpY1VzZXJDYXZlYXRNZXNzYWdlKCksIC4uLm5ld01lc3NhZ2VzXSxcbiAgICBzaG91bGRRdWVyeTogbWVzc2FnZVNob3VsZFF1ZXJ5LFxuICAgIGFsbG93ZWRUb29scyxcbiAgICBtb2RlbCxcbiAgICBlZmZvcnQsXG4gICAgcmVzdWx0VGV4dCxcbiAgICBuZXh0SW5wdXQsXG4gICAgc3VibWl0TmV4dElucHV0LFxuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldE1lc3NhZ2VzRm9yU2xhc2hDb21tYW5kKFxuICBjb21tYW5kTmFtZTogc3RyaW5nLFxuICBhcmdzOiBzdHJpbmcsXG4gIHNldFRvb2xKU1g6IFNldFRvb2xKU1hGbixcbiAgY29udGV4dDogUHJvY2Vzc1VzZXJJbnB1dENvbnRleHQsXG4gIHByZWNlZGluZ0lucHV0QmxvY2tzOiBDb250ZW50QmxvY2tQYXJhbVtdLFxuICBpbWFnZUNvbnRlbnRCbG9ja3M6IENvbnRlbnRCbG9ja1BhcmFtW10sXG4gIF9pc0FscmVhZHlQcm9jZXNzaW5nPzogYm9vbGVhbixcbiAgY2FuVXNlVG9vbD86IENhblVzZVRvb2xGbixcbiAgdXVpZD86IHN0cmluZyxcbik6IFByb21pc2U8U2xhc2hDb21tYW5kUmVzdWx0PiB7XG4gIGNvbnN0IGNvbW1hbmQgPSBnZXRDb21tYW5kKGNvbW1hbmROYW1lLCBjb250ZXh0Lm9wdGlvbnMuY29tbWFuZHMpXG5cbiAgLy8gVHJhY2sgc2tpbGwgdXNhZ2UgZm9yIHJhbmtpbmcgKG9ubHkgZm9yIHByb21wdCBjb21tYW5kcyB0aGF0IGFyZSB1c2VyLWludm9jYWJsZSlcbiAgaWYgKGNvbW1hbmQudHlwZSA9PT0gJ3Byb21wdCcgJiYgY29tbWFuZC51c2VySW52b2NhYmxlICE9PSBmYWxzZSkge1xuICAgIHJlY29yZFNraWxsVXNhZ2UoY29tbWFuZE5hbWUpXG4gIH1cblxuICAvLyBDaGVjayBpZiB0aGUgY29tbWFuZCBpcyB1c2VyLWludm9jYWJsZVxuICAvLyBTa2lsbHMgd2l0aCB1c2VySW52b2NhYmxlID09PSBmYWxzZSBjYW4gb25seSBiZSBpbnZva2VkIGJ5IHRoZSBtb2RlbCB2aWEgU2tpbGxUb29sXG4gIGlmIChjb21tYW5kLnVzZXJJbnZvY2FibGUgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgICBjb250ZW50OiBwcmVwYXJlVXNlckNvbnRlbnQoe1xuICAgICAgICAgICAgaW5wdXRTdHJpbmc6IGAvJHtjb21tYW5kTmFtZX1gLFxuICAgICAgICAgICAgcHJlY2VkaW5nSW5wdXRCbG9ja3MsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0pLFxuICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgY29udGVudDogYFRoaXMgc2tpbGwgY2FuIG9ubHkgYmUgaW52b2tlZCBieSBDbGF1ZGUsIG5vdCBkaXJlY3RseSBieSB1c2Vycy4gQXNrIENsYXVkZSB0byB1c2UgdGhlIFwiJHtjb21tYW5kTmFtZX1cIiBza2lsbCBmb3IgeW91LmAsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcbiAgICAgIGNvbW1hbmQsXG4gICAgfVxuICB9XG5cbiAgdHJ5IHtcbiAgICBzd2l0Y2ggKGNvbW1hbmQudHlwZSkge1xuICAgICAgY2FzZSAnbG9jYWwtanN4Jzoge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8U2xhc2hDb21tYW5kUmVzdWx0PihyZXNvbHZlID0+IHtcbiAgICAgICAgICBsZXQgZG9uZVdhc0NhbGxlZCA9IGZhbHNlXG4gICAgICAgICAgY29uc3Qgb25Eb25lID0gKFxuICAgICAgICAgICAgcmVzdWx0Pzogc3RyaW5nLFxuICAgICAgICAgICAgb3B0aW9ucz86IHtcbiAgICAgICAgICAgICAgZGlzcGxheT86IENvbW1hbmRSZXN1bHREaXNwbGF5XG4gICAgICAgICAgICAgIHNob3VsZFF1ZXJ5PzogYm9vbGVhblxuICAgICAgICAgICAgICBtZXRhTWVzc2FnZXM/OiBzdHJpbmdbXVxuICAgICAgICAgICAgICBuZXh0SW5wdXQ/OiBzdHJpbmdcbiAgICAgICAgICAgICAgc3VibWl0TmV4dElucHV0PzogYm9vbGVhblxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApID0+IHtcbiAgICAgICAgICAgIGRvbmVXYXNDYWxsZWQgPSB0cnVlXG4gICAgICAgICAgICAvLyBJZiBkaXNwbGF5IGlzICdza2lwJywgZG9uJ3QgYWRkIGFueSBtZXNzYWdlcyB0byB0aGUgY29udmVyc2F0aW9uXG4gICAgICAgICAgICBpZiAob3B0aW9ucz8uZGlzcGxheSA9PT0gJ3NraXAnKSB7XG4gICAgICAgICAgICAgIHZvaWQgcmVzb2x2ZSh7XG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgICAgIG5leHRJbnB1dDogb3B0aW9ucz8ubmV4dElucHV0LFxuICAgICAgICAgICAgICAgIHN1Ym1pdE5leHRJbnB1dDogb3B0aW9ucz8uc3VibWl0TmV4dElucHV0LFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWV0YSBtZXNzYWdlcyBhcmUgbW9kZWwtdmlzaWJsZSBidXQgaGlkZGVuIGZyb20gdGhlIHVzZXJcbiAgICAgICAgICAgIGNvbnN0IG1ldGFNZXNzYWdlcyA9IChvcHRpb25zPy5tZXRhTWVzc2FnZXMgPz8gW10pLm1hcChcbiAgICAgICAgICAgICAgKGNvbnRlbnQ6IHN0cmluZykgPT4gY3JlYXRlVXNlck1lc3NhZ2UoeyBjb250ZW50LCBpc01ldGE6IHRydWUgfSksXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIC8vIEluIGZ1bGxzY3JlZW4gdGhlIGNvbW1hbmQganVzdCBzaG93ZWQgYXMgYSBjZW50ZXJlZCBtb2RhbFxuICAgICAgICAgICAgLy8gcGFuZSDigJQgdGhlIHRyYW5zaWVudCBub3RpZmljYXRpb24gaXMgZW5vdWdoIGZlZWRiYWNrLiBUaGVcbiAgICAgICAgICAgIC8vIFwi4p2vIC9jb25maWdcIiArIFwi4o6/IGRpc21pc3NlZFwiIHRyYW5zY3JpcHQgZW50cmllcyBhcmVcbiAgICAgICAgICAgIC8vIHR5cGU6c3lzdGVtIHN1YnR5cGU6bG9jYWxfY29tbWFuZCAodXNlci12aXNpYmxlIGJ1dCBOT1Qgc2VudFxuICAgICAgICAgICAgLy8gdG8gdGhlIG1vZGVsKSwgc28gc2tpcHBpbmcgdGhlbSBkb2Vzbid0IGFmZmVjdCBtb2RlbCBjb250ZXh0LlxuICAgICAgICAgICAgLy8gT3V0c2lkZSBmdWxsc2NyZWVuIGtlZXAgdGhlbSBzbyBzY3JvbGxiYWNrIHNob3dzIHdoYXQgcmFuLlxuICAgICAgICAgICAgLy8gT25seSBza2lwIFwiPE5hbWU+IGRpc21pc3NlZFwiIG1vZGFsLWNsb3NlIG5vdGlmaWNhdGlvbnMg4oCUXG4gICAgICAgICAgICAvLyBjb21tYW5kcyB0aGF0IGVhcmx5LWV4aXQgYmVmb3JlIHNob3dpbmcgYSBtb2RhbCAoL3VsdHJhcGxhblxuICAgICAgICAgICAgLy8gdXNhZ2UsIC9yZW5hbWUsIC9wcm9hY3RpdmUpIHVzZSBkaXNwbGF5OnN5c3RlbSBmb3IgYWN0dWFsXG4gICAgICAgICAgICAvLyBvdXRwdXQgdGhhdCBtdXN0IHJlYWNoIHRoZSB0cmFuc2NyaXB0LlxuICAgICAgICAgICAgY29uc3Qgc2tpcFRyYW5zY3JpcHQgPVxuICAgICAgICAgICAgICBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkKCkgJiZcbiAgICAgICAgICAgICAgdHlwZW9mIHJlc3VsdCA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgICAgcmVzdWx0LmVuZHNXaXRoKCcgZGlzbWlzc2VkJylcblxuICAgICAgICAgICAgdm9pZCByZXNvbHZlKHtcbiAgICAgICAgICAgICAgbWVzc2FnZXM6XG4gICAgICAgICAgICAgICAgb3B0aW9ucz8uZGlzcGxheSA9PT0gJ3N5c3RlbSdcbiAgICAgICAgICAgICAgICAgID8gc2tpcFRyYW5zY3JpcHRcbiAgICAgICAgICAgICAgICAgICAgPyBtZXRhTWVzc2FnZXNcbiAgICAgICAgICAgICAgICAgICAgOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGVDb21tYW5kSW5wdXRNZXNzYWdlKFxuICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXRDb21tYW5kSW5wdXQoY29tbWFuZCwgYXJncyksXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlQ29tbWFuZElucHV0TWVzc2FnZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYDxsb2NhbC1jb21tYW5kLXN0ZG91dD4ke3Jlc3VsdH08L2xvY2FsLWNvbW1hbmQtc3Rkb3V0PmAsXG4gICAgICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgICAgICAgLi4ubWV0YU1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICAgIDogW1xuICAgICAgICAgICAgICAgICAgICAgIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IHByZXBhcmVVc2VyQ29udGVudCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0U3RyaW5nOiBmb3JtYXRDb21tYW5kSW5wdXQoY29tbWFuZCwgYXJncyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWNlZGluZ0lucHV0QmxvY2tzLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgICAgICAgICAgICAgICAgICA/IGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50OiBgPGxvY2FsLWNvbW1hbmQtc3Rkb3V0PiR7cmVzdWx0fTwvbG9jYWwtY29tbWFuZC1zdGRvdXQ+YCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIDogY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRlbnQ6IGA8bG9jYWwtY29tbWFuZC1zdGRvdXQ+JHtOT19DT05URU5UX01FU1NBR0V9PC9sb2NhbC1jb21tYW5kLXN0ZG91dD5gLFxuICAgICAgICAgICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICAgICAgICAuLi5tZXRhTWVzc2FnZXMsXG4gICAgICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHNob3VsZFF1ZXJ5OiBvcHRpb25zPy5zaG91bGRRdWVyeSA/PyBmYWxzZSxcbiAgICAgICAgICAgICAgY29tbWFuZCxcbiAgICAgICAgICAgICAgbmV4dElucHV0OiBvcHRpb25zPy5uZXh0SW5wdXQsXG4gICAgICAgICAgICAgIHN1Ym1pdE5leHRJbnB1dDogb3B0aW9ucz8uc3VibWl0TmV4dElucHV0LFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2b2lkIGNvbW1hbmRcbiAgICAgICAgICAgIC5sb2FkKClcbiAgICAgICAgICAgIC50aGVuKG1vZCA9PiBtb2QuY2FsbChvbkRvbmUsIHsgLi4uY29udGV4dCwgY2FuVXNlVG9vbCB9LCBhcmdzKSlcbiAgICAgICAgICAgIC50aGVuKGpzeCA9PiB7XG4gICAgICAgICAgICAgIGlmIChqc3ggPT0gbnVsbCkgcmV0dXJuXG4gICAgICAgICAgICAgIGlmIChjb250ZXh0Lm9wdGlvbnMuaXNOb25JbnRlcmFjdGl2ZVNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICB2b2lkIHJlc29sdmUoe1xuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgc2hvdWxkUXVlcnk6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgY29tbWFuZCxcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIEd1YXJkOiBpZiBvbkRvbmUgZmlyZWQgZHVyaW5nIG1vZC5jYWxsKCkgKGVhcmx5LWV4aXQgcGF0aFxuICAgICAgICAgICAgICAvLyB0aGF0IGNhbGxzIG9uRG9uZSB0aGVuIHJldHVybnMgSlNYKSwgc2tpcCBzZXRUb29sSlNYLiBUaGlzXG4gICAgICAgICAgICAgIC8vIGNoYWluIGlzIGZpcmUtYW5kLWZvcmdldCDigJQgdGhlIG91dGVyIFByb21pc2UgcmVzb2x2ZXMgd2hlblxuICAgICAgICAgICAgICAvLyBvbkRvbmUgaXMgY2FsbGVkLCBzbyBleGVjdXRlVXNlcklucHV0IG1heSBoYXZlIGFscmVhZHkgcnVuXG4gICAgICAgICAgICAgIC8vIGl0cyBzZXRUb29sSlNYKHtjbGVhckxvY2FsSlNYOiB0cnVlfSkgYmVmb3JlIHdlIGdldCBoZXJlLlxuICAgICAgICAgICAgICAvLyBTZXR0aW5nIGlzTG9jYWxKU1hDb21tYW5kIGFmdGVyIGNsZWFyIGxlYXZlcyBpdCBzdHVjayB0cnVlLFxuICAgICAgICAgICAgICAvLyBibG9ja2luZyB1c2VRdWV1ZVByb2Nlc3NvciBhbmQgVGV4dElucHV0IGZvY3VzLlxuICAgICAgICAgICAgICBpZiAoZG9uZVdhc0NhbGxlZCkgcmV0dXJuXG4gICAgICAgICAgICAgIHNldFRvb2xKU1goe1xuICAgICAgICAgICAgICAgIGpzeCxcbiAgICAgICAgICAgICAgICBzaG91bGRIaWRlUHJvbXB0SW5wdXQ6IHRydWUsXG4gICAgICAgICAgICAgICAgc2hvd1NwaW5uZXI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGlzTG9jYWxKU1hDb21tYW5kOiB0cnVlLFxuICAgICAgICAgICAgICAgIGlzSW1tZWRpYXRlOiBjb21tYW5kLmltbWVkaWF0ZSA9PT0gdHJ1ZSxcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuY2F0Y2goZSA9PiB7XG4gICAgICAgICAgICAgIC8vIElmIGxvYWQoKS9jYWxsKCkgdGhyb3dzIGFuZCBvbkRvbmUgbmV2ZXIgZmlyZWQsIHRoZSBvdXRlclxuICAgICAgICAgICAgICAvLyBQcm9taXNlIGhhbmdzIGZvcmV2ZXIsIGxlYXZpbmcgcXVlcnlHdWFyZCBzdHVjayBpblxuICAgICAgICAgICAgICAvLyAnZGlzcGF0Y2hpbmcnIGFuZCBkZWFkbG9ja2luZyB0aGUgcXVldWUgcHJvY2Vzc29yLlxuICAgICAgICAgICAgICBsb2dFcnJvcihlKVxuICAgICAgICAgICAgICBpZiAoZG9uZVdhc0NhbGxlZCkgcmV0dXJuXG4gICAgICAgICAgICAgIGRvbmVXYXNDYWxsZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHNldFRvb2xKU1goe1xuICAgICAgICAgICAgICAgIGpzeDogbnVsbCxcbiAgICAgICAgICAgICAgICBzaG91bGRIaWRlUHJvbXB0SW5wdXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNsZWFyTG9jYWxKU1g6IHRydWUsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgIHZvaWQgcmVzb2x2ZSh7IG1lc3NhZ2VzOiBbXSwgc2hvdWxkUXVlcnk6IGZhbHNlLCBjb21tYW5kIH0pXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfVxuICAgICAgY2FzZSAnbG9jYWwnOiB7XG4gICAgICAgIGNvbnN0IGRpc3BsYXlBcmdzID0gY29tbWFuZC5pc1NlbnNpdGl2ZSAmJiBhcmdzLnRyaW0oKSA/ICcqKionIDogYXJnc1xuICAgICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgICBjb250ZW50OiBwcmVwYXJlVXNlckNvbnRlbnQoe1xuICAgICAgICAgICAgaW5wdXRTdHJpbmc6IGZvcm1hdENvbW1hbmRJbnB1dChjb21tYW5kLCBkaXNwbGF5QXJncyksXG4gICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSlcblxuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHN5bnRoZXRpY0NhdmVhdE1lc3NhZ2UgPSBjcmVhdGVTeW50aGV0aWNVc2VyQ2F2ZWF0TWVzc2FnZSgpXG4gICAgICAgICAgY29uc3QgbW9kID0gYXdhaXQgY29tbWFuZC5sb2FkKClcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBtb2QuY2FsbChhcmdzLCBjb250ZXh0KVxuXG4gICAgICAgICAgaWYgKHJlc3VsdC50eXBlID09PSAnc2tpcCcpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgc2hvdWxkUXVlcnk6IGZhbHNlLFxuICAgICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFVzZSBkaXNjcmltaW5hdGVkIHVuaW9uIHRvIGhhbmRsZSBkaWZmZXJlbnQgcmVzdWx0IHR5cGVzXG4gICAgICAgICAgaWYgKHJlc3VsdC50eXBlID09PSAnY29tcGFjdCcpIHtcbiAgICAgICAgICAgIC8vIEFwcGVuZCBzbGFzaCBjb21tYW5kIG1lc3NhZ2VzIHRvIG1lc3NhZ2VzVG9LZWVwIHNvIHRoYXRcbiAgICAgICAgICAgIC8vIGF0dGFjaG1lbnRzIGFuZCBob29rUmVzdWx0cyBjb21lIGFmdGVyIHVzZXIgbWVzc2FnZXNcbiAgICAgICAgICAgIGNvbnN0IHNsYXNoQ29tbWFuZE1lc3NhZ2VzID0gW1xuICAgICAgICAgICAgICBzeW50aGV0aWNDYXZlYXRNZXNzYWdlLFxuICAgICAgICAgICAgICB1c2VyTWVzc2FnZSxcbiAgICAgICAgICAgICAgLi4uKHJlc3VsdC5kaXNwbGF5VGV4dFxuICAgICAgICAgICAgICAgID8gW1xuICAgICAgICAgICAgICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgICAgY29udGVudDogYDxsb2NhbC1jb21tYW5kLXN0ZG91dD4ke3Jlc3VsdC5kaXNwbGF5VGV4dH08L2xvY2FsLWNvbW1hbmQtc3Rkb3V0PmAsXG4gICAgICAgICAgICAgICAgICAgICAgLy8gLS1yZXN1bWUgbG9va3MgYXQgbGF0ZXN0IHRpbWVzdGFtcCBtZXNzYWdlIHRvIGRldGVybWluZSB3aGljaCBtZXNzYWdlIHRvIHJlc3VtZSBmcm9tXG4gICAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBhIHBlcmYgb3B0aW1pemF0aW9uIHRvIGF2b2lkIGhhdmluZyB0byByZWNhY3VsY2F0ZSB0aGUgbGVhZiBub2RlIGV2ZXJ5IHRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAvLyBTaW5jZSB3ZSdyZSBjcmVhdGluZyBhIGJ1bmNoIG9mIHN5bnRoZXRpYyBtZXNzYWdlcyBmb3IgY29tcGFjdCwgaXQncyBpbXBvcnRhbnQgdG8gc2V0XG4gICAgICAgICAgICAgICAgICAgICAgLy8gdGhlIHRpbWVzdGFtcCBvZiB0aGUgbGFzdCBtZXNzYWdlIHRvIGJlIHNsaWdodGx5IGFmdGVyIHRoZSBjdXJyZW50IHRpbWVcbiAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlzIG1vc3RseSBpbXBvcnRhbnQgZm9yIHNkayAvIC1wIG1vZGVcbiAgICAgICAgICAgICAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKERhdGUubm93KCkgKyAxMDApLnRvSVNPU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgIDogW10pLFxuICAgICAgICAgICAgXVxuICAgICAgICAgICAgY29uc3QgY29tcGFjdGlvblJlc3VsdFdpdGhTbGFzaE1lc3NhZ2VzID0ge1xuICAgICAgICAgICAgICAuLi5yZXN1bHQuY29tcGFjdGlvblJlc3VsdCxcbiAgICAgICAgICAgICAgbWVzc2FnZXNUb0tlZXA6IFtcbiAgICAgICAgICAgICAgICAuLi4ocmVzdWx0LmNvbXBhY3Rpb25SZXN1bHQubWVzc2FnZXNUb0tlZXAgPz8gW10pLFxuICAgICAgICAgICAgICAgIC4uLnNsYXNoQ29tbWFuZE1lc3NhZ2VzLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUmVzZXQgbWljcm9jb21wYWN0IHN0YXRlIHNpbmNlIGZ1bGwgY29tcGFjdCByZXBsYWNlcyBhbGxcbiAgICAgICAgICAgIC8vIG1lc3NhZ2VzIOKAlCBvbGQgdG9vbCBJRHMgYXJlIG5vIGxvbmdlciByZWxldmFudC4gQnVkZ2V0IHN0YXRlXG4gICAgICAgICAgICAvLyAob24gdG9vbFVzZUNvbnRleHQpIG5lZWRzIG5vIHJlc2V0OiBzdGFsZSBlbnRyaWVzIGFyZSBpbmVydFxuICAgICAgICAgICAgLy8gKFVVSURzIG5ldmVyIHJlcGVhdCwgc28gdGhleSdyZSBuZXZlciBsb29rZWQgdXApLlxuICAgICAgICAgICAgcmVzZXRNaWNyb2NvbXBhY3RTdGF0ZSgpXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBtZXNzYWdlczogYnVpbGRQb3N0Q29tcGFjdE1lc3NhZ2VzKFxuICAgICAgICAgICAgICAgIGNvbXBhY3Rpb25SZXN1bHRXaXRoU2xhc2hNZXNzYWdlcyxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgc2hvdWxkUXVlcnk6IGZhbHNlLFxuICAgICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFRleHQgcmVzdWx0IOKAlCB1c2Ugc3lzdGVtIG1lc3NhZ2Ugc28gaXQgZG9lc24ndCByZW5kZXIgYXMgYSB1c2VyIGJ1YmJsZVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtZXNzYWdlczogW1xuICAgICAgICAgICAgICB1c2VyTWVzc2FnZSxcbiAgICAgICAgICAgICAgY3JlYXRlQ29tbWFuZElucHV0TWVzc2FnZShcbiAgICAgICAgICAgICAgICBgPGxvY2FsLWNvbW1hbmQtc3Rkb3V0PiR7cmVzdWx0LnZhbHVlfTwvbG9jYWwtY29tbWFuZC1zdGRvdXQ+YCxcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBzaG91bGRRdWVyeTogZmFsc2UsXG4gICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgcmVzdWx0VGV4dDogcmVzdWx0LnZhbHVlLFxuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGxvZ0Vycm9yKGUpXG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgIHVzZXJNZXNzYWdlLFxuICAgICAgICAgICAgICBjcmVhdGVDb21tYW5kSW5wdXRNZXNzYWdlKFxuICAgICAgICAgICAgICAgIGA8bG9jYWwtY29tbWFuZC1zdGRlcnI+JHtTdHJpbmcoZSl9PC9sb2NhbC1jb21tYW5kLXN0ZGVycj5gLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIHNob3VsZFF1ZXJ5OiBmYWxzZSxcbiAgICAgICAgICAgIGNvbW1hbmQsXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXNlICdwcm9tcHQnOiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gQ2hlY2sgaWYgY29tbWFuZCBzaG91bGQgcnVuIGFzIGZvcmtlZCBzdWItYWdlbnRcbiAgICAgICAgICBpZiAoY29tbWFuZC5jb250ZXh0ID09PSAnZm9yaycpIHtcbiAgICAgICAgICAgIHJldHVybiBhd2FpdCBleGVjdXRlRm9ya2VkU2xhc2hDb21tYW5kKFxuICAgICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgICBhcmdzLFxuICAgICAgICAgICAgICBjb250ZXh0LFxuICAgICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICAgICAgc2V0VG9vbEpTWCxcbiAgICAgICAgICAgICAgY2FuVXNlVG9vbCA/PyBoYXNQZXJtaXNzaW9uc1RvVXNlVG9vbCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gYXdhaXQgZ2V0TWVzc2FnZXNGb3JQcm9tcHRTbGFzaENvbW1hbmQoXG4gICAgICAgICAgICBjb21tYW5kLFxuICAgICAgICAgICAgYXJncyxcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICAgIGltYWdlQ29udGVudEJsb2NrcyxcbiAgICAgICAgICAgIHV1aWQsXG4gICAgICAgICAgKVxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gSGFuZGxlIGFib3J0IGVycm9ycyBzcGVjaWFsbHkgdG8gc2hvdyBwcm9wZXIgXCJJbnRlcnJ1cHRlZFwiIG1lc3NhZ2VcbiAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEFib3J0RXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgICAgICAgICAgY29udGVudDogcHJlcGFyZVVzZXJDb250ZW50KHtcbiAgICAgICAgICAgICAgICAgICAgaW5wdXRTdHJpbmc6IGZvcm1hdENvbW1hbmRJbnB1dChjb21tYW5kLCBhcmdzKSxcbiAgICAgICAgICAgICAgICAgICAgcHJlY2VkaW5nSW5wdXRCbG9ja3MsXG4gICAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgICBjcmVhdGVVc2VySW50ZXJydXB0aW9uTWVzc2FnZSh7IHRvb2xVc2U6IGZhbHNlIH0pLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICBzaG91bGRRdWVyeTogZmFsc2UsXG4gICAgICAgICAgICAgIGNvbW1hbmQsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBtZXNzYWdlczogW1xuICAgICAgICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgY29udGVudDogcHJlcGFyZVVzZXJDb250ZW50KHtcbiAgICAgICAgICAgICAgICAgIGlucHV0U3RyaW5nOiBmb3JtYXRDb21tYW5kSW5wdXQoY29tbWFuZCwgYXJncyksXG4gICAgICAgICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgICAgICAgICAgICBjb250ZW50OiBgPGxvY2FsLWNvbW1hbmQtc3RkZXJyPiR7U3RyaW5nKGUpfTwvbG9jYWwtY29tbWFuZC1zdGRlcnI+YCxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgc2hvdWxkUXVlcnk6IGZhbHNlLFxuICAgICAgICAgICAgY29tbWFuZCxcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIE1hbGZvcm1lZENvbW1hbmRFcnJvcikge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICAgICAgICBjb250ZW50OiBwcmVwYXJlVXNlckNvbnRlbnQoe1xuICAgICAgICAgICAgICBpbnB1dFN0cmluZzogZS5tZXNzYWdlLFxuICAgICAgICAgICAgICBwcmVjZWRpbmdJbnB1dEJsb2NrcyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pLFxuICAgICAgICBdLFxuICAgICAgICBzaG91bGRRdWVyeTogZmFsc2UsXG4gICAgICAgIGNvbW1hbmQsXG4gICAgICB9XG4gICAgfVxuICAgIHRocm93IGVcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXRDb21tYW5kSW5wdXQoY29tbWFuZDogQ29tbWFuZEJhc2UsIGFyZ3M6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmb3JtYXRDb21tYW5kSW5wdXRUYWdzKGdldENvbW1hbmROYW1lKGNvbW1hbmQpLCBhcmdzKVxufVxuXG4vKipcbiAqIEZvcm1hdHMgdGhlIG1ldGFkYXRhIGZvciBhIHNraWxsIGxvYWRpbmcgbWVzc2FnZS5cbiAqIFVzZWQgYnkgdGhlIFNraWxsIHRvb2wgYW5kIGZvciBzdWJhZ2VudCBza2lsbCBwcmVsb2FkaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0U2tpbGxMb2FkaW5nTWV0YWRhdGEoXG4gIHNraWxsTmFtZTogc3RyaW5nLFxuICBfcHJvZ3Jlc3NNZXNzYWdlOiBzdHJpbmcgPSAnbG9hZGluZycsXG4pOiBzdHJpbmcge1xuICAvLyBVc2Ugc2tpbGwgbmFtZSBvbmx5IC0gVXNlckNvbW1hbmRNZXNzYWdlIHJlbmRlcnMgYXMgXCJTa2lsbChuYW1lKVwiXG4gIHJldHVybiBbXG4gICAgYDwke0NPTU1BTkRfTUVTU0FHRV9UQUd9PiR7c2tpbGxOYW1lfTwvJHtDT01NQU5EX01FU1NBR0VfVEFHfT5gLFxuICAgIGA8JHtDT01NQU5EX05BTUVfVEFHfT4ke3NraWxsTmFtZX08LyR7Q09NTUFORF9OQU1FX1RBR30+YCxcbiAgICBgPHNraWxsLWZvcm1hdD50cnVlPC9za2lsbC1mb3JtYXQ+YCxcbiAgXS5qb2luKCdcXG4nKVxufVxuXG4vKipcbiAqIEZvcm1hdHMgdGhlIG1ldGFkYXRhIGZvciBhIHNsYXNoIGNvbW1hbmQgbG9hZGluZyBtZXNzYWdlLlxuICovXG5mdW5jdGlvbiBmb3JtYXRTbGFzaENvbW1hbmRMb2FkaW5nTWV0YWRhdGEoXG4gIGNvbW1hbmROYW1lOiBzdHJpbmcsXG4gIGFyZ3M/OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICByZXR1cm4gW1xuICAgIGA8JHtDT01NQU5EX01FU1NBR0VfVEFHfT4ke2NvbW1hbmROYW1lfTwvJHtDT01NQU5EX01FU1NBR0VfVEFHfT5gLFxuICAgIGA8JHtDT01NQU5EX05BTUVfVEFHfT4vJHtjb21tYW5kTmFtZX08LyR7Q09NTUFORF9OQU1FX1RBR30+YCxcbiAgICBhcmdzID8gYDxjb21tYW5kLWFyZ3M+JHthcmdzfTwvY29tbWFuZC1hcmdzPmAgOiBudWxsLFxuICBdXG4gICAgLmZpbHRlcihCb29sZWFuKVxuICAgIC5qb2luKCdcXG4nKVxufVxuXG4vKipcbiAqIEZvcm1hdHMgdGhlIGxvYWRpbmcgbWV0YWRhdGEgZm9yIGEgY29tbWFuZCAoc2tpbGwgb3Igc2xhc2ggY29tbWFuZCkuXG4gKiBVc2VyLWludm9jYWJsZSBza2lsbHMgdXNlIHNsYXNoIGNvbW1hbmQgZm9ybWF0ICgvbmFtZSksIHdoaWxlIG1vZGVsLW9ubHlcbiAqIHNraWxscyB1c2UgdGhlIHNraWxsIGZvcm1hdCAoXCJUaGUgWCBza2lsbCBpcyBydW5uaW5nXCIpLlxuICovXG5mdW5jdGlvbiBmb3JtYXRDb21tYW5kTG9hZGluZ01ldGFkYXRhKFxuICBjb21tYW5kOiBDb21tYW5kQmFzZSAmIFByb21wdENvbW1hbmQsXG4gIGFyZ3M/OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICAvLyBVc2UgY29tbWFuZC5uYW1lICh0aGUgcXVhbGlmaWVkIG5hbWUgaW5jbHVkaW5nIHBsdWdpbiBwcmVmaXgsIGUuZy5cbiAgLy8gXCJwcm9kdWN0LW1hbmFnZW1lbnQ6ZmVhdHVyZS1zcGVjXCIpIGluc3RlYWQgb2YgdXNlckZhY2luZ05hbWUoKSB3aGljaCBtYXlcbiAgLy8gc3RyaXAgdGhlIHBsdWdpbiBwcmVmaXggdmlhIGRpc3BsYXlOYW1lIGZhbGxiYWNrLlxuICAvLyBVc2VyLWludm9jYWJsZSBza2lsbHMgc2hvdWxkIHNob3cgYXMgL2NvbW1hbmQtbmFtZSBsaWtlIHJlZ3VsYXIgc2xhc2ggY29tbWFuZHNcbiAgaWYgKGNvbW1hbmQudXNlckludm9jYWJsZSAhPT0gZmFsc2UpIHtcbiAgICByZXR1cm4gZm9ybWF0U2xhc2hDb21tYW5kTG9hZGluZ01ldGFkYXRhKGNvbW1hbmQubmFtZSwgYXJncylcbiAgfVxuICAvLyBNb2RlbC1vbmx5IHNraWxscyAodXNlckludm9jYWJsZTogZmFsc2UpIHNob3cgYXMgXCJUaGUgWCBza2lsbCBpcyBydW5uaW5nXCJcbiAgaWYgKFxuICAgIGNvbW1hbmQubG9hZGVkRnJvbSA9PT0gJ3NraWxscycgfHxcbiAgICBjb21tYW5kLmxvYWRlZEZyb20gPT09ICdwbHVnaW4nIHx8XG4gICAgY29tbWFuZC5sb2FkZWRGcm9tID09PSAnbWNwJ1xuICApIHtcbiAgICByZXR1cm4gZm9ybWF0U2tpbGxMb2FkaW5nTWV0YWRhdGEoY29tbWFuZC5uYW1lLCBjb21tYW5kLnByb2dyZXNzTWVzc2FnZSlcbiAgfVxuICByZXR1cm4gZm9ybWF0U2xhc2hDb21tYW5kTG9hZGluZ01ldGFkYXRhKGNvbW1hbmQubmFtZSwgYXJncylcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb2Nlc3NQcm9tcHRTbGFzaENvbW1hbmQoXG4gIGNvbW1hbmROYW1lOiBzdHJpbmcsXG4gIGFyZ3M6IHN0cmluZyxcbiAgY29tbWFuZHM6IENvbW1hbmRbXSxcbiAgY29udGV4dDogVG9vbFVzZUNvbnRleHQsXG4gIGltYWdlQ29udGVudEJsb2NrczogQ29udGVudEJsb2NrUGFyYW1bXSA9IFtdLFxuKTogUHJvbWlzZTxTbGFzaENvbW1hbmRSZXN1bHQ+IHtcbiAgY29uc3QgY29tbWFuZCA9IGZpbmRDb21tYW5kKGNvbW1hbmROYW1lLCBjb21tYW5kcylcbiAgaWYgKCFjb21tYW5kKSB7XG4gICAgdGhyb3cgbmV3IE1hbGZvcm1lZENvbW1hbmRFcnJvcihgVW5rbm93biBjb21tYW5kOiAke2NvbW1hbmROYW1lfWApXG4gIH1cbiAgaWYgKGNvbW1hbmQudHlwZSAhPT0gJ3Byb21wdCcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgVW5leHBlY3RlZCAke2NvbW1hbmQudHlwZX0gY29tbWFuZC4gRXhwZWN0ZWQgJ3Byb21wdCcgY29tbWFuZC4gVXNlIC8ke2NvbW1hbmROYW1lfSBkaXJlY3RseSBpbiB0aGUgbWFpbiBjb252ZXJzYXRpb24uYCxcbiAgICApXG4gIH1cbiAgcmV0dXJuIGdldE1lc3NhZ2VzRm9yUHJvbXB0U2xhc2hDb21tYW5kKFxuICAgIGNvbW1hbmQsXG4gICAgYXJncyxcbiAgICBjb250ZXh0LFxuICAgIFtdLFxuICAgIGltYWdlQ29udGVudEJsb2NrcyxcbiAgKVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRNZXNzYWdlc0ZvclByb21wdFNsYXNoQ29tbWFuZChcbiAgY29tbWFuZDogQ29tbWFuZEJhc2UgJiBQcm9tcHRDb21tYW5kLFxuICBhcmdzOiBzdHJpbmcsXG4gIGNvbnRleHQ6IFRvb2xVc2VDb250ZXh0LFxuICBwcmVjZWRpbmdJbnB1dEJsb2NrczogQ29udGVudEJsb2NrUGFyYW1bXSA9IFtdLFxuICBpbWFnZUNvbnRlbnRCbG9ja3M6IENvbnRlbnRCbG9ja1BhcmFtW10gPSBbXSxcbiAgdXVpZD86IHN0cmluZyxcbik6IFByb21pc2U8U2xhc2hDb21tYW5kUmVzdWx0PiB7XG4gIC8vIEluIGNvb3JkaW5hdG9yIG1vZGUgKG1haW4gdGhyZWFkIG9ubHkpLCBza2lwIGxvYWRpbmcgdGhlIGZ1bGwgc2tpbGwgY29udGVudFxuICAvLyBhbmQgcGVybWlzc2lvbnMuIFRoZSBjb29yZGluYXRvciBvbmx5IGhhcyBBZ2VudCArIFRhc2tTdG9wIHRvb2xzLCBzbyB0aGVcbiAgLy8gc2tpbGwgY29udGVudCBhbmQgYWxsb3dlZFRvb2xzIGFyZSB1c2VsZXNzLiBJbnN0ZWFkLCBzZW5kIGEgYnJpZWYgc3VtbWFyeVxuICAvLyB0ZWxsaW5nIHRoZSBjb29yZGluYXRvciBob3cgdG8gZGVsZWdhdGUgdGhpcyBza2lsbCB0byBhIHdvcmtlci5cbiAgLy9cbiAgLy8gV29ya2VycyBydW4gaW4tcHJvY2VzcyBhbmQgaW5oZXJpdCBDTEFVREVfQ09ERV9DT09SRElOQVRPUl9NT0RFIGZyb20gdGhlXG4gIC8vIHBhcmVudCBlbnYsIHNvIHdlIGFsc28gY2hlY2sgIWNvbnRleHQuYWdlbnRJZDogYWdlbnRJZCBpcyBvbmx5IHNldCBmb3JcbiAgLy8gc3ViYWdlbnRzLCBsZXR0aW5nIHdvcmtlcnMgZmFsbCB0aHJvdWdoIHRvIGdldFByb21wdEZvckNvbW1hbmQgYW5kIHJlY2VpdmVcbiAgLy8gdGhlIHJlYWwgc2tpbGwgY29udGVudCB3aGVuIHRoZXkgaW52b2tlIHRoZSBTa2lsbCB0b29sLlxuICBpZiAoXG4gICAgZmVhdHVyZSgnQ09PUkRJTkFUT1JfTU9ERScpICYmXG4gICAgaXNFbnZUcnV0aHkocHJvY2Vzcy5lbnYuQ0xBVURFX0NPREVfQ09PUkRJTkFUT1JfTU9ERSkgJiZcbiAgICAhY29udGV4dC5hZ2VudElkXG4gICkge1xuICAgIGNvbnN0IG1ldGFkYXRhID0gZm9ybWF0Q29tbWFuZExvYWRpbmdNZXRhZGF0YShjb21tYW5kLCBhcmdzKVxuICAgIGNvbnN0IHBhcnRzOiBzdHJpbmdbXSA9IFtcbiAgICAgIGBTa2lsbCBcIi8ke2NvbW1hbmQubmFtZX1cIiBpcyBhdmFpbGFibGUgZm9yIHdvcmtlcnMuYCxcbiAgICBdXG4gICAgaWYgKGNvbW1hbmQuZGVzY3JpcHRpb24pIHtcbiAgICAgIHBhcnRzLnB1c2goYERlc2NyaXB0aW9uOiAke2NvbW1hbmQuZGVzY3JpcHRpb259YClcbiAgICB9XG4gICAgaWYgKGNvbW1hbmQud2hlblRvVXNlKSB7XG4gICAgICBwYXJ0cy5wdXNoKGBXaGVuIHRvIHVzZTogJHtjb21tYW5kLndoZW5Ub1VzZX1gKVxuICAgIH1cbiAgICBjb25zdCBza2lsbEFsbG93ZWRUb29scyA9IGNvbW1hbmQuYWxsb3dlZFRvb2xzID8/IFtdXG4gICAgaWYgKHNraWxsQWxsb3dlZFRvb2xzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBhcnRzLnB1c2goXG4gICAgICAgIGBUaGlzIHNraWxsIGdyYW50cyB3b3JrZXJzIGFkZGl0aW9uYWwgdG9vbCBwZXJtaXNzaW9uczogJHtza2lsbEFsbG93ZWRUb29scy5qb2luKCcsICcpfWAsXG4gICAgICApXG4gICAgfVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBgXFxuSW5zdHJ1Y3QgYSB3b3JrZXIgdG8gdXNlIHRoaXMgc2tpbGwgYnkgaW5jbHVkaW5nIFwiVXNlIHRoZSAvJHtjb21tYW5kLm5hbWV9IHNraWxsXCIgaW4geW91ciBBZ2VudCBwcm9tcHQuIFRoZSB3b3JrZXIgaGFzIGFjY2VzcyB0byB0aGUgU2tpbGwgdG9vbCBhbmQgd2lsbCByZWNlaXZlIHRoZSBza2lsbCdzIGNvbnRlbnQgYW5kIHBlcm1pc3Npb25zIHdoZW4gaXQgaW52b2tlcyBpdC5gLFxuICAgIClcbiAgICBjb25zdCBzdW1tYXJ5Q29udGVudDogQ29udGVudEJsb2NrUGFyYW1bXSA9IFtcbiAgICAgIHsgdHlwZTogJ3RleHQnLCB0ZXh0OiBwYXJ0cy5qb2luKCdcXG4nKSB9LFxuICAgIF1cbiAgICByZXR1cm4ge1xuICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2UoeyBjb250ZW50OiBtZXRhZGF0YSwgdXVpZCB9KSxcbiAgICAgICAgY3JlYXRlVXNlck1lc3NhZ2UoeyBjb250ZW50OiBzdW1tYXJ5Q29udGVudCwgaXNNZXRhOiB0cnVlIH0pLFxuICAgICAgXSxcbiAgICAgIHNob3VsZFF1ZXJ5OiB0cnVlLFxuICAgICAgbW9kZWw6IGNvbW1hbmQubW9kZWwsXG4gICAgICBlZmZvcnQ6IGNvbW1hbmQuZWZmb3J0LFxuICAgICAgY29tbWFuZCxcbiAgICB9XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSBhd2FpdCBjb21tYW5kLmdldFByb21wdEZvckNvbW1hbmQoYXJncywgY29udGV4dClcblxuICAvLyBSZWdpc3RlciBza2lsbCBob29rcyBpZiBkZWZpbmVkLiBVbmRlciBbXCJob29rc1wiXS1vbmx5IChza2lsbHMgbm90IGxvY2tlZCksXG4gIC8vIHVzZXIgc2tpbGxzIHN0aWxsIGxvYWQgYW5kIHJlYWNoIHRoaXMgcG9pbnQg4oCUIGJsb2NrIGhvb2sgUkVHSVNUUkFUSU9OIGhlcmVcbiAgLy8gd2hlcmUgc291cmNlIGlzIGtub3duLiBNaXJyb3JzIHRoZSBhZ2VudCBmcm9udG1hdHRlciBnYXRlIGluIHJ1bkFnZW50LnRzLlxuICBjb25zdCBob29rc0FsbG93ZWRGb3JUaGlzU2tpbGwgPVxuICAgICFpc1Jlc3RyaWN0ZWRUb1BsdWdpbk9ubHkoJ2hvb2tzJykgfHwgaXNTb3VyY2VBZG1pblRydXN0ZWQoY29tbWFuZC5zb3VyY2UpXG4gIGlmIChjb21tYW5kLmhvb2tzICYmIGhvb2tzQWxsb3dlZEZvclRoaXNTa2lsbCkge1xuICAgIGNvbnN0IHNlc3Npb25JZCA9IGdldFNlc3Npb25JZCgpXG4gICAgcmVnaXN0ZXJTa2lsbEhvb2tzKFxuICAgICAgY29udGV4dC5zZXRBcHBTdGF0ZSxcbiAgICAgIHNlc3Npb25JZCxcbiAgICAgIGNvbW1hbmQuaG9va3MsXG4gICAgICBjb21tYW5kLm5hbWUsXG4gICAgICBjb21tYW5kLnR5cGUgPT09ICdwcm9tcHQnID8gY29tbWFuZC5za2lsbFJvb3QgOiB1bmRlZmluZWQsXG4gICAgKVxuICB9XG5cbiAgLy8gUmVjb3JkIHNraWxsIGludm9jYXRpb24gZm9yIGNvbXBhY3Rpb24gcHJlc2VydmF0aW9uLCBzY29wZWQgYnkgYWdlbnQgY29udGV4dC5cbiAgLy8gU2tpbGxzIGFyZSB0YWdnZWQgd2l0aCB0aGVpciBhZ2VudElkIHNvIG9ubHkgc2tpbGxzIGJlbG9uZ2luZyB0byB0aGUgY3VycmVudFxuICAvLyBhZ2VudCBhcmUgcmVzdG9yZWQgZHVyaW5nIGNvbXBhY3Rpb24gKHByZXZlbnRpbmcgY3Jvc3MtYWdlbnQgbGVha3MpLlxuICBjb25zdCBza2lsbFBhdGggPSBjb21tYW5kLnNvdXJjZVxuICAgID8gYCR7Y29tbWFuZC5zb3VyY2V9OiR7Y29tbWFuZC5uYW1lfWBcbiAgICA6IGNvbW1hbmQubmFtZVxuICBjb25zdCBza2lsbENvbnRlbnQgPSByZXN1bHRcbiAgICAuZmlsdGVyKChiKTogYiBpcyBUZXh0QmxvY2tQYXJhbSA9PiBiLnR5cGUgPT09ICd0ZXh0JylcbiAgICAubWFwKGIgPT4gYi50ZXh0KVxuICAgIC5qb2luKCdcXG5cXG4nKVxuICBhZGRJbnZva2VkU2tpbGwoXG4gICAgY29tbWFuZC5uYW1lLFxuICAgIHNraWxsUGF0aCxcbiAgICBza2lsbENvbnRlbnQsXG4gICAgZ2V0QWdlbnRDb250ZXh0KCk/LmFnZW50SWQgPz8gbnVsbCxcbiAgKVxuXG4gIGNvbnN0IG1ldGFkYXRhID0gZm9ybWF0Q29tbWFuZExvYWRpbmdNZXRhZGF0YShjb21tYW5kLCBhcmdzKVxuXG4gIGNvbnN0IGFkZGl0aW9uYWxBbGxvd2VkVG9vbHMgPSBwYXJzZVRvb2xMaXN0RnJvbUNMSShcbiAgICBjb21tYW5kLmFsbG93ZWRUb29scyA/PyBbXSxcbiAgKVxuXG4gIC8vIENyZWF0ZSBjb250ZW50IGZvciB0aGUgbWFpbiBtZXNzYWdlLCBpbmNsdWRpbmcgYW55IHBhc3RlZCBpbWFnZXNcbiAgY29uc3QgbWFpbk1lc3NhZ2VDb250ZW50OiBDb250ZW50QmxvY2tQYXJhbVtdID1cbiAgICBpbWFnZUNvbnRlbnRCbG9ja3MubGVuZ3RoID4gMCB8fCBwcmVjZWRpbmdJbnB1dEJsb2Nrcy5sZW5ndGggPiAwXG4gICAgICA/IFsuLi5pbWFnZUNvbnRlbnRCbG9ja3MsIC4uLnByZWNlZGluZ0lucHV0QmxvY2tzLCAuLi5yZXN1bHRdXG4gICAgICA6IHJlc3VsdFxuXG4gIC8vIEV4dHJhY3QgYXR0YWNobWVudHMgZnJvbSBjb21tYW5kIGFyZ3VtZW50cyAoQC1tZW50aW9ucywgTUNQIHJlc291cmNlcyxcbiAgLy8gYWdlbnQgbWVudGlvbnMgaW4gU0tJTEwubWQpLiBza2lwU2tpbGxEaXNjb3ZlcnkgcHJldmVudHMgdGhlIFNLSUxMLm1kXG4gIC8vIGNvbnRlbnQgaXRzZWxmIGZyb20gdHJpZ2dlcmluZyBkaXNjb3Zlcnkg4oCUIGl0J3MgbWV0YS1jb250ZW50LCBub3QgdXNlclxuICAvLyBpbnRlbnQsIGFuZCBhIGxhcmdlIFNLSUxMLm1kIChlLmcuIDExMEtCKSB3b3VsZCBmaXJlIGNodW5rZWQgQUtJIHF1ZXJpZXNcbiAgLy8gYWRkaW5nIHNlY29uZHMgb2YgbGF0ZW5jeSB0byBldmVyeSBza2lsbCBpbnZvY2F0aW9uLlxuICBjb25zdCBhdHRhY2htZW50TWVzc2FnZXMgPSBhd2FpdCB0b0FycmF5KFxuICAgIGdldEF0dGFjaG1lbnRNZXNzYWdlcyhcbiAgICAgIHJlc3VsdFxuICAgICAgICAuZmlsdGVyKChibG9jayk6IGJsb2NrIGlzIFRleHRCbG9ja1BhcmFtID0+IGJsb2NrLnR5cGUgPT09ICd0ZXh0JylcbiAgICAgICAgLm1hcChibG9jayA9PiBibG9jay50ZXh0KVxuICAgICAgICAuam9pbignICcpLFxuICAgICAgY29udGV4dCxcbiAgICAgIG51bGwsXG4gICAgICBbXSwgLy8gcXVldWVkQ29tbWFuZHMgLSBoYW5kbGVkIGJ5IHF1ZXJ5LnRzIGZvciBtaWQtdHVybiBhdHRhY2htZW50c1xuICAgICAgY29udGV4dC5tZXNzYWdlcyxcbiAgICAgICdyZXBsX21haW5fdGhyZWFkJyxcbiAgICAgIHsgc2tpcFNraWxsRGlzY292ZXJ5OiB0cnVlIH0sXG4gICAgKSxcbiAgKVxuXG4gIGNvbnN0IG1lc3NhZ2VzID0gW1xuICAgIGNyZWF0ZVVzZXJNZXNzYWdlKHtcbiAgICAgIGNvbnRlbnQ6IG1ldGFkYXRhLFxuICAgICAgdXVpZCxcbiAgICB9KSxcbiAgICBjcmVhdGVVc2VyTWVzc2FnZSh7XG4gICAgICBjb250ZW50OiBtYWluTWVzc2FnZUNvbnRlbnQsXG4gICAgICBpc01ldGE6IHRydWUsXG4gICAgfSksXG4gICAgLi4uYXR0YWNobWVudE1lc3NhZ2VzLFxuICAgIGNyZWF0ZUF0dGFjaG1lbnRNZXNzYWdlKHtcbiAgICAgIHR5cGU6ICdjb21tYW5kX3Blcm1pc3Npb25zJyxcbiAgICAgIGFsbG93ZWRUb29sczogYWRkaXRpb25hbEFsbG93ZWRUb29scyxcbiAgICAgIG1vZGVsOiBjb21tYW5kLm1vZGVsLFxuICAgIH0pLFxuICBdXG5cbiAgcmV0dXJuIHtcbiAgICBtZXNzYWdlcyxcbiAgICBzaG91bGRRdWVyeTogdHJ1ZSxcbiAgICBhbGxvd2VkVG9vbHM6IGFkZGl0aW9uYWxBbGxvd2VkVG9vbHMsXG4gICAgbW9kZWw6IGNvbW1hbmQubW9kZWwsXG4gICAgZWZmb3J0OiBjb21tYW5kLmVmZm9ydCxcbiAgICBjb21tYW5kLFxuICB9XG59XG4iXSwibWFwcGluZ3MiOiJBQUFBLFNBQVNBLE9BQU8sUUFBUSxZQUFZO0FBQ3BDLGNBQ0VDLGlCQUFpQixFQUNqQkMsY0FBYyxRQUNULDZCQUE2QjtBQUNwQyxTQUFTQyxVQUFVLFFBQVEsUUFBUTtBQUNuQyxTQUFTQyxXQUFXLFFBQVEsd0JBQXdCO0FBQ3BELFNBQ0VDLG1CQUFtQixFQUNuQixLQUFLQyxPQUFPLEVBQ1osS0FBS0MsV0FBVyxFQUNoQkMsV0FBVyxFQUNYQyxVQUFVLEVBQ1ZDLGNBQWMsRUFDZEMsVUFBVSxFQUNWLEtBQUtDLGFBQWEsUUFDYixpQkFBaUI7QUFDeEIsU0FBU0Msa0JBQWtCLFFBQVEsMkJBQTJCO0FBQzlELGNBQWNDLFlBQVksRUFBRUMsY0FBYyxRQUFRLGFBQWE7QUFDL0QsY0FDRUMsZ0JBQWdCLEVBQ2hCQyxpQkFBaUIsRUFDakJDLE9BQU8sRUFDUEMscUJBQXFCLEVBQ3JCQyxlQUFlLEVBQ2ZDLFdBQVcsUUFDTixzQkFBc0I7QUFDN0IsU0FBU0MsZUFBZSxFQUFFQyxZQUFZLFFBQVEsMEJBQTBCO0FBQ3hFLFNBQVNDLG1CQUFtQixFQUFFQyxnQkFBZ0IsUUFBUSx3QkFBd0I7QUFDOUUsY0FBY0MsWUFBWSxRQUFRLDhCQUE4QjtBQUNoRSxTQUNFLEtBQUtDLDBEQUEwRCxFQUMvRCxLQUFLQywrQ0FBK0MsRUFDcERDLFFBQVEsUUFDSCxtQ0FBbUM7QUFDMUMsU0FBU0Msa0JBQWtCLFFBQVEsbUNBQW1DO0FBQ3RFLFNBQVNDLHdCQUF3QixRQUFRLG1DQUFtQztBQUM1RSxTQUFTQyxzQkFBc0IsUUFBUSx3Q0FBd0M7QUFDL0UsY0FBY0MsUUFBUSxJQUFJQyxhQUFhLFFBQVEsb0NBQW9DO0FBQ25GLFNBQVNDLFFBQVEsUUFBUSxtQ0FBbUM7QUFDNUQsU0FBU0MsNEJBQTRCLFFBQVEsNkJBQTZCO0FBQzFFLGNBQWNDLG9CQUFvQixRQUFRLHdCQUF3QjtBQUNsRSxTQUFTQyxxQkFBcUIsUUFBUSx1QkFBdUI7QUFDN0QsU0FBU0MsZUFBZSxRQUFRLG9CQUFvQjtBQUNwRCxTQUNFQyx1QkFBdUIsRUFDdkJDLHFCQUFxQixRQUNoQixtQkFBbUI7QUFDMUIsU0FBU0MsZUFBZSxRQUFRLGFBQWE7QUFDN0MsU0FBU0MsV0FBVyxRQUFRLGdCQUFnQjtBQUM1QyxTQUFTQyxVQUFVLEVBQUVDLHFCQUFxQixRQUFRLGNBQWM7QUFDaEUsU0FBU0MsY0FBYyxRQUFRLFlBQVk7QUFDM0MsU0FDRUMsaUJBQWlCLEVBQ2pCQywyQkFBMkIsUUFDdEIsbUJBQW1CO0FBQzFCLFNBQVNDLG1CQUFtQixRQUFRLG9CQUFvQjtBQUN4RCxTQUFTQyxzQkFBc0IsUUFBUSxrQkFBa0I7QUFDekQsU0FBU0MsT0FBTyxRQUFRLGtCQUFrQjtBQUMxQyxTQUFTQyxrQkFBa0IsUUFBUSxnQ0FBZ0M7QUFDbkUsU0FBU0MsUUFBUSxRQUFRLFdBQVc7QUFDcEMsU0FBU0MsMEJBQTBCLFFBQVEsMkJBQTJCO0FBQ3RFLFNBQ0VDLHlCQUF5QixFQUN6QkMsZ0NBQWdDLEVBQ2hDQyxtQkFBbUIsRUFDbkJDLDZCQUE2QixFQUM3QkMsaUJBQWlCLEVBQ2pCQyxzQkFBc0IsRUFDdEJDLHdCQUF3QixFQUN4QkMsMkJBQTJCLEVBQzNCQyxpQkFBaUIsRUFDakJDLGtCQUFrQixRQUNiLGdCQUFnQjtBQUN2QixjQUFjQyxVQUFVLFFBQVEscUJBQXFCO0FBQ3JELFNBQVNDLG9CQUFvQixRQUFRLG1DQUFtQztBQUN4RSxTQUFTQyx1QkFBdUIsUUFBUSwrQkFBK0I7QUFDdkUsU0FDRUMseUJBQXlCLEVBQ3pCQyxxQkFBcUIsUUFDaEIsZ0NBQWdDO0FBQ3ZDLFNBQ0VDLHdCQUF3QixFQUN4QkMsb0JBQW9CLFFBQ2YsaUNBQWlDO0FBQ3hDLFNBQVNDLGlCQUFpQixRQUFRLDJCQUEyQjtBQUM3RCxTQUFTQyxLQUFLLFFBQVEsYUFBYTtBQUNuQyxTQUFTQyxnQkFBZ0IsUUFBUSxzQ0FBc0M7QUFDdkUsU0FBU0MsWUFBWSxFQUFFQyxnQkFBZ0IsUUFBUSx3QkFBd0I7QUFDdkUsU0FBU0MsaUNBQWlDLFFBQVEsaUNBQWlDO0FBQ25GLFNBQVNDLGdDQUFnQyxRQUFRLGNBQWM7QUFDL0QsU0FBU0MsYUFBYSxRQUFRLFlBQVk7QUFDMUMsU0FBU0MsV0FBVyxRQUFRLHVCQUF1QjtBQUNuRCxjQUNFQywwQkFBMEIsRUFDMUJDLHVCQUF1QixRQUNsQix1QkFBdUI7QUFFOUIsS0FBS0Msa0JBQWtCLEdBQUdGLDBCQUEwQixHQUFHO0VBQ3JERyxPQUFPLEVBQUU5RSxPQUFPO0FBQ2xCLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0EsTUFBTStFLGtCQUFrQixHQUFHLEdBQUc7QUFDOUIsTUFBTUMscUJBQXFCLEdBQUcsTUFBTTs7QUFFcEM7QUFDQTtBQUNBO0FBQ0EsZUFBZUMseUJBQXlCQSxDQUN0Q0gsT0FBTyxFQUFFN0UsV0FBVyxHQUFHSyxhQUFhLEVBQ3BDNEUsSUFBSSxFQUFFLE1BQU0sRUFDWkMsT0FBTyxFQUFFUCx1QkFBdUIsRUFDaENRLG9CQUFvQixFQUFFekYsaUJBQWlCLEVBQUUsRUFDekMwRixVQUFVLEVBQUU3RSxZQUFZLEVBQ3hCOEUsVUFBVSxFQUFFbEUsWUFBWSxDQUN6QixFQUFFbUUsT0FBTyxDQUFDVixrQkFBa0IsQ0FBQyxDQUFDO0VBQzdCLE1BQU1XLE9BQU8sR0FBR2YsYUFBYSxDQUFDLENBQUM7RUFFL0IsTUFBTWdCLGlCQUFpQixHQUFHWCxPQUFPLENBQUNZLFVBQVUsR0FDeEMzQixxQkFBcUIsQ0FBQ2UsT0FBTyxDQUFDWSxVQUFVLENBQUNDLFVBQVUsQ0FBQyxDQUFDQyxXQUFXLEdBQ2hFQyxTQUFTO0VBQ2J0RSxRQUFRLENBQUMsNEJBQTRCLEVBQUU7SUFDckN1RSxZQUFZLEVBQ1ZoQixPQUFPLENBQUNpQixJQUFJLElBQUkxRSwwREFBMEQ7SUFDNUUyRSxrQkFBa0IsRUFDaEIsWUFBWSxJQUFJM0UsMERBQTBEO0lBQzVFLElBQUl5RCxPQUFPLENBQUNZLFVBQVUsSUFBSTtNQUN4Qk8sa0JBQWtCLEVBQUVuQixPQUFPLENBQUNZLFVBQVUsQ0FBQ1EsY0FBYyxDQUNsREgsSUFBSSxJQUFJekUsK0NBQStDO01BQzFELElBQUltRSxpQkFBaUIsSUFBSTtRQUN2QlUsdUJBQXVCLEVBQ3JCVixpQkFBaUIsSUFBSW5FO01BQ3pCLENBQUMsQ0FBQztNQUNGLEdBQUdpRCxpQ0FBaUMsQ0FBQ08sT0FBTyxDQUFDWSxVQUFVO0lBQ3pELENBQUM7RUFDSCxDQUFDLENBQUM7RUFFRixNQUFNO0lBQUVVLFlBQVk7SUFBRUMsbUJBQW1CO0lBQUVDLFNBQVM7SUFBRUM7RUFBZSxDQUFDLEdBQ3BFLE1BQU03RCwyQkFBMkIsQ0FBQ29DLE9BQU8sRUFBRUksSUFBSSxFQUFFQyxPQUFPLENBQUM7O0VBRTNEO0VBQ0EsTUFBTXFCLGVBQWUsR0FDbkIxQixPQUFPLENBQUMyQixNQUFNLEtBQUtaLFNBQVMsR0FDeEI7SUFBRSxHQUFHUyxTQUFTO0lBQUVHLE1BQU0sRUFBRTNCLE9BQU8sQ0FBQzJCO0VBQU8sQ0FBQyxHQUN4Q0gsU0FBUztFQUVmbEUsZUFBZSxDQUNiLG1DQUFtQzBDLE9BQU8sQ0FBQ2lCLElBQUksZUFBZVMsZUFBZSxDQUFDRSxTQUFTLEVBQ3pGLENBQUM7O0VBRUQ7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSWhILE9BQU8sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU15RixPQUFPLENBQUN3QixXQUFXLENBQUMsQ0FBQyxFQUFFQyxhQUFhLEVBQUU7SUFDcEU7SUFDQTtJQUNBO0lBQ0EsTUFBTUMsaUJBQWlCLEdBQUc3RSxxQkFBcUIsQ0FBQyxDQUFDO0lBQ2pELE1BQU04RSxXQUFXLEdBQUcxRyxjQUFjLENBQUMwRSxPQUFPLENBQUM7O0lBRTNDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLE1BQU1pQyxpQkFBaUIsR0FBR3JDLFdBQVcsQ0FBQyxDQUFDOztJQUV2QztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxNQUFNc0MsYUFBYSxHQUFHQSxDQUFDQyxLQUFLLEVBQUUsTUFBTSxDQUFDLEVBQUUsSUFBSSxJQUN6Q2pFLDBCQUEwQixDQUFDO01BQ3pCaUUsS0FBSztNQUNMQyxJQUFJLEVBQUUsUUFBUTtNQUNkQyxRQUFRLEVBQUUsT0FBTztNQUNqQkMsTUFBTSxFQUFFLElBQUk7TUFDWkMsaUJBQWlCLEVBQUUsSUFBSTtNQUN2QkMsUUFBUSxFQUFFUDtJQUNaLENBQUMsQ0FBQztJQUVKLEtBQUssQ0FBQyxZQUFZO01BQ2hCO01BQ0E7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLE1BQU1RLFFBQVEsR0FBR0MsSUFBSSxDQUFDQyxHQUFHLENBQUMsQ0FBQyxHQUFHekMscUJBQXFCO01BQ25ELE9BQU93QyxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEdBQUdGLFFBQVEsRUFBRTtRQUM1QixNQUFNRyxDQUFDLEdBQUd2QyxPQUFPLENBQUN3QixXQUFXLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUNlLENBQUMsQ0FBQ0MsR0FBRyxDQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQ0MsQ0FBQyxJQUFJQSxDQUFDLENBQUNDLElBQUksS0FBSyxTQUFTLENBQUMsRUFBRTtRQUNwRCxNQUFNNUQsS0FBSyxDQUFDWSxrQkFBa0IsQ0FBQztNQUNqQztNQUNBLE1BQU1pRCxVQUFVLEdBQ2Q3QyxPQUFPLENBQUM4QyxPQUFPLENBQUNDLFlBQVksR0FBRyxDQUFDLElBQUkvQyxPQUFPLENBQUM4QyxPQUFPLENBQUNFLEtBQUs7TUFFM0QsTUFBTUMsYUFBYSxFQUFFeEgsT0FBTyxFQUFFLEdBQUcsRUFBRTtNQUNuQyxXQUFXLE1BQU15SCxPQUFPLElBQUl4RyxRQUFRLENBQUM7UUFDbkMyRSxlQUFlO1FBQ2ZELGNBQWM7UUFDZCtCLGNBQWMsRUFBRTtVQUNkLEdBQUduRCxPQUFPO1VBQ1Z3QixXQUFXLEVBQUVOLG1CQUFtQjtVQUNoQ2tDLGVBQWUsRUFBRTFCO1FBQ25CLENBQUM7UUFDRHZCLFVBQVU7UUFDVmtELE9BQU8sRUFBRSxJQUFJO1FBQ2JDLFdBQVcsRUFBRSxjQUFjO1FBQzNCQyxLQUFLLEVBQUU1RCxPQUFPLENBQUM0RCxLQUFLLElBQUkvRSxVQUFVLEdBQUcsU0FBUztRQUM5Q2dGLGNBQWMsRUFBRVgsVUFBVTtRQUMxQlksUUFBUSxFQUFFO1VBQUVwRDtRQUFRO01BQ3RCLENBQUMsQ0FBQyxFQUFFO1FBQ0Y0QyxhQUFhLENBQUNTLElBQUksQ0FBQ1IsT0FBTyxDQUFDO01BQzdCO01BQ0EsTUFBTVMsVUFBVSxHQUFHckcsaUJBQWlCLENBQUMyRixhQUFhLEVBQUUsbUJBQW1CLENBQUM7TUFDeEVoRyxlQUFlLENBQ2IsOEJBQThCMEUsV0FBVyxxQkFBcUJ0QixPQUFPLEdBQ3ZFLENBQUM7TUFDRHdCLGFBQWEsQ0FDWCxvQ0FBb0NGLFdBQVcsT0FBT2dDLFVBQVUsNEJBQ2xFLENBQUM7SUFDSCxDQUFDLEVBQUUsQ0FBQyxDQUFDQyxLQUFLLENBQUNDLEdBQUcsSUFBSTtNQUNoQmpHLFFBQVEsQ0FBQ2lHLEdBQUcsQ0FBQztNQUNiaEMsYUFBYSxDQUNYLG9DQUFvQ0YsV0FBVyx1QkFBdUJrQyxHQUFHLFlBQVlDLEtBQUssR0FBR0QsR0FBRyxDQUFDWCxPQUFPLEdBQUdhLE1BQU0sQ0FBQ0YsR0FBRyxDQUFDLDRCQUN4SCxDQUFDO0lBQ0gsQ0FBQyxDQUFDOztJQUVGO0lBQ0E7SUFDQSxPQUFPO01BQUVHLFFBQVEsRUFBRSxFQUFFO01BQUVDLFdBQVcsRUFBRSxLQUFLO01BQUV0RTtJQUFRLENBQUM7RUFDdEQ7O0VBRUE7RUFDQSxNQUFNc0QsYUFBYSxFQUFFeEgsT0FBTyxFQUFFLEdBQUcsRUFBRTs7RUFFbkM7RUFDQSxNQUFNeUksZ0JBQWdCLEVBQUV2SSxlQUFlLENBQUNjLGFBQWEsQ0FBQyxFQUFFLEdBQUcsRUFBRTtFQUM3RCxNQUFNMEgsZUFBZSxHQUFHLGtCQUFrQnhFLE9BQU8sQ0FBQ2lCLElBQUksRUFBRTtFQUN4RCxJQUFJd0QsY0FBYyxHQUFHLENBQUM7O0VBRXRCO0VBQ0EsTUFBTUMscUJBQXFCLEdBQUdBLENBQzVCbkIsT0FBTyxFQUFFM0gsZ0JBQWdCLEdBQUdHLHFCQUFxQixDQUNsRCxFQUFFQyxlQUFlLENBQUNjLGFBQWEsQ0FBQyxJQUFJO0lBQ25DMkgsY0FBYyxFQUFFO0lBQ2hCLE9BQU87TUFDTHhCLElBQUksRUFBRSxVQUFVO01BQ2hCMEIsSUFBSSxFQUFFO1FBQ0pwQixPQUFPO1FBQ1BOLElBQUksRUFBRSxnQkFBZ0I7UUFDdEIyQixNQUFNLEVBQUV0RCxZQUFZO1FBQ3BCWjtNQUNGLENBQUM7TUFDRDhELGVBQWU7TUFDZkssU0FBUyxFQUFFLEdBQUdMLGVBQWUsSUFBSUMsY0FBYyxFQUFFO01BQ2pESyxTQUFTLEVBQUUsSUFBSXBDLElBQUksQ0FBQyxDQUFDLENBQUNxQyxXQUFXLENBQUMsQ0FBQztNQUNuQ0MsSUFBSSxFQUFFakssVUFBVSxDQUFDO0lBQ25CLENBQUM7RUFDSCxDQUFDOztFQUVEO0VBQ0EsTUFBTWtLLGNBQWMsR0FBR0EsQ0FBQSxDQUFFLEVBQUUsSUFBSSxJQUFJO0lBQ2pDMUUsVUFBVSxDQUFDO01BQ1QyRSxHQUFHLEVBQUVsSSw0QkFBNEIsQ0FBQ3VILGdCQUFnQixFQUFFO1FBQ2xEbEIsS0FBSyxFQUFFaEQsT0FBTyxDQUFDOEMsT0FBTyxDQUFDRSxLQUFLO1FBQzVCOEIsT0FBTyxFQUFFO01BQ1gsQ0FBQyxDQUFDO01BQ0ZDLHFCQUFxQixFQUFFLEtBQUs7TUFDNUJDLHVCQUF1QixFQUFFLElBQUk7TUFDN0JDLFdBQVcsRUFBRTtJQUNmLENBQUMsQ0FBQztFQUNKLENBQUM7O0VBRUQ7RUFDQUwsY0FBYyxDQUFDLENBQUM7O0VBRWhCO0VBQ0EsSUFBSTtJQUNGLFdBQVcsTUFBTTFCLE9BQU8sSUFBSXhHLFFBQVEsQ0FBQztNQUNuQzJFLGVBQWU7TUFDZkQsY0FBYztNQUNkK0IsY0FBYyxFQUFFO1FBQ2QsR0FBR25ELE9BQU87UUFDVndCLFdBQVcsRUFBRU47TUFDZixDQUFDO01BQ0RmLFVBQVU7TUFDVmtELE9BQU8sRUFBRSxLQUFLO01BQ2RDLFdBQVcsRUFBRSxjQUFjO01BQzNCQyxLQUFLLEVBQUU1RCxPQUFPLENBQUM0RCxLQUFLLElBQUkvRSxVQUFVLEdBQUcsU0FBUztNQUM5Q2dGLGNBQWMsRUFBRXhELE9BQU8sQ0FBQzhDLE9BQU8sQ0FBQ0U7SUFDbEMsQ0FBQyxDQUFDLEVBQUU7TUFDRkMsYUFBYSxDQUFDUyxJQUFJLENBQUNSLE9BQU8sQ0FBQztNQUMzQixNQUFNZ0MsYUFBYSxHQUFHNUcsaUJBQWlCLENBQUMsQ0FBQzRFLE9BQU8sQ0FBQyxDQUFDOztNQUVsRDtNQUNBLElBQUlBLE9BQU8sQ0FBQ04sSUFBSSxLQUFLLFdBQVcsRUFBRTtRQUNoQztRQUNBLE1BQU11QyxhQUFhLEdBQUc5RixnQ0FBZ0MsQ0FBQzZELE9BQU8sQ0FBQztRQUMvRCxJQUFJaUMsYUFBYSxHQUFHLENBQUMsRUFBRTtVQUNyQm5GLE9BQU8sQ0FBQ29GLGlCQUFpQixDQUFDQyxHQUFHLElBQUlBLEdBQUcsR0FBR0YsYUFBYSxDQUFDO1FBQ3ZEO1FBRUEsTUFBTUcsYUFBYSxHQUFHSixhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLElBQUlJLGFBQWEsSUFBSUEsYUFBYSxDQUFDMUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtVQUN2RHNCLGdCQUFnQixDQUFDUixJQUFJLENBQUNXLHFCQUFxQixDQUFDbkIsT0FBTyxDQUFDLENBQUM7VUFDckQwQixjQUFjLENBQUMsQ0FBQztRQUNsQjtNQUNGOztNQUVBO01BQ0EsSUFBSTFCLE9BQU8sQ0FBQ04sSUFBSSxLQUFLLE1BQU0sRUFBRTtRQUMzQixNQUFNMEMsYUFBYSxHQUFHSixhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3RDLElBQUlJLGFBQWEsSUFBSUEsYUFBYSxDQUFDMUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtVQUNsRHNCLGdCQUFnQixDQUFDUixJQUFJLENBQUNXLHFCQUFxQixDQUFDaUIsYUFBYSxDQUFDLENBQUM7VUFDM0RWLGNBQWMsQ0FBQyxDQUFDO1FBQ2xCO01BQ0Y7SUFDRjtFQUNGLENBQUMsU0FBUztJQUNSO0lBQ0ExRSxVQUFVLENBQUMsSUFBSSxDQUFDO0VBQ2xCO0VBRUEsSUFBSXlELFVBQVUsR0FBR3JHLGlCQUFpQixDQUFDMkYsYUFBYSxFQUFFLG1CQUFtQixDQUFDO0VBRXRFaEcsZUFBZSxDQUNiLHlCQUF5QjBDLE9BQU8sQ0FBQ2lCLElBQUkseUJBQXlCUCxPQUFPLEVBQ3ZFLENBQUM7O0VBRUQ7RUFDQSxJQUFJLFVBQVUsS0FBSyxLQUFLLEVBQUU7SUFDeEJzRCxVQUFVLEdBQUcseUJBQXlCdEcsY0FBYyxDQUFDaEIsa0JBQWtCLENBQUNnRSxPQUFPLENBQUMsQ0FBQyxLQUFLc0QsVUFBVSxFQUFFO0VBQ3BHOztFQUVBO0VBQ0EsTUFBTUssUUFBUSxFQUFFcEksV0FBVyxFQUFFLEdBQUcsQ0FDOUJzQyxpQkFBaUIsQ0FBQztJQUNoQnFILE9BQU8sRUFBRWhILGtCQUFrQixDQUFDO01BQzFCaUgsV0FBVyxFQUFFLElBQUl2SyxjQUFjLENBQUMwRSxPQUFPLENBQUMsSUFBSUksSUFBSSxFQUFFLENBQUMwRixJQUFJLENBQUMsQ0FBQztNQUN6RHhGO0lBQ0YsQ0FBQztFQUNILENBQUMsQ0FBQyxFQUNGL0IsaUJBQWlCLENBQUM7SUFDaEJxSCxPQUFPLEVBQUUsMkJBQTJCNUIsVUFBVTtFQUNoRCxDQUFDLENBQUMsQ0FDSDtFQUVELE9BQU87SUFDTEssUUFBUTtJQUNSQyxXQUFXLEVBQUUsS0FBSztJQUNsQnRFLE9BQU87SUFDUGdFO0VBQ0YsQ0FBQztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsT0FBTyxTQUFTK0IsZ0JBQWdCQSxDQUFDL0QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxFQUFFLE9BQU8sQ0FBQztFQUM3RDtFQUNBO0VBQ0EsT0FBTyxDQUFDLGtCQUFrQixDQUFDZ0UsSUFBSSxDQUFDaEUsV0FBVyxDQUFDO0FBQzlDO0FBRUEsT0FBTyxlQUFlaUUsbUJBQW1CQSxDQUN2Q0osV0FBVyxFQUFFLE1BQU0sRUFDbkJ2RixvQkFBb0IsRUFBRXpGLGlCQUFpQixFQUFFLEVBQ3pDcUwsa0JBQWtCLEVBQUVyTCxpQkFBaUIsRUFBRSxFQUN2Q3NMLGtCQUFrQixFQUFFdEssaUJBQWlCLEVBQUUsRUFDdkN3RSxPQUFPLEVBQUVQLHVCQUF1QixFQUNoQ1MsVUFBVSxFQUFFN0UsWUFBWSxFQUN4QnNKLElBQWEsQ0FBUixFQUFFLE1BQU0sRUFDYm9CLG1CQUE2QixDQUFULEVBQUUsT0FBTyxFQUM3QjVGLFVBQXlCLENBQWQsRUFBRWxFLFlBQVksQ0FDMUIsRUFBRW1FLE9BQU8sQ0FBQ1osMEJBQTBCLENBQUMsQ0FBQztFQUNyQyxNQUFNd0csTUFBTSxHQUFHakgsaUJBQWlCLENBQUN5RyxXQUFXLENBQUM7RUFDN0MsSUFBSSxDQUFDUSxNQUFNLEVBQUU7SUFDWDVKLFFBQVEsQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QyxNQUFNNkosWUFBWSxHQUFHLDRDQUE0QztJQUNqRSxPQUFPO01BQ0xqQyxRQUFRLEVBQUUsQ0FDUmpHLGdDQUFnQyxDQUFDLENBQUMsRUFDbEMsR0FBRytILGtCQUFrQixFQUNyQjVILGlCQUFpQixDQUFDO1FBQ2hCcUgsT0FBTyxFQUFFaEgsa0JBQWtCLENBQUM7VUFDMUJpSCxXQUFXLEVBQUVTLFlBQVk7VUFDekJoRztRQUNGLENBQUM7TUFDSCxDQUFDLENBQUMsQ0FDSDtNQUNEZ0UsV0FBVyxFQUFFLEtBQUs7TUFDbEJOLFVBQVUsRUFBRXNDO0lBQ2QsQ0FBQztFQUNIO0VBRUEsTUFBTTtJQUFFdEUsV0FBVztJQUFFNUIsSUFBSSxFQUFFbUcsVUFBVTtJQUFFQztFQUFNLENBQUMsR0FBR0gsTUFBTTtFQUV2RCxNQUFNSSxvQkFBb0IsR0FBR0QsS0FBSyxHQUM5QixLQUFLLEdBQ0wsQ0FBQ3ZMLG1CQUFtQixDQUFDLENBQUMsQ0FBQ3lMLEdBQUcsQ0FBQzFFLFdBQVcsQ0FBQyxHQUNyQyxRQUFRLEdBQ1JBLFdBQVc7O0VBRWpCO0VBQ0EsSUFBSSxDQUFDekcsVUFBVSxDQUFDeUcsV0FBVyxFQUFFM0IsT0FBTyxDQUFDOEMsT0FBTyxDQUFDd0QsUUFBUSxDQUFDLEVBQUU7SUFDdEQ7SUFDQTtJQUNBLElBQUlDLFVBQVUsR0FBRyxLQUFLO0lBQ3RCLElBQUk7TUFDRixNQUFNL0ksbUJBQW1CLENBQUMsQ0FBQyxDQUFDZ0osSUFBSSxDQUFDLElBQUk3RSxXQUFXLEVBQUUsQ0FBQztNQUNuRDRFLFVBQVUsR0FBRyxJQUFJO0lBQ25CLENBQUMsQ0FBQyxNQUFNO01BQ047SUFBQTtJQUVGLElBQUliLGdCQUFnQixDQUFDL0QsV0FBVyxDQUFDLElBQUksQ0FBQzRFLFVBQVUsRUFBRTtNQUNoRG5LLFFBQVEsQ0FBQywyQkFBMkIsRUFBRTtRQUNwQ3FLLEtBQUssRUFDSDlFLFdBQVcsSUFBSXpGO01BQ25CLENBQUMsQ0FBQztNQUVGLE1BQU13SyxjQUFjLEdBQUcsa0JBQWtCL0UsV0FBVyxFQUFFO01BQ3RELE9BQU87UUFDTHFDLFFBQVEsRUFBRSxDQUNSakcsZ0NBQWdDLENBQUMsQ0FBQyxFQUNsQyxHQUFHK0gsa0JBQWtCLEVBQ3JCNUgsaUJBQWlCLENBQUM7VUFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztZQUMxQmlILFdBQVcsRUFBRWtCLGNBQWM7WUFDM0J6RztVQUNGLENBQUM7UUFDSCxDQUFDLENBQUM7UUFDRjtRQUNBO1FBQ0EsSUFBSWlHLFVBQVUsR0FDVixDQUNFbEksbUJBQW1CLENBQ2pCLDRCQUE0QmtJLFVBQVUsRUFBRSxFQUN4QyxTQUNGLENBQUMsQ0FDRixHQUNELEVBQUUsQ0FBQyxDQUNSO1FBQ0RqQyxXQUFXLEVBQUUsS0FBSztRQUNsQk4sVUFBVSxFQUFFK0M7TUFDZCxDQUFDO0lBQ0g7SUFFQSxNQUFNQyxRQUFRLEdBQUdqTSxVQUFVLENBQUMsQ0FBQztJQUM3QkMsV0FBVyxDQUFDZ00sUUFBUSxDQUFDO0lBQ3JCdkssUUFBUSxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDO0lBQ0EsS0FBSzhDLFlBQVksQ0FBQyxhQUFhLEVBQUU7TUFDL0IwSCxhQUFhLEVBQUU3QyxNQUFNLENBQUN5QixXQUFXLENBQUNxQixNQUFNLENBQUM7TUFDekN0QyxNQUFNLEVBQUVwRixnQkFBZ0IsQ0FBQ3FHLFdBQVcsQ0FBQztNQUNyQyxXQUFXLEVBQUVtQjtJQUNmLENBQUMsQ0FBQztJQUNGLE9BQU87TUFDTDNDLFFBQVEsRUFBRSxDQUNSOUYsaUJBQWlCLENBQUM7UUFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztVQUFFaUgsV0FBVztVQUFFdkY7UUFBcUIsQ0FBQyxDQUFDO1FBQ2xFMEUsSUFBSSxFQUFFQTtNQUNSLENBQUMsQ0FBQyxFQUNGLEdBQUdtQixrQkFBa0IsQ0FDdEI7TUFDRDdCLFdBQVcsRUFBRTtJQUNmLENBQUM7RUFDSDs7RUFFQTs7RUFFQSxNQUFNO0lBQ0pELFFBQVEsRUFBRThDLFdBQVc7SUFDckI3QyxXQUFXLEVBQUU4QyxrQkFBa0I7SUFDL0JDLFlBQVk7SUFDWnpELEtBQUs7SUFDTGpDLE1BQU07SUFDTjNCLE9BQU8sRUFBRXNILGVBQWU7SUFDeEJ0RCxVQUFVO0lBQ1Z1RCxTQUFTO0lBQ1RDO0VBQ0YsQ0FBQyxHQUFHLE1BQU1DLDBCQUEwQixDQUNsQ3pGLFdBQVcsRUFDWHVFLFVBQVUsRUFDVmhHLFVBQVUsRUFDVkYsT0FBTyxFQUNQQyxvQkFBb0IsRUFDcEI0RixrQkFBa0IsRUFDbEJFLG1CQUFtQixFQUNuQjVGLFVBQVUsRUFDVndFLElBQ0YsQ0FBQzs7RUFFRDtFQUNBLElBQUltQyxXQUFXLENBQUNELE1BQU0sS0FBSyxDQUFDLEVBQUU7SUFDNUIsTUFBTVEsU0FBUyxFQUFFQyxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sR0FBRyxNQUFNLEdBQUcsU0FBUyxDQUFDLEdBQUc7TUFDOURiLEtBQUssRUFDSEwsb0JBQW9CLElBQUlsSztJQUM1QixDQUFDOztJQUVEO0lBQ0EsSUFBSStLLGVBQWUsQ0FBQ3JFLElBQUksS0FBSyxRQUFRLElBQUlxRSxlQUFlLENBQUMxRyxVQUFVLEVBQUU7TUFDbkUsTUFBTTtRQUFFUSxjQUFjO1FBQUVQO01BQVcsQ0FBQyxHQUFHeUcsZUFBZSxDQUFDMUcsVUFBVTtNQUNqRSxNQUFNO1FBQUVFO01BQVksQ0FBQyxHQUFHN0IscUJBQXFCLENBQUM0QixVQUFVLENBQUM7TUFDekQsTUFBTStHLFVBQVUsR0FBRzVJLHlCQUF5QixDQUFDOEIsV0FBVyxDQUFDO01BQ3pEO01BQ0E7TUFDQTtNQUNBNEcsU0FBUyxDQUFDdkcsa0JBQWtCLEdBQzFCQyxjQUFjLENBQUNILElBQUksSUFBSXpFLCtDQUErQztNQUN4RSxJQUFJc0UsV0FBVyxFQUFFO1FBQ2Y0RyxTQUFTLENBQUNyRyx1QkFBdUIsR0FDL0JQLFdBQVcsSUFBSXRFLCtDQUErQztNQUNsRTtNQUNBa0wsU0FBUyxDQUFDRyxpQkFBaUIsR0FBRyxDQUM1QkQsVUFBVSxHQUFHL0csVUFBVSxHQUFHLGFBQWEsS0FDcEN0RSwwREFBMEQ7TUFDL0RtTCxTQUFTLENBQUNJLFdBQVcsR0FBRyxDQUN0QkYsVUFBVSxHQUFHeEcsY0FBYyxDQUFDSCxJQUFJLEdBQUcsYUFBYSxLQUM3QzFFLDBEQUEwRDtNQUMvRCxJQUFJcUwsVUFBVSxJQUFJeEcsY0FBYyxDQUFDMkcsT0FBTyxFQUFFO1FBQ3hDTCxTQUFTLENBQUNNLGNBQWMsR0FDdEI1RyxjQUFjLENBQUMyRyxPQUFPLElBQUl4TCwwREFBMEQ7TUFDeEY7TUFDQTBMLE1BQU0sQ0FBQ0MsTUFBTSxDQUNYUixTQUFTLEVBQ1RqSSxpQ0FBaUMsQ0FBQzZILGVBQWUsQ0FBQzFHLFVBQVUsQ0FDOUQsQ0FBQztJQUNIO0lBRUFuRSxRQUFRLENBQUMscUJBQXFCLEVBQUU7TUFDOUIsR0FBR2lMLFNBQVM7TUFDWnhHLGtCQUFrQixFQUNoQixZQUFZLElBQUkzRSwwREFBMEQ7TUFDNUUsSUFBSSxVQUFVLEtBQUssS0FBSyxJQUFJO1FBQzFCNEwsVUFBVSxFQUNSbkcsV0FBVyxJQUFJekYsMERBQTBEO1FBQzNFLElBQUkrSyxlQUFlLENBQUNyRSxJQUFJLEtBQUssUUFBUSxJQUFJO1VBQ3ZDbUYsWUFBWSxFQUNWZCxlQUFlLENBQUNlLE1BQU0sSUFBSTlMO1FBQzlCLENBQUMsQ0FBQztRQUNGLElBQUkrSyxlQUFlLENBQUNnQixVQUFVLElBQUk7VUFDaENDLGlCQUFpQixFQUNmakIsZUFBZSxDQUFDZ0IsVUFBVSxJQUFJL0w7UUFDbEMsQ0FBQyxDQUFDO1FBQ0YsSUFBSStLLGVBQWUsQ0FBQ2tCLElBQUksSUFBSTtVQUMxQkMsVUFBVSxFQUNSbkIsZUFBZSxDQUFDa0IsSUFBSSxJQUFJak07UUFDNUIsQ0FBQztNQUNILENBQUM7SUFDSCxDQUFDLENBQUM7SUFDRixPQUFPO01BQ0w4SCxRQUFRLEVBQUUsRUFBRTtNQUNaQyxXQUFXLEVBQUUsS0FBSztNQUVsQlYsS0FBSztNQUNMMkQsU0FBUztNQUNUQztJQUNGLENBQUM7RUFDSDs7RUFFQTtFQUNBLElBQ0VMLFdBQVcsQ0FBQ0QsTUFBTSxLQUFLLENBQUMsSUFDeEJDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDbEUsSUFBSSxLQUFLLE1BQU0sSUFDL0IsT0FBT2tFLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDNUQsT0FBTyxDQUFDcUMsT0FBTyxLQUFLLFFBQVEsSUFDbkR1QixXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzVELE9BQU8sQ0FBQ3FDLE9BQU8sQ0FBQzhDLFVBQVUsQ0FBQyxrQkFBa0IsQ0FBQyxFQUM5RDtJQUNBO0lBQ0EsTUFBTUMsaUJBQWlCLEdBQ3JCOUMsV0FBVyxDQUFDNkMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxJQUM5QjdDLFdBQVcsQ0FBQzZDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFDOUI3QyxXQUFXLENBQUM2QyxVQUFVLENBQUMsVUFBVSxDQUFDO0lBRXBDLElBQUksQ0FBQ0MsaUJBQWlCLEVBQUU7TUFDdEJsTSxRQUFRLENBQUMsMkJBQTJCLEVBQUU7UUFDcENxSyxLQUFLLEVBQ0g5RSxXQUFXLElBQUl6RjtNQUNuQixDQUFDLENBQUM7SUFDSjtJQUVBLE9BQU87TUFDTDhILFFBQVEsRUFBRSxDQUFDakcsZ0NBQWdDLENBQUMsQ0FBQyxFQUFFLEdBQUcrSSxXQUFXLENBQUM7TUFDOUQ3QyxXQUFXLEVBQUU4QyxrQkFBa0I7TUFDL0JDLFlBQVk7TUFFWnpEO0lBQ0YsQ0FBQztFQUNIOztFQUVBO0VBQ0EsTUFBTThELFNBQVMsRUFBRUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxPQUFPLEdBQUcsTUFBTSxHQUFHLFNBQVMsQ0FBQyxHQUFHO0lBQzlEYixLQUFLLEVBQ0hMLG9CQUFvQixJQUFJbEs7RUFDNUIsQ0FBQzs7RUFFRDtFQUNBLElBQUkrSyxlQUFlLENBQUNyRSxJQUFJLEtBQUssUUFBUSxJQUFJcUUsZUFBZSxDQUFDMUcsVUFBVSxFQUFFO0lBQ25FLE1BQU07TUFBRVEsY0FBYztNQUFFUDtJQUFXLENBQUMsR0FBR3lHLGVBQWUsQ0FBQzFHLFVBQVU7SUFDakUsTUFBTTtNQUFFRTtJQUFZLENBQUMsR0FBRzdCLHFCQUFxQixDQUFDNEIsVUFBVSxDQUFDO0lBQ3pELE1BQU0rRyxVQUFVLEdBQUc1SSx5QkFBeUIsQ0FBQzhCLFdBQVcsQ0FBQztJQUN6RDRHLFNBQVMsQ0FBQ3ZHLGtCQUFrQixHQUMxQkMsY0FBYyxDQUFDSCxJQUFJLElBQUl6RSwrQ0FBK0M7SUFDeEUsSUFBSXNFLFdBQVcsRUFBRTtNQUNmNEcsU0FBUyxDQUFDckcsdUJBQXVCLEdBQy9CUCxXQUFXLElBQUl0RSwrQ0FBK0M7SUFDbEU7SUFDQWtMLFNBQVMsQ0FBQ0csaUJBQWlCLEdBQUcsQ0FDNUJELFVBQVUsR0FBRy9HLFVBQVUsR0FBRyxhQUFhLEtBQ3BDdEUsMERBQTBEO0lBQy9EbUwsU0FBUyxDQUFDSSxXQUFXLEdBQUcsQ0FDdEJGLFVBQVUsR0FBR3hHLGNBQWMsQ0FBQ0gsSUFBSSxHQUFHLGFBQWEsS0FDN0MxRSwwREFBMEQ7SUFDL0QsSUFBSXFMLFVBQVUsSUFBSXhHLGNBQWMsQ0FBQzJHLE9BQU8sRUFBRTtNQUN4Q0wsU0FBUyxDQUFDTSxjQUFjLEdBQ3RCNUcsY0FBYyxDQUFDMkcsT0FBTyxJQUFJeEwsMERBQTBEO0lBQ3hGO0lBQ0EwTCxNQUFNLENBQUNDLE1BQU0sQ0FDWFIsU0FBUyxFQUNUakksaUNBQWlDLENBQUM2SCxlQUFlLENBQUMxRyxVQUFVLENBQzlELENBQUM7RUFDSDtFQUVBbkUsUUFBUSxDQUFDLHFCQUFxQixFQUFFO0lBQzlCLEdBQUdpTCxTQUFTO0lBQ1p4RyxrQkFBa0IsRUFDaEIsWUFBWSxJQUFJM0UsMERBQTBEO0lBQzVFLElBQUksVUFBVSxLQUFLLEtBQUssSUFBSTtNQUMxQjRMLFVBQVUsRUFDUm5HLFdBQVcsSUFBSXpGLDBEQUEwRDtNQUMzRSxJQUFJK0ssZUFBZSxDQUFDckUsSUFBSSxLQUFLLFFBQVEsSUFBSTtRQUN2Q21GLFlBQVksRUFDVmQsZUFBZSxDQUFDZSxNQUFNLElBQUk5TDtNQUM5QixDQUFDLENBQUM7TUFDRixJQUFJK0ssZUFBZSxDQUFDZ0IsVUFBVSxJQUFJO1FBQ2hDQyxpQkFBaUIsRUFDZmpCLGVBQWUsQ0FBQ2dCLFVBQVUsSUFBSS9MO01BQ2xDLENBQUMsQ0FBQztNQUNGLElBQUkrSyxlQUFlLENBQUNrQixJQUFJLElBQUk7UUFDMUJDLFVBQVUsRUFDUm5CLGVBQWUsQ0FBQ2tCLElBQUksSUFBSWpNO01BQzVCLENBQUM7SUFDSCxDQUFDO0VBQ0gsQ0FBQyxDQUFDOztFQUVGO0VBQ0EsTUFBTXFNLGVBQWUsR0FDbkJ6QixXQUFXLENBQUNELE1BQU0sR0FBRyxDQUFDLElBQ3RCQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQ2QxSSx3QkFBd0IsQ0FBQzBJLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUUxQyxPQUFPO0lBQ0w5QyxRQUFRLEVBQ04rQyxrQkFBa0IsSUFDbEJELFdBQVcsQ0FBQzBCLEtBQUssQ0FBQ25LLDJCQUEyQixDQUFDLElBQzlDa0ssZUFBZSxHQUNYekIsV0FBVyxHQUNYLENBQUMvSSxnQ0FBZ0MsQ0FBQyxDQUFDLEVBQUUsR0FBRytJLFdBQVcsQ0FBQztJQUMxRDdDLFdBQVcsRUFBRThDLGtCQUFrQjtJQUMvQkMsWUFBWTtJQUNaekQsS0FBSztJQUNMakMsTUFBTTtJQUNOcUMsVUFBVTtJQUNWdUQsU0FBUztJQUNUQztFQUNGLENBQUM7QUFDSDtBQUVBLGVBQWVDLDBCQUEwQkEsQ0FDdkN6RixXQUFXLEVBQUUsTUFBTSxFQUNuQjVCLElBQUksRUFBRSxNQUFNLEVBQ1pHLFVBQVUsRUFBRTdFLFlBQVksRUFDeEIyRSxPQUFPLEVBQUVQLHVCQUF1QixFQUNoQ1Esb0JBQW9CLEVBQUV6RixpQkFBaUIsRUFBRSxFQUN6Q3FMLGtCQUFrQixFQUFFckwsaUJBQWlCLEVBQUUsRUFDdkNpTyxvQkFBOEIsQ0FBVCxFQUFFLE9BQU8sRUFDOUJ0SSxVQUF5QixDQUFkLEVBQUVsRSxZQUFZLEVBQ3pCMEksSUFBYSxDQUFSLEVBQUUsTUFBTSxDQUNkLEVBQUV2RSxPQUFPLENBQUNWLGtCQUFrQixDQUFDLENBQUM7RUFDN0IsTUFBTUMsT0FBTyxHQUFHM0UsVUFBVSxDQUFDMkcsV0FBVyxFQUFFM0IsT0FBTyxDQUFDOEMsT0FBTyxDQUFDd0QsUUFBUSxDQUFDOztFQUVqRTtFQUNBLElBQUkzRyxPQUFPLENBQUNpRCxJQUFJLEtBQUssUUFBUSxJQUFJakQsT0FBTyxDQUFDK0ksYUFBYSxLQUFLLEtBQUssRUFBRTtJQUNoRXpKLGdCQUFnQixDQUFDMEMsV0FBVyxDQUFDO0VBQy9COztFQUVBO0VBQ0E7RUFDQSxJQUFJaEMsT0FBTyxDQUFDK0ksYUFBYSxLQUFLLEtBQUssRUFBRTtJQUNuQyxPQUFPO01BQ0wxRSxRQUFRLEVBQUUsQ0FDUjlGLGlCQUFpQixDQUFDO1FBQ2hCcUgsT0FBTyxFQUFFaEgsa0JBQWtCLENBQUM7VUFDMUJpSCxXQUFXLEVBQUUsSUFBSTdELFdBQVcsRUFBRTtVQUM5QjFCO1FBQ0YsQ0FBQztNQUNILENBQUMsQ0FBQyxFQUNGL0IsaUJBQWlCLENBQUM7UUFDaEJxSCxPQUFPLEVBQUUsMkZBQTJGNUQsV0FBVztNQUNqSCxDQUFDLENBQUMsQ0FDSDtNQUNEc0MsV0FBVyxFQUFFLEtBQUs7TUFDbEJ0RTtJQUNGLENBQUM7RUFDSDtFQUVBLElBQUk7SUFDRixRQUFRQSxPQUFPLENBQUNpRCxJQUFJO01BQ2xCLEtBQUssV0FBVztRQUFFO1VBQ2hCLE9BQU8sSUFBSXhDLE9BQU8sQ0FBQ1Ysa0JBQWtCLENBQUMsQ0FBQ2lKLE9BQU8sSUFBSTtZQUNoRCxJQUFJQyxhQUFhLEdBQUcsS0FBSztZQUN6QixNQUFNQyxNQUFNLEdBQUdBLENBQ2JDLE1BQWUsQ0FBUixFQUFFLE1BQU0sRUFDZmhHLE9BTUMsQ0FOTyxFQUFFO2NBQ1JpRyxPQUFPLENBQUMsRUFBRW5NLG9CQUFvQjtjQUM5QnFILFdBQVcsQ0FBQyxFQUFFLE9BQU87Y0FDckIrRSxZQUFZLENBQUMsRUFBRSxNQUFNLEVBQUU7Y0FDdkI5QixTQUFTLENBQUMsRUFBRSxNQUFNO2NBQ2xCQyxlQUFlLENBQUMsRUFBRSxPQUFPO1lBQzNCLENBQUMsS0FDRTtjQUNIeUIsYUFBYSxHQUFHLElBQUk7Y0FDcEI7Y0FDQSxJQUFJOUYsT0FBTyxFQUFFaUcsT0FBTyxLQUFLLE1BQU0sRUFBRTtnQkFDL0IsS0FBS0osT0FBTyxDQUFDO2tCQUNYM0UsUUFBUSxFQUFFLEVBQUU7a0JBQ1pDLFdBQVcsRUFBRSxLQUFLO2tCQUNsQnRFLE9BQU87a0JBQ1B1SCxTQUFTLEVBQUVwRSxPQUFPLEVBQUVvRSxTQUFTO2tCQUM3QkMsZUFBZSxFQUFFckUsT0FBTyxFQUFFcUU7Z0JBQzVCLENBQUMsQ0FBQztnQkFDRjtjQUNGOztjQUVBO2NBQ0EsTUFBTTZCLFlBQVksR0FBRyxDQUFDbEcsT0FBTyxFQUFFa0csWUFBWSxJQUFJLEVBQUUsRUFBRUMsR0FBRyxDQUNwRCxDQUFDMUQsT0FBTyxFQUFFLE1BQU0sS0FBS3JILGlCQUFpQixDQUFDO2dCQUFFcUgsT0FBTztnQkFBRXRELE1BQU0sRUFBRTtjQUFLLENBQUMsQ0FDbEUsQ0FBQzs7Y0FFRDtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBLE1BQU1pSCxjQUFjLEdBQ2xCekwsc0JBQXNCLENBQUMsQ0FBQyxJQUN4QixPQUFPcUwsTUFBTSxLQUFLLFFBQVEsSUFDMUJBLE1BQU0sQ0FBQ0ssUUFBUSxDQUFDLFlBQVksQ0FBQztjQUUvQixLQUFLUixPQUFPLENBQUM7Z0JBQ1gzRSxRQUFRLEVBQ05sQixPQUFPLEVBQUVpRyxPQUFPLEtBQUssUUFBUSxHQUN6QkcsY0FBYyxHQUNaRixZQUFZLEdBQ1osQ0FDRWxMLHlCQUF5QixDQUN2QnNMLGtCQUFrQixDQUFDekosT0FBTyxFQUFFSSxJQUFJLENBQ2xDLENBQUMsRUFDRGpDLHlCQUF5QixDQUN2Qix5QkFBeUJnTCxNQUFNLHlCQUNqQyxDQUFDLEVBQ0QsR0FBR0UsWUFBWSxDQUNoQixHQUNILENBQ0U5SyxpQkFBaUIsQ0FBQztrQkFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztvQkFDMUJpSCxXQUFXLEVBQUU0RCxrQkFBa0IsQ0FBQ3pKLE9BQU8sRUFBRUksSUFBSSxDQUFDO29CQUM5Q0U7a0JBQ0YsQ0FBQztnQkFDSCxDQUFDLENBQUMsRUFDRjZJLE1BQU0sR0FDRjVLLGlCQUFpQixDQUFDO2tCQUNoQnFILE9BQU8sRUFBRSx5QkFBeUJ1RCxNQUFNO2dCQUMxQyxDQUFDLENBQUMsR0FDRjVLLGlCQUFpQixDQUFDO2tCQUNoQnFILE9BQU8sRUFBRSx5QkFBeUJuSyxrQkFBa0I7Z0JBQ3RELENBQUMsQ0FBQyxFQUNOLEdBQUc0TixZQUFZLENBQ2hCO2dCQUNQL0UsV0FBVyxFQUFFbkIsT0FBTyxFQUFFbUIsV0FBVyxJQUFJLEtBQUs7Z0JBQzFDdEUsT0FBTztnQkFDUHVILFNBQVMsRUFBRXBFLE9BQU8sRUFBRW9FLFNBQVM7Z0JBQzdCQyxlQUFlLEVBQUVyRSxPQUFPLEVBQUVxRTtjQUM1QixDQUFDLENBQUM7WUFDSixDQUFDO1lBRUQsS0FBS3hILE9BQU8sQ0FDVDBKLElBQUksQ0FBQyxDQUFDLENBQ05DLElBQUksQ0FBQ0MsR0FBRyxJQUFJQSxHQUFHLENBQUNDLElBQUksQ0FBQ1gsTUFBTSxFQUFFO2NBQUUsR0FBRzdJLE9BQU87Y0FBRUc7WUFBVyxDQUFDLEVBQUVKLElBQUksQ0FBQyxDQUFDLENBQy9EdUosSUFBSSxDQUFDekUsR0FBRyxJQUFJO2NBQ1gsSUFBSUEsR0FBRyxJQUFJLElBQUksRUFBRTtjQUNqQixJQUFJN0UsT0FBTyxDQUFDOEMsT0FBTyxDQUFDMkcsdUJBQXVCLEVBQUU7Z0JBQzNDLEtBQUtkLE9BQU8sQ0FBQztrQkFDWDNFLFFBQVEsRUFBRSxFQUFFO2tCQUNaQyxXQUFXLEVBQUUsS0FBSztrQkFDbEJ0RTtnQkFDRixDQUFDLENBQUM7Z0JBQ0Y7Y0FDRjtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E7Y0FDQTtjQUNBO2NBQ0EsSUFBSWlKLGFBQWEsRUFBRTtjQUNuQjFJLFVBQVUsQ0FBQztnQkFDVDJFLEdBQUc7Z0JBQ0hFLHFCQUFxQixFQUFFLElBQUk7Z0JBQzNCRSxXQUFXLEVBQUUsS0FBSztnQkFDbEJ5RSxpQkFBaUIsRUFBRSxJQUFJO2dCQUN2QkMsV0FBVyxFQUFFaEssT0FBTyxDQUFDaUssU0FBUyxLQUFLO2NBQ3JDLENBQUMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUNEaEcsS0FBSyxDQUFDaUcsQ0FBQyxJQUFJO2NBQ1Y7Y0FDQTtjQUNBO2NBQ0FqTSxRQUFRLENBQUNpTSxDQUFDLENBQUM7Y0FDWCxJQUFJakIsYUFBYSxFQUFFO2NBQ25CQSxhQUFhLEdBQUcsSUFBSTtjQUNwQjFJLFVBQVUsQ0FBQztnQkFDVDJFLEdBQUcsRUFBRSxJQUFJO2dCQUNURSxxQkFBcUIsRUFBRSxLQUFLO2dCQUM1QitFLGFBQWEsRUFBRTtjQUNqQixDQUFDLENBQUM7Y0FDRixLQUFLbkIsT0FBTyxDQUFDO2dCQUFFM0UsUUFBUSxFQUFFLEVBQUU7Z0JBQUVDLFdBQVcsRUFBRSxLQUFLO2dCQUFFdEU7Y0FBUSxDQUFDLENBQUM7WUFDN0QsQ0FBQyxDQUFDO1VBQ04sQ0FBQyxDQUFDO1FBQ0o7TUFDQSxLQUFLLE9BQU87UUFBRTtVQUNaLE1BQU1vSyxXQUFXLEdBQUdwSyxPQUFPLENBQUNxSyxXQUFXLElBQUlqSyxJQUFJLENBQUMwRixJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRzFGLElBQUk7VUFDckUsTUFBTWtLLFdBQVcsR0FBRy9MLGlCQUFpQixDQUFDO1lBQ3BDcUgsT0FBTyxFQUFFaEgsa0JBQWtCLENBQUM7Y0FDMUJpSCxXQUFXLEVBQUU0RCxrQkFBa0IsQ0FBQ3pKLE9BQU8sRUFBRW9LLFdBQVcsQ0FBQztjQUNyRDlKO1lBQ0YsQ0FBQztVQUNILENBQUMsQ0FBQztVQUVGLElBQUk7WUFDRixNQUFNaUssc0JBQXNCLEdBQUduTSxnQ0FBZ0MsQ0FBQyxDQUFDO1lBQ2pFLE1BQU13TCxHQUFHLEdBQUcsTUFBTTVKLE9BQU8sQ0FBQzBKLElBQUksQ0FBQyxDQUFDO1lBQ2hDLE1BQU1QLE1BQU0sR0FBRyxNQUFNUyxHQUFHLENBQUNDLElBQUksQ0FBQ3pKLElBQUksRUFBRUMsT0FBTyxDQUFDO1lBRTVDLElBQUk4SSxNQUFNLENBQUNsRyxJQUFJLEtBQUssTUFBTSxFQUFFO2NBQzFCLE9BQU87Z0JBQ0xvQixRQUFRLEVBQUUsRUFBRTtnQkFDWkMsV0FBVyxFQUFFLEtBQUs7Z0JBQ2xCdEU7Y0FDRixDQUFDO1lBQ0g7O1lBRUE7WUFDQSxJQUFJbUosTUFBTSxDQUFDbEcsSUFBSSxLQUFLLFNBQVMsRUFBRTtjQUM3QjtjQUNBO2NBQ0EsTUFBTXVILG9CQUFvQixHQUFHLENBQzNCRCxzQkFBc0IsRUFDdEJELFdBQVcsRUFDWCxJQUFJbkIsTUFBTSxDQUFDc0IsV0FBVyxHQUNsQixDQUNFbE0saUJBQWlCLENBQUM7Z0JBQ2hCcUgsT0FBTyxFQUFFLHlCQUF5QnVELE1BQU0sQ0FBQ3NCLFdBQVcseUJBQXlCO2dCQUM3RTtnQkFDQTtnQkFDQTtnQkFDQTtnQkFDQTtnQkFDQTNGLFNBQVMsRUFBRSxJQUFJcEMsSUFBSSxDQUFDQSxJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUNvQyxXQUFXLENBQUM7Y0FDcEQsQ0FBQyxDQUFDLENBQ0gsR0FDRCxFQUFFLENBQUMsQ0FDUjtjQUNELE1BQU0yRixpQ0FBaUMsR0FBRztnQkFDeEMsR0FBR3ZCLE1BQU0sQ0FBQ3dCLGdCQUFnQjtnQkFDMUJDLGNBQWMsRUFBRSxDQUNkLElBQUl6QixNQUFNLENBQUN3QixnQkFBZ0IsQ0FBQ0MsY0FBYyxJQUFJLEVBQUUsQ0FBQyxFQUNqRCxHQUFHSixvQkFBb0I7Y0FFM0IsQ0FBQztjQUNEO2NBQ0E7Y0FDQTtjQUNBO2NBQ0E1TixzQkFBc0IsQ0FBQyxDQUFDO2NBQ3hCLE9BQU87Z0JBQ0x5SCxRQUFRLEVBQUUxSCx3QkFBd0IsQ0FDaEMrTixpQ0FDRixDQUFDO2dCQUNEcEcsV0FBVyxFQUFFLEtBQUs7Z0JBQ2xCdEU7Y0FDRixDQUFDO1lBQ0g7O1lBRUE7WUFDQSxPQUFPO2NBQ0xxRSxRQUFRLEVBQUUsQ0FDUmlHLFdBQVcsRUFDWG5NLHlCQUF5QixDQUN2Qix5QkFBeUJnTCxNQUFNLENBQUNoSCxLQUFLLHlCQUN2QyxDQUFDLENBQ0Y7Y0FDRG1DLFdBQVcsRUFBRSxLQUFLO2NBQ2xCdEUsT0FBTztjQUNQZ0UsVUFBVSxFQUFFbUYsTUFBTSxDQUFDaEg7WUFDckIsQ0FBQztVQUNILENBQUMsQ0FBQyxPQUFPK0gsQ0FBQyxFQUFFO1lBQ1ZqTSxRQUFRLENBQUNpTSxDQUFDLENBQUM7WUFDWCxPQUFPO2NBQ0w3RixRQUFRLEVBQUUsQ0FDUmlHLFdBQVcsRUFDWG5NLHlCQUF5QixDQUN2Qix5QkFBeUJpRyxNQUFNLENBQUM4RixDQUFDLENBQUMseUJBQ3BDLENBQUMsQ0FDRjtjQUNENUYsV0FBVyxFQUFFLEtBQUs7Y0FDbEJ0RTtZQUNGLENBQUM7VUFDSDtRQUNGO01BQ0EsS0FBSyxRQUFRO1FBQUU7VUFDYixJQUFJO1lBQ0Y7WUFDQSxJQUFJQSxPQUFPLENBQUNLLE9BQU8sS0FBSyxNQUFNLEVBQUU7Y0FDOUIsT0FBTyxNQUFNRix5QkFBeUIsQ0FDcENILE9BQU8sRUFDUEksSUFBSSxFQUNKQyxPQUFPLEVBQ1BDLG9CQUFvQixFQUNwQkMsVUFBVSxFQUNWQyxVQUFVLElBQUl6Qix1QkFDaEIsQ0FBQztZQUNIO1lBRUEsT0FBTyxNQUFNOEwsZ0NBQWdDLENBQzNDN0ssT0FBTyxFQUNQSSxJQUFJLEVBQ0pDLE9BQU8sRUFDUEMsb0JBQW9CLEVBQ3BCNEYsa0JBQWtCLEVBQ2xCbEIsSUFDRixDQUFDO1VBQ0gsQ0FBQyxDQUFDLE9BQU9rRixDQUFDLEVBQUU7WUFDVjtZQUNBLElBQUlBLENBQUMsWUFBWTFNLFVBQVUsRUFBRTtjQUMzQixPQUFPO2dCQUNMNkcsUUFBUSxFQUFFLENBQ1I5RixpQkFBaUIsQ0FBQztrQkFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztvQkFDMUJpSCxXQUFXLEVBQUU0RCxrQkFBa0IsQ0FBQ3pKLE9BQU8sRUFBRUksSUFBSSxDQUFDO29CQUM5Q0U7a0JBQ0YsQ0FBQztnQkFDSCxDQUFDLENBQUMsRUFDRmhDLDZCQUE2QixDQUFDO2tCQUFFd00sT0FBTyxFQUFFO2dCQUFNLENBQUMsQ0FBQyxDQUNsRDtnQkFDRHhHLFdBQVcsRUFBRSxLQUFLO2dCQUNsQnRFO2NBQ0YsQ0FBQztZQUNIO1lBQ0EsT0FBTztjQUNMcUUsUUFBUSxFQUFFLENBQ1I5RixpQkFBaUIsQ0FBQztnQkFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztrQkFDMUJpSCxXQUFXLEVBQUU0RCxrQkFBa0IsQ0FBQ3pKLE9BQU8sRUFBRUksSUFBSSxDQUFDO2tCQUM5Q0U7Z0JBQ0YsQ0FBQztjQUNILENBQUMsQ0FBQyxFQUNGL0IsaUJBQWlCLENBQUM7Z0JBQ2hCcUgsT0FBTyxFQUFFLHlCQUF5QnhCLE1BQU0sQ0FBQzhGLENBQUMsQ0FBQztjQUM3QyxDQUFDLENBQUMsQ0FDSDtjQUNENUYsV0FBVyxFQUFFLEtBQUs7Y0FDbEJ0RTtZQUNGLENBQUM7VUFDSDtRQUNGO0lBQ0Y7RUFDRixDQUFDLENBQUMsT0FBT2tLLENBQUMsRUFBRTtJQUNWLElBQUlBLENBQUMsWUFBWXpNLHFCQUFxQixFQUFFO01BQ3RDLE9BQU87UUFDTDRHLFFBQVEsRUFBRSxDQUNSOUYsaUJBQWlCLENBQUM7VUFDaEJxSCxPQUFPLEVBQUVoSCxrQkFBa0IsQ0FBQztZQUMxQmlILFdBQVcsRUFBRXFFLENBQUMsQ0FBQzNHLE9BQU87WUFDdEJqRDtVQUNGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FDSDtRQUNEZ0UsV0FBVyxFQUFFLEtBQUs7UUFDbEJ0RTtNQUNGLENBQUM7SUFDSDtJQUNBLE1BQU1rSyxDQUFDO0VBQ1Q7QUFDRjtBQUVBLFNBQVNULGtCQUFrQkEsQ0FBQ3pKLE9BQU8sRUFBRTdFLFdBQVcsRUFBRWlGLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxNQUFNLENBQUM7RUFDdEUsT0FBTzVCLHNCQUFzQixDQUFDbEQsY0FBYyxDQUFDMEUsT0FBTyxDQUFDLEVBQUVJLElBQUksQ0FBQztBQUM5RDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLE9BQU8sU0FBUzJLLDBCQUEwQkEsQ0FDeENDLFNBQVMsRUFBRSxNQUFNLEVBQ2pCQyxnQkFBZ0IsRUFBRSxNQUFNLEdBQUcsU0FBUyxDQUNyQyxFQUFFLE1BQU0sQ0FBQztFQUNSO0VBQ0EsT0FBTyxDQUNMLElBQUk3TyxtQkFBbUIsSUFBSTRPLFNBQVMsS0FBSzVPLG1CQUFtQixHQUFHLEVBQy9ELElBQUlDLGdCQUFnQixJQUFJMk8sU0FBUyxLQUFLM08sZ0JBQWdCLEdBQUcsRUFDekQsbUNBQW1DLENBQ3BDLENBQUM2TyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ2Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsU0FBU0MsaUNBQWlDQSxDQUN4Q25KLFdBQVcsRUFBRSxNQUFNLEVBQ25CNUIsSUFBYSxDQUFSLEVBQUUsTUFBTSxDQUNkLEVBQUUsTUFBTSxDQUFDO0VBQ1IsT0FBTyxDQUNMLElBQUloRSxtQkFBbUIsSUFBSTRGLFdBQVcsS0FBSzVGLG1CQUFtQixHQUFHLEVBQ2pFLElBQUlDLGdCQUFnQixLQUFLMkYsV0FBVyxLQUFLM0YsZ0JBQWdCLEdBQUcsRUFDNUQrRCxJQUFJLEdBQUcsaUJBQWlCQSxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FDckQsQ0FDRWdMLE1BQU0sQ0FBQ0MsT0FBTyxDQUFDLENBQ2ZILElBQUksQ0FBQyxJQUFJLENBQUM7QUFDZjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBU0ksNEJBQTRCQSxDQUNuQ3RMLE9BQU8sRUFBRTdFLFdBQVcsR0FBR0ssYUFBYSxFQUNwQzRFLElBQWEsQ0FBUixFQUFFLE1BQU0sQ0FDZCxFQUFFLE1BQU0sQ0FBQztFQUNSO0VBQ0E7RUFDQTtFQUNBO0VBQ0EsSUFBSUosT0FBTyxDQUFDK0ksYUFBYSxLQUFLLEtBQUssRUFBRTtJQUNuQyxPQUFPb0MsaUNBQWlDLENBQUNuTCxPQUFPLENBQUNpQixJQUFJLEVBQUViLElBQUksQ0FBQztFQUM5RDtFQUNBO0VBQ0EsSUFDRUosT0FBTyxDQUFDc0ksVUFBVSxLQUFLLFFBQVEsSUFDL0J0SSxPQUFPLENBQUNzSSxVQUFVLEtBQUssUUFBUSxJQUMvQnRJLE9BQU8sQ0FBQ3NJLFVBQVUsS0FBSyxLQUFLLEVBQzVCO0lBQ0EsT0FBT3lDLDBCQUEwQixDQUFDL0ssT0FBTyxDQUFDaUIsSUFBSSxFQUFFakIsT0FBTyxDQUFDdUwsZUFBZSxDQUFDO0VBQzFFO0VBQ0EsT0FBT0osaUNBQWlDLENBQUNuTCxPQUFPLENBQUNpQixJQUFJLEVBQUViLElBQUksQ0FBQztBQUM5RDtBQUVBLE9BQU8sZUFBZW9MLHlCQUF5QkEsQ0FDN0N4SixXQUFXLEVBQUUsTUFBTSxFQUNuQjVCLElBQUksRUFBRSxNQUFNLEVBQ1p1RyxRQUFRLEVBQUV6TCxPQUFPLEVBQUUsRUFDbkJtRixPQUFPLEVBQUUxRSxjQUFjLEVBQ3ZCdUssa0JBQWtCLEVBQUVyTCxpQkFBaUIsRUFBRSxHQUFHLEVBQUUsQ0FDN0MsRUFBRTRGLE9BQU8sQ0FBQ1Ysa0JBQWtCLENBQUMsQ0FBQztFQUM3QixNQUFNQyxPQUFPLEdBQUc1RSxXQUFXLENBQUM0RyxXQUFXLEVBQUUyRSxRQUFRLENBQUM7RUFDbEQsSUFBSSxDQUFDM0csT0FBTyxFQUFFO0lBQ1osTUFBTSxJQUFJdkMscUJBQXFCLENBQUMsb0JBQW9CdUUsV0FBVyxFQUFFLENBQUM7RUFDcEU7RUFDQSxJQUFJaEMsT0FBTyxDQUFDaUQsSUFBSSxLQUFLLFFBQVEsRUFBRTtJQUM3QixNQUFNLElBQUlrQixLQUFLLENBQ2IsY0FBY25FLE9BQU8sQ0FBQ2lELElBQUksNkNBQTZDakIsV0FBVyxxQ0FDcEYsQ0FBQztFQUNIO0VBQ0EsT0FBTzZJLGdDQUFnQyxDQUNyQzdLLE9BQU8sRUFDUEksSUFBSSxFQUNKQyxPQUFPLEVBQ1AsRUFBRSxFQUNGNkYsa0JBQ0YsQ0FBQztBQUNIO0FBRUEsZUFBZTJFLGdDQUFnQ0EsQ0FDN0M3SyxPQUFPLEVBQUU3RSxXQUFXLEdBQUdLLGFBQWEsRUFDcEM0RSxJQUFJLEVBQUUsTUFBTSxFQUNaQyxPQUFPLEVBQUUxRSxjQUFjLEVBQ3ZCMkUsb0JBQW9CLEVBQUV6RixpQkFBaUIsRUFBRSxHQUFHLEVBQUUsRUFDOUNxTCxrQkFBa0IsRUFBRXJMLGlCQUFpQixFQUFFLEdBQUcsRUFBRSxFQUM1Q21LLElBQWEsQ0FBUixFQUFFLE1BQU0sQ0FDZCxFQUFFdkUsT0FBTyxDQUFDVixrQkFBa0IsQ0FBQyxDQUFDO0VBQzdCO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBLElBQ0VuRixPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFDM0IyQyxXQUFXLENBQUNrTyxPQUFPLENBQUNDLEdBQUcsQ0FBQ0MsNEJBQTRCLENBQUMsSUFDckQsQ0FBQ3RMLE9BQU8sQ0FBQ0ssT0FBTyxFQUNoQjtJQUNBLE1BQU1rTCxRQUFRLEdBQUdOLDRCQUE0QixDQUFDdEwsT0FBTyxFQUFFSSxJQUFJLENBQUM7SUFDNUQsTUFBTXlMLEtBQUssRUFBRSxNQUFNLEVBQUUsR0FBRyxDQUN0QixXQUFXN0wsT0FBTyxDQUFDaUIsSUFBSSw2QkFBNkIsQ0FDckQ7SUFDRCxJQUFJakIsT0FBTyxDQUFDOEwsV0FBVyxFQUFFO01BQ3ZCRCxLQUFLLENBQUM5SCxJQUFJLENBQUMsZ0JBQWdCL0QsT0FBTyxDQUFDOEwsV0FBVyxFQUFFLENBQUM7SUFDbkQ7SUFDQSxJQUFJOUwsT0FBTyxDQUFDK0wsU0FBUyxFQUFFO01BQ3JCRixLQUFLLENBQUM5SCxJQUFJLENBQUMsZ0JBQWdCL0QsT0FBTyxDQUFDK0wsU0FBUyxFQUFFLENBQUM7SUFDakQ7SUFDQSxNQUFNQyxpQkFBaUIsR0FBR2hNLE9BQU8sQ0FBQ3FILFlBQVksSUFBSSxFQUFFO0lBQ3BELElBQUkyRSxpQkFBaUIsQ0FBQzlFLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDaEMyRSxLQUFLLENBQUM5SCxJQUFJLENBQ1IsMERBQTBEaUksaUJBQWlCLENBQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsRUFDeEYsQ0FBQztJQUNIO0lBQ0FXLEtBQUssQ0FBQzlILElBQUksQ0FDUixnRUFBZ0UvRCxPQUFPLENBQUNpQixJQUFJLGdKQUM5RSxDQUFDO0lBQ0QsTUFBTWdMLGNBQWMsRUFBRXBSLGlCQUFpQixFQUFFLEdBQUcsQ0FDMUM7TUFBRW9JLElBQUksRUFBRSxNQUFNO01BQUVpSixJQUFJLEVBQUVMLEtBQUssQ0FBQ1gsSUFBSSxDQUFDLElBQUk7SUFBRSxDQUFDLENBQ3pDO0lBQ0QsT0FBTztNQUNMN0csUUFBUSxFQUFFLENBQ1I5RixpQkFBaUIsQ0FBQztRQUFFcUgsT0FBTyxFQUFFZ0csUUFBUTtRQUFFNUc7TUFBSyxDQUFDLENBQUMsRUFDOUN6RyxpQkFBaUIsQ0FBQztRQUFFcUgsT0FBTyxFQUFFcUcsY0FBYztRQUFFM0osTUFBTSxFQUFFO01BQUssQ0FBQyxDQUFDLENBQzdEO01BQ0RnQyxXQUFXLEVBQUUsSUFBSTtNQUNqQlYsS0FBSyxFQUFFNUQsT0FBTyxDQUFDNEQsS0FBSztNQUNwQmpDLE1BQU0sRUFBRTNCLE9BQU8sQ0FBQzJCLE1BQU07TUFDdEIzQjtJQUNGLENBQUM7RUFDSDtFQUVBLE1BQU1tSixNQUFNLEdBQUcsTUFBTW5KLE9BQU8sQ0FBQ21NLG1CQUFtQixDQUFDL0wsSUFBSSxFQUFFQyxPQUFPLENBQUM7O0VBRS9EO0VBQ0E7RUFDQTtFQUNBLE1BQU0rTCx3QkFBd0IsR0FDNUIsQ0FBQ2xOLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxJQUFJQyxvQkFBb0IsQ0FBQ2EsT0FBTyxDQUFDcUksTUFBTSxDQUFDO0VBQzVFLElBQUlySSxPQUFPLENBQUNxTSxLQUFLLElBQUlELHdCQUF3QixFQUFFO0lBQzdDLE1BQU1FLFNBQVMsR0FBR25RLFlBQVksQ0FBQyxDQUFDO0lBQ2hDNkIsa0JBQWtCLENBQ2hCcUMsT0FBTyxDQUFDa00sV0FBVyxFQUNuQkQsU0FBUyxFQUNUdE0sT0FBTyxDQUFDcU0sS0FBSyxFQUNick0sT0FBTyxDQUFDaUIsSUFBSSxFQUNaakIsT0FBTyxDQUFDaUQsSUFBSSxLQUFLLFFBQVEsR0FBR2pELE9BQU8sQ0FBQ3dNLFNBQVMsR0FBR3pMLFNBQ2xELENBQUM7RUFDSDs7RUFFQTtFQUNBO0VBQ0E7RUFDQSxNQUFNMEwsU0FBUyxHQUFHek0sT0FBTyxDQUFDcUksTUFBTSxHQUM1QixHQUFHckksT0FBTyxDQUFDcUksTUFBTSxJQUFJckksT0FBTyxDQUFDaUIsSUFBSSxFQUFFLEdBQ25DakIsT0FBTyxDQUFDaUIsSUFBSTtFQUNoQixNQUFNSyxZQUFZLEdBQUc2SCxNQUFNLENBQ3hCaUMsTUFBTSxDQUFDLENBQUNzQixDQUFDLENBQUMsRUFBRUEsQ0FBQyxJQUFJNVIsY0FBYyxJQUFJNFIsQ0FBQyxDQUFDekosSUFBSSxLQUFLLE1BQU0sQ0FBQyxDQUNyRHFHLEdBQUcsQ0FBQ29ELENBQUMsSUFBSUEsQ0FBQyxDQUFDUixJQUFJLENBQUMsQ0FDaEJoQixJQUFJLENBQUMsTUFBTSxDQUFDO0VBQ2ZoUCxlQUFlLENBQ2I4RCxPQUFPLENBQUNpQixJQUFJLEVBQ1p3TCxTQUFTLEVBQ1RuTCxZQUFZLEVBQ1puRSxlQUFlLENBQUMsQ0FBQyxFQUFFdUQsT0FBTyxJQUFJLElBQ2hDLENBQUM7RUFFRCxNQUFNa0wsUUFBUSxHQUFHTiw0QkFBNEIsQ0FBQ3RMLE9BQU8sRUFBRUksSUFBSSxDQUFDO0VBRTVELE1BQU11TSxzQkFBc0IsR0FBRzdOLG9CQUFvQixDQUNqRGtCLE9BQU8sQ0FBQ3FILFlBQVksSUFBSSxFQUMxQixDQUFDOztFQUVEO0VBQ0EsTUFBTXVGLGtCQUFrQixFQUFFL1IsaUJBQWlCLEVBQUUsR0FDM0NxTCxrQkFBa0IsQ0FBQ2dCLE1BQU0sR0FBRyxDQUFDLElBQUk1RyxvQkFBb0IsQ0FBQzRHLE1BQU0sR0FBRyxDQUFDLEdBQzVELENBQUMsR0FBR2hCLGtCQUFrQixFQUFFLEdBQUc1RixvQkFBb0IsRUFBRSxHQUFHNkksTUFBTSxDQUFDLEdBQzNEQSxNQUFNOztFQUVaO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7RUFDQSxNQUFNaEQsa0JBQWtCLEdBQUcsTUFBTXBJLE9BQU8sQ0FDdENWLHFCQUFxQixDQUNuQjhMLE1BQU0sQ0FDSGlDLE1BQU0sQ0FBQyxDQUFDeUIsS0FBSyxDQUFDLEVBQUVBLEtBQUssSUFBSS9SLGNBQWMsSUFBSStSLEtBQUssQ0FBQzVKLElBQUksS0FBSyxNQUFNLENBQUMsQ0FDakVxRyxHQUFHLENBQUN1RCxLQUFLLElBQUlBLEtBQUssQ0FBQ1gsSUFBSSxDQUFDLENBQ3hCaEIsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUNaN0ssT0FBTyxFQUNQLElBQUksRUFDSixFQUFFO0VBQUU7RUFDSkEsT0FBTyxDQUFDZ0UsUUFBUSxFQUNoQixrQkFBa0IsRUFDbEI7SUFBRXlJLGtCQUFrQixFQUFFO0VBQUssQ0FDN0IsQ0FDRixDQUFDO0VBRUQsTUFBTXpJLFFBQVEsR0FBRyxDQUNmOUYsaUJBQWlCLENBQUM7SUFDaEJxSCxPQUFPLEVBQUVnRyxRQUFRO0lBQ2pCNUc7RUFDRixDQUFDLENBQUMsRUFDRnpHLGlCQUFpQixDQUFDO0lBQ2hCcUgsT0FBTyxFQUFFZ0gsa0JBQWtCO0lBQzNCdEssTUFBTSxFQUFFO0VBQ1YsQ0FBQyxDQUFDLEVBQ0YsR0FBRzZELGtCQUFrQixFQUNyQi9JLHVCQUF1QixDQUFDO0lBQ3RCNkYsSUFBSSxFQUFFLHFCQUFxQjtJQUMzQm9FLFlBQVksRUFBRXNGLHNCQUFzQjtJQUNwQy9JLEtBQUssRUFBRTVELE9BQU8sQ0FBQzREO0VBQ2pCLENBQUMsQ0FBQyxDQUNIO0VBRUQsT0FBTztJQUNMUyxRQUFRO0lBQ1JDLFdBQVcsRUFBRSxJQUFJO0lBQ2pCK0MsWUFBWSxFQUFFc0Ysc0JBQXNCO0lBQ3BDL0ksS0FBSyxFQUFFNUQsT0FBTyxDQUFDNEQsS0FBSztJQUNwQmpDLE1BQU0sRUFBRTNCLE9BQU8sQ0FBQzJCLE1BQU07SUFDdEIzQjtFQUNGLENBQUM7QUFDSCIsImlnbm9yZUxpc3QiOltdfQ==