import { c as _c } from "react/compiler-runtime";
import type { ToolResultBlockParam, ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import * as React from 'react';
import { ConfigurableShortcutHint } from 'src/components/ConfigurableShortcutHint.js';
import { CtrlOToExpand, SubAgentProvider } from 'src/components/CtrlOToExpand.js';
import { Byline } from 'src/components/design-system/Byline.js';
import { KeyboardShortcutHint } from 'src/components/design-system/KeyboardShortcutHint.js';
import type { z } from 'zod/v4';
import { AgentProgressLine } from '../../components/AgentProgressLine.js';
import { FallbackToolUseErrorMessage } from '../../components/FallbackToolUseErrorMessage.js';
import { FallbackToolUseRejectedMessage } from '../../components/FallbackToolUseRejectedMessage.js';
import { Markdown } from '../../components/Markdown.js';
import { Message as MessageComponent } from '../../components/Message.js';
import { MessageResponse } from '../../components/MessageResponse.js';
import { ToolUseLoader } from '../../components/ToolUseLoader.js';
import { Box, Text } from '../../ink.js';
import { getDumpPromptsPath } from '../../services/api/dumpPrompts.js';
import { findToolByName, type Tools } from '../../Tool.js';
import type { Message, ProgressMessage } from '../../types/message.js';
import type { AgentToolProgress } from '../../types/tools.js';
import { count } from '../../utils/array.js';
import { getSearchOrReadFromContent, getSearchReadSummaryText } from '../../utils/collapseReadSearch.js';
import { getDisplayPath } from '../../utils/file.js';
import { formatDuration, formatNumber } from '../../utils/format.js';
import { buildSubagentLookups, createAssistantMessage, EMPTY_LOOKUPS } from '../../utils/messages.js';
import type { ModelAlias } from '../../utils/model/aliases.js';
import { getMainLoopModel, parseUserSpecifiedModel, renderModelName } from '../../utils/model/model.js';
import type { Theme, ThemeName } from '../../utils/theme.js';
import type { outputSchema, Progress, RemoteLaunchedOutput } from './AgentTool.js';
import { inputSchema } from './AgentTool.js';
import { getAgentColor } from './agentColorManager.js';
import { GENERAL_PURPOSE_AGENT } from './built-in/generalPurposeAgent.js';
const MAX_PROGRESS_MESSAGES_TO_SHOW = 3;

/**
 * Guard: checks if progress data has a `message` field (agent_progress or
 * skill_progress).  Other progress types (e.g. bash_progress forwarded from
 * sub-agents) lack this field and must be skipped by UI helpers.
 */
function hasProgressMessage(data: Progress): data is AgentToolProgress {
  if (!('message' in data)) {
    return false;
  }
  const msg = (data as AgentToolProgress).message;
  return msg != null && typeof msg === 'object' && 'type' in msg;
}

/**
 * Check if a progress message is a search/read/REPL operation (tool use or result).
 * Returns { isSearch, isRead, isREPL } if it's a collapsible operation, null otherwise.
 *
 * For tool_result messages, uses the provided `toolUseByID` map to find the
 * corresponding tool_use block instead of relying on `normalizedMessages`.
 */
function getSearchOrReadInfo(progressMessage: ProgressMessage<Progress>, tools: Tools, toolUseByID: Map<string, ToolUseBlockParam>): {
  isSearch: boolean;
  isRead: boolean;
  isREPL: boolean;
} | null {
  if (!hasProgressMessage(progressMessage.data)) {
    return null;
  }
  const message = progressMessage.data.message;

  // Check tool_use (assistant message)
  if (message.type === 'assistant') {
    return getSearchOrReadFromContent(message.message.content[0], tools);
  }

  // Check tool_result (user message) - find corresponding tool use from the map
  if (message.type === 'user') {
    const content = message.message.content[0];
    if (content?.type === 'tool_result') {
      const toolUse = toolUseByID.get(content.tool_use_id);
      if (toolUse) {
        return getSearchOrReadFromContent(toolUse, tools);
      }
    }
  }
  return null;
}
type SummaryMessage = {
  type: 'summary';
  searchCount: number;
  readCount: number;
  replCount: number;
  uuid: string;
  isActive: boolean; // true if still in progress (last message was tool_use, not tool_result)
};
type ProcessedMessage = {
  type: 'original';
  message: ProgressMessage<AgentToolProgress>;
} | SummaryMessage;

/**
 * Process progress messages to group consecutive search/read operations into summaries.
 * For ants only - returns original messages for non-ants.
 * @param isAgentRunning - If true, the last group is always marked as active (in progress)
 */
function processProgressMessages(messages: ProgressMessage<Progress>[], tools: Tools, isAgentRunning: boolean): ProcessedMessage[] {
  // Only process for ants
  if ("external" !== 'ant') {
    return messages.filter((m): m is ProgressMessage<AgentToolProgress> => hasProgressMessage(m.data) && m.data.message.type !== 'user').map(m => ({
      type: 'original',
      message: m
    }));
  }
  const result: ProcessedMessage[] = [];
  let currentGroup: {
    searchCount: number;
    readCount: number;
    replCount: number;
    startUuid: string;
  } | null = null;
  function flushGroup(isActive: boolean): void {
    if (currentGroup && (currentGroup.searchCount > 0 || currentGroup.readCount > 0 || currentGroup.replCount > 0)) {
      result.push({
        type: 'summary',
        searchCount: currentGroup.searchCount,
        readCount: currentGroup.readCount,
        replCount: currentGroup.replCount,
        uuid: `summary-${currentGroup.startUuid}`,
        isActive
      });
    }
    currentGroup = null;
  }
  const agentMessages = messages.filter((m): m is ProgressMessage<AgentToolProgress> => hasProgressMessage(m.data));

  // Build tool_use lookup incrementally as we iterate
  const toolUseByID = new Map<string, ToolUseBlockParam>();
  for (const msg of agentMessages) {
    // Track tool_use blocks as we see them
    if (msg.data.message.type === 'assistant') {
      for (const c of msg.data.message.message.content) {
        if (c.type === 'tool_use') {
          toolUseByID.set(c.id, c as ToolUseBlockParam);
        }
      }
    }
    const info = getSearchOrReadInfo(msg, tools, toolUseByID);
    if (info && (info.isSearch || info.isRead || info.isREPL)) {
      // This is a search/read/REPL operation - add to current group
      if (!currentGroup) {
        currentGroup = {
          searchCount: 0,
          readCount: 0,
          replCount: 0,
          startUuid: msg.uuid
        };
      }
      // Only count tool_result messages (not tool_use) to avoid double counting
      if (msg.data.message.type === 'user') {
        if (info.isSearch) {
          currentGroup.searchCount++;
        } else if (info.isREPL) {
          currentGroup.replCount++;
        } else if (info.isRead) {
          currentGroup.readCount++;
        }
      }
    } else {
      // Non-search/read/REPL message - flush current group (completed) and add this message
      flushGroup(false);
      // Skip user tool_result messages — subagent progress messages lack
      // toolUseResult, so UserToolSuccessMessage returns null and the
      // height=1 Box in renderToolUseProgressMessage shows as a blank line.
      if (msg.data.message.type !== 'user') {
        result.push({
          type: 'original',
          message: msg
        });
      }
    }
  }

  // Flush any remaining group - it's active if the agent is still running
  flushGroup(isAgentRunning);
  return result;
}
const ESTIMATED_LINES_PER_TOOL = 9;
const TERMINAL_BUFFER_LINES = 7;
type Output = z.input<ReturnType<typeof outputSchema>>;
export function AgentPromptDisplay(t0) {
  const $ = _c(3);
  const {
    prompt,
    dim: t1
  } = t0;
  t1 === undefined ? false : t1;
  let t2;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Text color="success" bold={true}>Prompt:</Text>;
    $[0] = t2;
  } else {
    t2 = $[0];
  }
  let t3;
  if ($[1] !== prompt) {
    t3 = <Box flexDirection="column">{t2}<Box paddingLeft={2}><Markdown>{prompt}</Markdown></Box></Box>;
    $[1] = prompt;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  return t3;
}
export function AgentResponseDisplay(t0) {
  const $ = _c(5);
  const {
    content
  } = t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <Text color="success" bold={true}>Response:</Text>;
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  let t2;
  if ($[1] !== content) {
    t2 = content.map(_temp);
    $[1] = content;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] !== t2) {
    t3 = <Box flexDirection="column">{t1}{t2}</Box>;
    $[3] = t2;
    $[4] = t3;
  } else {
    t3 = $[4];
  }
  return t3;
}
function _temp(block, index) {
  return <Box key={index} paddingLeft={2} marginTop={index === 0 ? 0 : 1}><Markdown>{block.text}</Markdown></Box>;
}
type VerboseAgentTranscriptProps = {
  progressMessages: ProgressMessage<Progress>[];
  tools: Tools;
  verbose: boolean;
};
function VerboseAgentTranscript(t0) {
  const $ = _c(15);
  const {
    progressMessages,
    tools,
    verbose
  } = t0;
  let t1;
  if ($[0] !== progressMessages) {
    t1 = buildSubagentLookups(progressMessages.filter(_temp2).map(_temp3));
    $[0] = progressMessages;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const {
    lookups: agentLookups,
    inProgressToolUseIDs
  } = t1;
  let t2;
  if ($[2] !== agentLookups || $[3] !== inProgressToolUseIDs || $[4] !== progressMessages || $[5] !== tools || $[6] !== verbose) {
    const filteredMessages = progressMessages.filter(_temp4);
    let t3;
    if ($[8] !== agentLookups || $[9] !== inProgressToolUseIDs || $[10] !== tools || $[11] !== verbose) {
      t3 = progressMessage => <MessageResponse key={progressMessage.uuid} height={1}><MessageComponent message={progressMessage.data.message} lookups={agentLookups} addMargin={false} tools={tools} commands={[]} verbose={verbose} inProgressToolUseIDs={inProgressToolUseIDs} progressMessagesForMessage={[]} shouldAnimate={false} shouldShowDot={false} isTranscriptMode={false} isStatic={true} /></MessageResponse>;
      $[8] = agentLookups;
      $[9] = inProgressToolUseIDs;
      $[10] = tools;
      $[11] = verbose;
      $[12] = t3;
    } else {
      t3 = $[12];
    }
    t2 = filteredMessages.map(t3);
    $[2] = agentLookups;
    $[3] = inProgressToolUseIDs;
    $[4] = progressMessages;
    $[5] = tools;
    $[6] = verbose;
    $[7] = t2;
  } else {
    t2 = $[7];
  }
  let t3;
  if ($[13] !== t2) {
    t3 = <>{t2}</>;
    $[13] = t2;
    $[14] = t3;
  } else {
    t3 = $[14];
  }
  return t3;
}
function _temp4(pm_1) {
  if (!hasProgressMessage(pm_1.data)) {
    return false;
  }
  const msg = pm_1.data.message;
  if (msg.type === "user" && msg.toolUseResult === undefined) {
    return false;
  }
  return true;
}
function _temp3(pm_0) {
  return pm_0.data;
}
function _temp2(pm) {
  return hasProgressMessage(pm.data);
}
export function renderToolResultMessage(data: Output, progressMessagesForMessage: ProgressMessage<Progress>[], {
  tools,
  verbose,
  theme,
  isTranscriptMode = false
}: {
  tools: Tools;
  verbose: boolean;
  theme: ThemeName;
  isTranscriptMode?: boolean;
}): React.ReactNode {
  // Remote-launched agents (ant-only) use a private output type not in the
  // public schema. Narrow via the internal discriminant.
  const internal = data as Output | RemoteLaunchedOutput;
  if (internal.status === 'remote_launched') {
    return <Box flexDirection="column">
        <MessageResponse height={1}>
          <Text>
            Remote agent launched{' '}
            <Text dimColor>
              · {internal.taskId} · {internal.sessionUrl}
            </Text>
          </Text>
        </MessageResponse>
      </Box>;
  }
  if (data.status === 'async_launched') {
    const {
      prompt
    } = data;
    return <Box flexDirection="column">
        <MessageResponse height={1}>
          <Text>
            Backgrounded agent
            {!isTranscriptMode && <Text dimColor>
                {' ('}
                <Byline>
                  <KeyboardShortcutHint shortcut="↓" action="manage" />
                  {prompt && <ConfigurableShortcutHint action="app:toggleTranscript" context="Global" fallback="ctrl+o" description="expand" />}
                </Byline>
                {')'}
              </Text>}
          </Text>
        </MessageResponse>
        {isTranscriptMode && prompt && <MessageResponse>
            <AgentPromptDisplay prompt={prompt} theme={theme} />
          </MessageResponse>}
      </Box>;
  }
  if (data.status !== 'completed') {
    return null;
  }
  const {
    agentId,
    totalDurationMs,
    totalToolUseCount,
    totalTokens,
    usage,
    content,
    prompt
  } = data;
  const result = [totalToolUseCount === 1 ? '1 tool use' : `${totalToolUseCount} tool uses`, formatNumber(totalTokens) + ' tokens', formatDuration(totalDurationMs)];
  const completionMessage = `Done (${result.join(' · ')})`;
  const finalAssistantMessage = createAssistantMessage({
    content: completionMessage,
    usage: {
      ...usage,
      inference_geo: null,
      iterations: null,
      speed: null
    }
  });
  return <Box flexDirection="column">
      {"external" === 'ant' && <MessageResponse>
          <Text color="warning">
            [ANT-ONLY] API calls: {getDisplayPath(getDumpPromptsPath(agentId))}
          </Text>
        </MessageResponse>}
      {isTranscriptMode && prompt && <MessageResponse>
          <AgentPromptDisplay prompt={prompt} theme={theme} />
        </MessageResponse>}
      {isTranscriptMode ? <SubAgentProvider>
          <VerboseAgentTranscript progressMessages={progressMessagesForMessage} tools={tools} verbose={verbose} />
        </SubAgentProvider> : null}
      {isTranscriptMode && content && content.length > 0 && <MessageResponse>
          <AgentResponseDisplay content={content} theme={theme} />
        </MessageResponse>}
      <MessageResponse height={1}>
        <MessageComponent message={finalAssistantMessage} lookups={EMPTY_LOOKUPS} addMargin={false} tools={tools} commands={[]} verbose={verbose} inProgressToolUseIDs={new Set()} progressMessagesForMessage={[]} shouldAnimate={false} shouldShowDot={false} isTranscriptMode={false} isStatic={true} />
      </MessageResponse>
      {!isTranscriptMode && <Text dimColor>
          {'  '}
          <CtrlOToExpand />
        </Text>}
    </Box>;
}
export function renderToolUseMessage({
  description,
  prompt
}: Partial<{
  description: string;
  prompt: string;
}>): React.ReactNode {
  if (!description || !prompt) {
    return null;
  }
  return description;
}
export function renderToolUseTag(input: Partial<{
  description: string;
  prompt: string;
  subagent_type: string;
  model?: ModelAlias;
}>): React.ReactNode {
  const tags: React.ReactNode[] = [];
  if (input.model) {
    const mainModel = getMainLoopModel();
    const agentModel = parseUserSpecifiedModel(input.model);
    if (agentModel !== mainModel) {
      tags.push(<Box key="model" flexWrap="nowrap" marginLeft={1}>
          <Text dimColor>{renderModelName(agentModel)}</Text>
        </Box>);
    }
  }
  if (tags.length === 0) {
    return null;
  }
  return <>{tags}</>;
}
const INITIALIZING_TEXT = 'Initializing…';
export function renderToolUseProgressMessage(progressMessages: ProgressMessage<Progress>[], {
  tools,
  verbose,
  terminalSize,
  inProgressToolCallCount,
  isTranscriptMode = false
}: {
  tools: Tools;
  verbose: boolean;
  terminalSize?: {
    columns: number;
    rows: number;
  };
  inProgressToolCallCount?: number;
  isTranscriptMode?: boolean;
}): React.ReactNode {
  if (!progressMessages.length) {
    return <MessageResponse height={1}>
        <Text dimColor>{INITIALIZING_TEXT}</Text>
      </MessageResponse>;
  }

  // Checks to see if we should show a super condensed progress message summary.
  // This prevents flickers when the terminal size is too small to render all the dynamic content
  const toolToolRenderLinesEstimate = (inProgressToolCallCount ?? 1) * ESTIMATED_LINES_PER_TOOL + TERMINAL_BUFFER_LINES;
  const shouldUseCondensedMode = !isTranscriptMode && terminalSize && terminalSize.rows && terminalSize.rows < toolToolRenderLinesEstimate;
  const getProgressStats = () => {
    const toolUseCount = count(progressMessages, msg => {
      if (!hasProgressMessage(msg.data)) {
        return false;
      }
      const message = msg.data.message;
      return message.message.content.some(content => content.type === 'tool_use');
    });
    const latestAssistant = progressMessages.findLast((msg): msg is ProgressMessage<AgentToolProgress> => hasProgressMessage(msg.data) && msg.data.message.type === 'assistant');
    let tokens = null;
    if (latestAssistant?.data.message.type === 'assistant') {
      const usage = latestAssistant.data.message.message.usage;
      tokens = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + usage.input_tokens + usage.output_tokens;
    }
    return {
      toolUseCount,
      tokens
    };
  };
  if (shouldUseCondensedMode) {
    const {
      toolUseCount,
      tokens
    } = getProgressStats();
    return <MessageResponse height={1}>
        <Text dimColor>
          In progress… · <Text bold>{toolUseCount}</Text> tool{' '}
          {toolUseCount === 1 ? 'use' : 'uses'}
          {tokens && ` · ${formatNumber(tokens)} tokens`} ·{' '}
          <ConfigurableShortcutHint action="app:toggleTranscript" context="Global" fallback="ctrl+o" description="expand" parens />
        </Text>
      </MessageResponse>;
  }

  // Process messages to group consecutive search/read operations into summaries (ants only)
  // isAgentRunning=true since this is the progress view while the agent is still running
  const processedMessages = processProgressMessages(progressMessages, tools, true);

  // For display, take the last few processed messages
  const displayedMessages = isTranscriptMode ? processedMessages : processedMessages.slice(-MAX_PROGRESS_MESSAGES_TO_SHOW);

  // Count hidden tool uses specifically (not all messages) to match the
  // final "Done (N tool uses)" count. Each tool use generates multiple
  // progress messages (tool_use + tool_result + text), so counting all
  // hidden messages inflates the number shown to the user.
  const hiddenMessages = isTranscriptMode ? [] : processedMessages.slice(0, Math.max(0, processedMessages.length - MAX_PROGRESS_MESSAGES_TO_SHOW));
  const hiddenToolUseCount = count(hiddenMessages, m => {
    if (m.type === 'summary') {
      return m.searchCount + m.readCount + m.replCount > 0;
    }
    const data = m.message.data;
    if (!hasProgressMessage(data)) {
      return false;
    }
    return data.message.message.content.some(content => content.type === 'tool_use');
  });
  const firstData = progressMessages[0]?.data;
  const prompt = firstData && hasProgressMessage(firstData) ? firstData.prompt : undefined;

  // After grouping, displayedMessages can be empty when the only progress so
  // far is an assistant tool_use for a search/read op (grouped but not yet
  // counted, since counts increment on tool_result). Fall back to the
  // initializing text so MessageResponse doesn't render a bare ⎿.
  if (displayedMessages.length === 0 && !(isTranscriptMode && prompt)) {
    return <MessageResponse height={1}>
        <Text dimColor>{INITIALIZING_TEXT}</Text>
      </MessageResponse>;
  }
  const {
    lookups: subagentLookups,
    inProgressToolUseIDs: collapsedInProgressIDs
  } = buildSubagentLookups(progressMessages.filter((pm): pm is ProgressMessage<AgentToolProgress> => hasProgressMessage(pm.data)).map(pm => pm.data));
  return <MessageResponse>
      <Box flexDirection="column">
        <SubAgentProvider>
          {isTranscriptMode && prompt && <Box marginBottom={1}>
              <AgentPromptDisplay prompt={prompt} />
            </Box>}
          {displayedMessages.map(processed => {
          if (processed.type === 'summary') {
            // Render summary for grouped search/read/REPL operations using shared formatting
            const summaryText = getSearchReadSummaryText(processed.searchCount, processed.readCount, processed.isActive, processed.replCount);
            return <Box key={processed.uuid} height={1} overflow="hidden">
                  <Text dimColor>{summaryText}</Text>
                </Box>;
          }
          // Render original message without height=1 wrapper so null
          // content (tool not found, renderToolUseMessage returns null)
          // doesn't leave a blank line. Tool call headers are single-line
          // anyway so truncation isn't needed.
          return <MessageComponent key={processed.message.uuid} message={processed.message.data.message} lookups={subagentLookups} addMargin={false} tools={tools} commands={[]} verbose={verbose} inProgressToolUseIDs={collapsedInProgressIDs} progressMessagesForMessage={[]} shouldAnimate={false} shouldShowDot={false} style="condensed" isTranscriptMode={false} isStatic={true} />;
        })}
        </SubAgentProvider>
        {hiddenToolUseCount > 0 && <Text dimColor>
            +{hiddenToolUseCount} more tool{' '}
            {hiddenToolUseCount === 1 ? 'use' : 'uses'} <CtrlOToExpand />
          </Text>}
      </Box>
    </MessageResponse>;
}
export function renderToolUseRejectedMessage(_input: {
  description: string;
  prompt: string;
  subagent_type: string;
}, {
  progressMessagesForMessage,
  tools,
  verbose,
  isTranscriptMode
}: {
  columns: number;
  messages: Message[];
  style?: 'condensed';
  theme: ThemeName;
  progressMessagesForMessage: ProgressMessage<Progress>[];
  tools: Tools;
  verbose: boolean;
  isTranscriptMode?: boolean;
}): React.ReactNode {
  // Get agentId from progress messages if available (agent was running before rejection)
  const firstData = progressMessagesForMessage[0]?.data;
  const agentId = firstData && hasProgressMessage(firstData) ? firstData.agentId : undefined;
  return <>
      {"external" === 'ant' && agentId && <MessageResponse>
          <Text color="warning">
            [ANT-ONLY] API calls: {getDisplayPath(getDumpPromptsPath(agentId))}
          </Text>
        </MessageResponse>}
      {renderToolUseProgressMessage(progressMessagesForMessage, {
      tools,
      verbose,
      isTranscriptMode
    })}
      <FallbackToolUseRejectedMessage />
    </>;
}
export function renderToolUseErrorMessage(result: ToolResultBlockParam['content'], {
  progressMessagesForMessage,
  tools,
  verbose,
  isTranscriptMode
}: {
  progressMessagesForMessage: ProgressMessage<Progress>[];
  tools: Tools;
  verbose: boolean;
  isTranscriptMode?: boolean;
}): React.ReactNode {
  return <>
      {renderToolUseProgressMessage(progressMessagesForMessage, {
      tools,
      verbose,
      isTranscriptMode
    })}
      <FallbackToolUseErrorMessage result={result} verbose={verbose} />
    </>;
}
function calculateAgentStats(progressMessages: ProgressMessage<Progress>[]): {
  toolUseCount: number;
  tokens: number | null;
} {
  const toolUseCount = count(progressMessages, msg => {
    if (!hasProgressMessage(msg.data)) {
      return false;
    }
    const message = msg.data.message;
    return message.type === 'user' && message.message.content.some(content => content.type === 'tool_result');
  });
  const latestAssistant = progressMessages.findLast((msg): msg is ProgressMessage<AgentToolProgress> => hasProgressMessage(msg.data) && msg.data.message.type === 'assistant');
  let tokens = null;
  if (latestAssistant?.data.message.type === 'assistant') {
    const usage = latestAssistant.data.message.message.usage;
    tokens = (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + usage.input_tokens + usage.output_tokens;
  }
  return {
    toolUseCount,
    tokens
  };
}
export function renderGroupedAgentToolUse(toolUses: Array<{
  param: ToolUseBlockParam;
  isResolved: boolean;
  isError: boolean;
  isInProgress: boolean;
  progressMessages: ProgressMessage<Progress>[];
  result?: {
    param: ToolResultBlockParam;
    output: Output;
  };
}>, options: {
  shouldAnimate: boolean;
  tools: Tools;
}): React.ReactNode | null {
  const {
    shouldAnimate,
    tools
  } = options;

  // Calculate stats for each agent
  const agentStats = toolUses.map(({
    param,
    isResolved,
    isError,
    progressMessages,
    result
  }) => {
    const stats = calculateAgentStats(progressMessages);
    const lastToolInfo = extractLastToolInfo(progressMessages, tools);
    const parsedInput = inputSchema().safeParse(param.input);

    // teammate_spawned is not part of the exported Output type (cast through unknown
    // for dead code elimination), so check via string comparison on the raw value
    const isTeammateSpawn = result?.output?.status as string === 'teammate_spawned';

    // For teammate spawns, show @name with type in parens and description as status
    let agentType: string;
    let description: string | undefined;
    let color: keyof Theme | undefined;
    let descriptionColor: keyof Theme | undefined;
    let taskDescription: string | undefined;
    if (isTeammateSpawn && parsedInput.success && parsedInput.data.name) {
      agentType = `@${parsedInput.data.name}`;
      const subagentType = parsedInput.data.subagent_type;
      description = isCustomSubagentType(subagentType) ? subagentType : undefined;
      taskDescription = parsedInput.data.description;
      // Use the custom agent definition's color on the type, not the name
      descriptionColor = isCustomSubagentType(subagentType) ? getAgentColor(subagentType) as keyof Theme | undefined : undefined;
    } else {
      agentType = parsedInput.success ? userFacingName(parsedInput.data) : 'Agent';
      description = parsedInput.success ? parsedInput.data.description : undefined;
      color = parsedInput.success ? userFacingNameBackgroundColor(parsedInput.data) : undefined;
      taskDescription = undefined;
    }

    // Check if this was launched as a background agent OR backgrounded mid-execution
    const launchedAsAsync = parsedInput.success && 'run_in_background' in parsedInput.data && parsedInput.data.run_in_background === true;
    const outputStatus = (result?.output as {
      status?: string;
    } | undefined)?.status;
    const backgroundedMidExecution = outputStatus === 'async_launched' || outputStatus === 'remote_launched';
    const isAsync = launchedAsAsync || backgroundedMidExecution || isTeammateSpawn;
    const name = parsedInput.success ? parsedInput.data.name : undefined;
    return {
      id: param.id,
      agentType,
      description,
      toolUseCount: stats.toolUseCount,
      tokens: stats.tokens,
      isResolved,
      isError,
      isAsync,
      color,
      descriptionColor,
      lastToolInfo,
      taskDescription,
      name
    };
  });
  const anyUnresolved = toolUses.some(t => !t.isResolved);
  const anyError = toolUses.some(t => t.isError);
  const allComplete = !anyUnresolved;

  // Check if all agents are the same type
  const allSameType = agentStats.length > 0 && agentStats.every(stat => stat.agentType === agentStats[0]?.agentType);
  const commonType = allSameType && agentStats[0]?.agentType !== 'Agent' ? agentStats[0]?.agentType : null;

  // Check if all resolved agents are async (background)
  const allAsync = agentStats.every(stat => stat.isAsync);
  return <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <ToolUseLoader shouldAnimate={shouldAnimate && anyUnresolved} isUnresolved={anyUnresolved} isError={anyError} />
        <Text>
          {allComplete ? allAsync ? <>
                <Text bold>{toolUses.length}</Text> background agents launched{' '}
                <Text dimColor>
                  <KeyboardShortcutHint shortcut="↓" action="manage" parens />
                </Text>
              </> : <>
                <Text bold>{toolUses.length}</Text>{' '}
                {commonType ? `${commonType} agents` : 'agents'} finished
              </> : <>
              Running <Text bold>{toolUses.length}</Text>{' '}
              {commonType ? `${commonType} agents` : 'agents'}…
            </>}{' '}
        </Text>
        {!allAsync && <CtrlOToExpand />}
      </Box>
      {agentStats.map((stat, index) => <AgentProgressLine key={stat.id} agentType={stat.agentType} description={stat.description} descriptionColor={stat.descriptionColor} taskDescription={stat.taskDescription} toolUseCount={stat.toolUseCount} tokens={stat.tokens} color={stat.color} isLast={index === agentStats.length - 1} isResolved={stat.isResolved} isError={stat.isError} isAsync={stat.isAsync} shouldAnimate={shouldAnimate} lastToolInfo={stat.lastToolInfo} hideType={allSameType} name={stat.name} />)}
    </Box>;
}
export function userFacingName(input: Partial<{
  description: string;
  prompt: string;
  subagent_type: string;
  name: string;
  team_name: string;
}> | undefined): string {
  if (input?.subagent_type && input.subagent_type !== GENERAL_PURPOSE_AGENT.agentType) {
    // Display "worker" agents as "Agent" for cleaner UI
    if (input.subagent_type === 'worker') {
      return 'Agent';
    }
    return input.subagent_type;
  }
  return 'Agent';
}
export function userFacingNameBackgroundColor(input: Partial<{
  description: string;
  prompt: string;
  subagent_type: string;
}> | undefined): keyof Theme | undefined {
  if (!input?.subagent_type) {
    return undefined;
  }

  // Get the color for this agent
  return getAgentColor(input.subagent_type) as keyof Theme | undefined;
}
export function extractLastToolInfo(progressMessages: ProgressMessage<Progress>[], tools: Tools): string | null {
  // Build tool_use lookup from all progress messages (needed for reverse iteration)
  const toolUseByID = new Map<string, ToolUseBlockParam>();
  for (const pm of progressMessages) {
    if (!hasProgressMessage(pm.data)) {
      continue;
    }
    if (pm.data.message.type === 'assistant') {
      for (const c of pm.data.message.message.content) {
        if (c.type === 'tool_use') {
          toolUseByID.set(c.id, c as ToolUseBlockParam);
        }
      }
    }
  }

  // Count trailing consecutive search/read operations from the end
  let searchCount = 0;
  let readCount = 0;
  for (let i = progressMessages.length - 1; i >= 0; i--) {
    const msg = progressMessages[i]!;
    if (!hasProgressMessage(msg.data)) {
      continue;
    }
    const info = getSearchOrReadInfo(msg, tools, toolUseByID);
    if (info && (info.isSearch || info.isRead)) {
      // Only count tool_result messages to avoid double counting
      if (msg.data.message.type === 'user') {
        if (info.isSearch) {
          searchCount++;
        } else if (info.isRead) {
          readCount++;
        }
      }
    } else {
      break;
    }
  }
  if (searchCount + readCount >= 2) {
    return getSearchReadSummaryText(searchCount, readCount, true);
  }

  // Find the last tool_result message
  const lastToolResult = progressMessages.findLast((msg): msg is ProgressMessage<AgentToolProgress> => {
    if (!hasProgressMessage(msg.data)) {
      return false;
    }
    const message = msg.data.message;
    return message.type === 'user' && message.message.content.some(c => c.type === 'tool_result');
  });
  if (lastToolResult?.data.message.type === 'user') {
    const toolResultBlock = lastToolResult.data.message.message.content.find(c => c.type === 'tool_result');
    if (toolResultBlock?.type === 'tool_result') {
      // Look up the corresponding tool_use — already indexed above
      const toolUseBlock = toolUseByID.get(toolResultBlock.tool_use_id);
      if (toolUseBlock) {
        const tool = findToolByName(tools, toolUseBlock.name);
        if (!tool) {
          return toolUseBlock.name; // Fallback to raw name
        }
        const input = toolUseBlock.input as Record<string, unknown>;
        const parsedInput = tool.inputSchema.safeParse(input);

        // Get user-facing tool name
        const userFacingToolName = tool.userFacingName(parsedInput.success ? parsedInput.data : undefined);

        // Try to get summary from the tool itself
        if (tool.getToolUseSummary) {
          const summary = tool.getToolUseSummary(parsedInput.success ? parsedInput.data : undefined);
          if (summary) {
            return `${userFacingToolName}: ${summary}`;
          }
        }

        // Default: just show user-facing tool name
        return userFacingToolName;
      }
    }
  }
  return null;
}
function isCustomSubagentType(subagentType: string | undefined): subagentType is string {
  return !!subagentType && subagentType !== GENERAL_PURPOSE_AGENT.agentType && subagentType !== 'worker';
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJUb29sUmVzdWx0QmxvY2tQYXJhbSIsIlRvb2xVc2VCbG9ja1BhcmFtIiwiUmVhY3QiLCJDb25maWd1cmFibGVTaG9ydGN1dEhpbnQiLCJDdHJsT1RvRXhwYW5kIiwiU3ViQWdlbnRQcm92aWRlciIsIkJ5bGluZSIsIktleWJvYXJkU2hvcnRjdXRIaW50IiwieiIsIkFnZW50UHJvZ3Jlc3NMaW5lIiwiRmFsbGJhY2tUb29sVXNlRXJyb3JNZXNzYWdlIiwiRmFsbGJhY2tUb29sVXNlUmVqZWN0ZWRNZXNzYWdlIiwiTWFya2Rvd24iLCJNZXNzYWdlIiwiTWVzc2FnZUNvbXBvbmVudCIsIk1lc3NhZ2VSZXNwb25zZSIsIlRvb2xVc2VMb2FkZXIiLCJCb3giLCJUZXh0IiwiZ2V0RHVtcFByb21wdHNQYXRoIiwiZmluZFRvb2xCeU5hbWUiLCJUb29scyIsIlByb2dyZXNzTWVzc2FnZSIsIkFnZW50VG9vbFByb2dyZXNzIiwiY291bnQiLCJnZXRTZWFyY2hPclJlYWRGcm9tQ29udGVudCIsImdldFNlYXJjaFJlYWRTdW1tYXJ5VGV4dCIsImdldERpc3BsYXlQYXRoIiwiZm9ybWF0RHVyYXRpb24iLCJmb3JtYXROdW1iZXIiLCJidWlsZFN1YmFnZW50TG9va3VwcyIsImNyZWF0ZUFzc2lzdGFudE1lc3NhZ2UiLCJFTVBUWV9MT09LVVBTIiwiTW9kZWxBbGlhcyIsImdldE1haW5Mb29wTW9kZWwiLCJwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbCIsInJlbmRlck1vZGVsTmFtZSIsIlRoZW1lIiwiVGhlbWVOYW1lIiwib3V0cHV0U2NoZW1hIiwiUHJvZ3Jlc3MiLCJSZW1vdGVMYXVuY2hlZE91dHB1dCIsImlucHV0U2NoZW1hIiwiZ2V0QWdlbnRDb2xvciIsIkdFTkVSQUxfUFVSUE9TRV9BR0VOVCIsIk1BWF9QUk9HUkVTU19NRVNTQUdFU19UT19TSE9XIiwiaGFzUHJvZ3Jlc3NNZXNzYWdlIiwiZGF0YSIsIm1zZyIsIm1lc3NhZ2UiLCJnZXRTZWFyY2hPclJlYWRJbmZvIiwicHJvZ3Jlc3NNZXNzYWdlIiwidG9vbHMiLCJ0b29sVXNlQnlJRCIsIk1hcCIsImlzU2VhcmNoIiwiaXNSZWFkIiwiaXNSRVBMIiwidHlwZSIsImNvbnRlbnQiLCJ0b29sVXNlIiwiZ2V0IiwidG9vbF91c2VfaWQiLCJTdW1tYXJ5TWVzc2FnZSIsInNlYXJjaENvdW50IiwicmVhZENvdW50IiwicmVwbENvdW50IiwidXVpZCIsImlzQWN0aXZlIiwiUHJvY2Vzc2VkTWVzc2FnZSIsInByb2Nlc3NQcm9ncmVzc01lc3NhZ2VzIiwibWVzc2FnZXMiLCJpc0FnZW50UnVubmluZyIsImZpbHRlciIsIm0iLCJtYXAiLCJyZXN1bHQiLCJjdXJyZW50R3JvdXAiLCJzdGFydFV1aWQiLCJmbHVzaEdyb3VwIiwicHVzaCIsImFnZW50TWVzc2FnZXMiLCJjIiwic2V0IiwiaWQiLCJpbmZvIiwiRVNUSU1BVEVEX0xJTkVTX1BFUl9UT09MIiwiVEVSTUlOQUxfQlVGRkVSX0xJTkVTIiwiT3V0cHV0IiwiaW5wdXQiLCJSZXR1cm5UeXBlIiwiQWdlbnRQcm9tcHREaXNwbGF5IiwidDAiLCIkIiwiX2MiLCJwcm9tcHQiLCJkaW0iLCJ0MSIsInVuZGVmaW5lZCIsInQyIiwiU3ltYm9sIiwiZm9yIiwidDMiLCJBZ2VudFJlc3BvbnNlRGlzcGxheSIsIl90ZW1wIiwiYmxvY2siLCJpbmRleCIsInRleHQiLCJWZXJib3NlQWdlbnRUcmFuc2NyaXB0UHJvcHMiLCJwcm9ncmVzc01lc3NhZ2VzIiwidmVyYm9zZSIsIlZlcmJvc2VBZ2VudFRyYW5zY3JpcHQiLCJfdGVtcDIiLCJfdGVtcDMiLCJsb29rdXBzIiwiYWdlbnRMb29rdXBzIiwiaW5Qcm9ncmVzc1Rvb2xVc2VJRHMiLCJmaWx0ZXJlZE1lc3NhZ2VzIiwiX3RlbXA0IiwicG1fMSIsInBtIiwidG9vbFVzZVJlc3VsdCIsInBtXzAiLCJyZW5kZXJUb29sUmVzdWx0TWVzc2FnZSIsInByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlIiwidGhlbWUiLCJpc1RyYW5zY3JpcHRNb2RlIiwiUmVhY3ROb2RlIiwiaW50ZXJuYWwiLCJzdGF0dXMiLCJ0YXNrSWQiLCJzZXNzaW9uVXJsIiwiYWdlbnRJZCIsInRvdGFsRHVyYXRpb25NcyIsInRvdGFsVG9vbFVzZUNvdW50IiwidG90YWxUb2tlbnMiLCJ1c2FnZSIsImNvbXBsZXRpb25NZXNzYWdlIiwiam9pbiIsImZpbmFsQXNzaXN0YW50TWVzc2FnZSIsImluZmVyZW5jZV9nZW8iLCJpdGVyYXRpb25zIiwic3BlZWQiLCJsZW5ndGgiLCJTZXQiLCJyZW5kZXJUb29sVXNlTWVzc2FnZSIsImRlc2NyaXB0aW9uIiwiUGFydGlhbCIsInJlbmRlclRvb2xVc2VUYWciLCJzdWJhZ2VudF90eXBlIiwibW9kZWwiLCJ0YWdzIiwibWFpbk1vZGVsIiwiYWdlbnRNb2RlbCIsIklOSVRJQUxJWklOR19URVhUIiwicmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZSIsInRlcm1pbmFsU2l6ZSIsImluUHJvZ3Jlc3NUb29sQ2FsbENvdW50IiwiY29sdW1ucyIsInJvd3MiLCJ0b29sVG9vbFJlbmRlckxpbmVzRXN0aW1hdGUiLCJzaG91bGRVc2VDb25kZW5zZWRNb2RlIiwiZ2V0UHJvZ3Jlc3NTdGF0cyIsInRvb2xVc2VDb3VudCIsInNvbWUiLCJsYXRlc3RBc3Npc3RhbnQiLCJmaW5kTGFzdCIsInRva2VucyIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIiwiaW5wdXRfdG9rZW5zIiwib3V0cHV0X3Rva2VucyIsInByb2Nlc3NlZE1lc3NhZ2VzIiwiZGlzcGxheWVkTWVzc2FnZXMiLCJzbGljZSIsImhpZGRlbk1lc3NhZ2VzIiwiTWF0aCIsIm1heCIsImhpZGRlblRvb2xVc2VDb3VudCIsImZpcnN0RGF0YSIsInN1YmFnZW50TG9va3VwcyIsImNvbGxhcHNlZEluUHJvZ3Jlc3NJRHMiLCJwcm9jZXNzZWQiLCJzdW1tYXJ5VGV4dCIsInJlbmRlclRvb2xVc2VSZWplY3RlZE1lc3NhZ2UiLCJfaW5wdXQiLCJzdHlsZSIsInJlbmRlclRvb2xVc2VFcnJvck1lc3NhZ2UiLCJjYWxjdWxhdGVBZ2VudFN0YXRzIiwicmVuZGVyR3JvdXBlZEFnZW50VG9vbFVzZSIsInRvb2xVc2VzIiwiQXJyYXkiLCJwYXJhbSIsImlzUmVzb2x2ZWQiLCJpc0Vycm9yIiwiaXNJblByb2dyZXNzIiwib3V0cHV0Iiwib3B0aW9ucyIsInNob3VsZEFuaW1hdGUiLCJhZ2VudFN0YXRzIiwic3RhdHMiLCJsYXN0VG9vbEluZm8iLCJleHRyYWN0TGFzdFRvb2xJbmZvIiwicGFyc2VkSW5wdXQiLCJzYWZlUGFyc2UiLCJpc1RlYW1tYXRlU3Bhd24iLCJhZ2VudFR5cGUiLCJjb2xvciIsImRlc2NyaXB0aW9uQ29sb3IiLCJ0YXNrRGVzY3JpcHRpb24iLCJzdWNjZXNzIiwibmFtZSIsInN1YmFnZW50VHlwZSIsImlzQ3VzdG9tU3ViYWdlbnRUeXBlIiwidXNlckZhY2luZ05hbWUiLCJ1c2VyRmFjaW5nTmFtZUJhY2tncm91bmRDb2xvciIsImxhdW5jaGVkQXNBc3luYyIsInJ1bl9pbl9iYWNrZ3JvdW5kIiwib3V0cHV0U3RhdHVzIiwiYmFja2dyb3VuZGVkTWlkRXhlY3V0aW9uIiwiaXNBc3luYyIsImFueVVucmVzb2x2ZWQiLCJ0IiwiYW55RXJyb3IiLCJhbGxDb21wbGV0ZSIsImFsbFNhbWVUeXBlIiwiZXZlcnkiLCJzdGF0IiwiY29tbW9uVHlwZSIsImFsbEFzeW5jIiwidGVhbV9uYW1lIiwiaSIsImxhc3RUb29sUmVzdWx0IiwidG9vbFJlc3VsdEJsb2NrIiwiZmluZCIsInRvb2xVc2VCbG9jayIsInRvb2wiLCJSZWNvcmQiLCJ1c2VyRmFjaW5nVG9vbE5hbWUiLCJnZXRUb29sVXNlU3VtbWFyeSIsInN1bW1hcnkiXSwic291cmNlcyI6WyJVSS50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUge1xuICBUb29sUmVzdWx0QmxvY2tQYXJhbSxcbiAgVG9vbFVzZUJsb2NrUGFyYW0sXG59IGZyb20gJ0BhbnRocm9waWMtYWkvc2RrL3Jlc291cmNlcy9pbmRleC5tanMnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IENvbmZpZ3VyYWJsZVNob3J0Y3V0SGludCB9IGZyb20gJ3NyYy9jb21wb25lbnRzL0NvbmZpZ3VyYWJsZVNob3J0Y3V0SGludC5qcydcbmltcG9ydCB7XG4gIEN0cmxPVG9FeHBhbmQsXG4gIFN1YkFnZW50UHJvdmlkZXIsXG59IGZyb20gJ3NyYy9jb21wb25lbnRzL0N0cmxPVG9FeHBhbmQuanMnXG5pbXBvcnQgeyBCeWxpbmUgfSBmcm9tICdzcmMvY29tcG9uZW50cy9kZXNpZ24tc3lzdGVtL0J5bGluZS5qcydcbmltcG9ydCB7IEtleWJvYXJkU2hvcnRjdXRIaW50IH0gZnJvbSAnc3JjL2NvbXBvbmVudHMvZGVzaWduLXN5c3RlbS9LZXlib2FyZFNob3J0Y3V0SGludC5qcydcbmltcG9ydCB0eXBlIHsgeiB9IGZyb20gJ3pvZC92NCdcbmltcG9ydCB7IEFnZW50UHJvZ3Jlc3NMaW5lIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9BZ2VudFByb2dyZXNzTGluZS5qcydcbmltcG9ydCB7IEZhbGxiYWNrVG9vbFVzZUVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvRmFsbGJhY2tUb29sVXNlRXJyb3JNZXNzYWdlLmpzJ1xuaW1wb3J0IHsgRmFsbGJhY2tUb29sVXNlUmVqZWN0ZWRNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tcG9uZW50cy9GYWxsYmFja1Rvb2xVc2VSZWplY3RlZE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBNYXJrZG93biB9IGZyb20gJy4uLy4uL2NvbXBvbmVudHMvTWFya2Rvd24uanMnXG5pbXBvcnQgeyBNZXNzYWdlIGFzIE1lc3NhZ2VDb21wb25lbnQgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL01lc3NhZ2UuanMnXG5pbXBvcnQgeyBNZXNzYWdlUmVzcG9uc2UgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7IFRvb2xVc2VMb2FkZXIgfSBmcm9tICcuLi8uLi9jb21wb25lbnRzL1Rvb2xVc2VMb2FkZXIuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi9pbmsuanMnXG5pbXBvcnQgeyBnZXREdW1wUHJvbXB0c1BhdGggfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hcGkvZHVtcFByb21wdHMuanMnXG5pbXBvcnQgeyBmaW5kVG9vbEJ5TmFtZSwgdHlwZSBUb29scyB9IGZyb20gJy4uLy4uL1Rvb2wuanMnXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2UsIFByb2dyZXNzTWVzc2FnZSB9IGZyb20gJy4uLy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgdHlwZSB7IEFnZW50VG9vbFByb2dyZXNzIH0gZnJvbSAnLi4vLi4vdHlwZXMvdG9vbHMuanMnXG5pbXBvcnQgeyBjb3VudCB9IGZyb20gJy4uLy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHtcbiAgZ2V0U2VhcmNoT3JSZWFkRnJvbUNvbnRlbnQsXG4gIGdldFNlYXJjaFJlYWRTdW1tYXJ5VGV4dCxcbn0gZnJvbSAnLi4vLi4vdXRpbHMvY29sbGFwc2VSZWFkU2VhcmNoLmpzJ1xuaW1wb3J0IHsgZ2V0RGlzcGxheVBhdGggfSBmcm9tICcuLi8uLi91dGlscy9maWxlLmpzJ1xuaW1wb3J0IHsgZm9ybWF0RHVyYXRpb24sIGZvcm1hdE51bWJlciB9IGZyb20gJy4uLy4uL3V0aWxzL2Zvcm1hdC5qcydcbmltcG9ydCB7XG4gIGJ1aWxkU3ViYWdlbnRMb29rdXBzLFxuICBjcmVhdGVBc3Npc3RhbnRNZXNzYWdlLFxuICBFTVBUWV9MT09LVVBTLFxufSBmcm9tICcuLi8uLi91dGlscy9tZXNzYWdlcy5qcydcbmltcG9ydCB0eXBlIHsgTW9kZWxBbGlhcyB9IGZyb20gJy4uLy4uL3V0aWxzL21vZGVsL2FsaWFzZXMuanMnXG5pbXBvcnQge1xuICBnZXRNYWluTG9vcE1vZGVsLFxuICBwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbCxcbiAgcmVuZGVyTW9kZWxOYW1lLFxufSBmcm9tICcuLi8uLi91dGlscy9tb2RlbC9tb2RlbC5qcydcbmltcG9ydCB0eXBlIHsgVGhlbWUsIFRoZW1lTmFtZSB9IGZyb20gJy4uLy4uL3V0aWxzL3RoZW1lLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBvdXRwdXRTY2hlbWEsXG4gIFByb2dyZXNzLFxuICBSZW1vdGVMYXVuY2hlZE91dHB1dCxcbn0gZnJvbSAnLi9BZ2VudFRvb2wuanMnXG5pbXBvcnQgeyBpbnB1dFNjaGVtYSB9IGZyb20gJy4vQWdlbnRUb29sLmpzJ1xuaW1wb3J0IHsgZ2V0QWdlbnRDb2xvciB9IGZyb20gJy4vYWdlbnRDb2xvck1hbmFnZXIuanMnXG5pbXBvcnQgeyBHRU5FUkFMX1BVUlBPU0VfQUdFTlQgfSBmcm9tICcuL2J1aWx0LWluL2dlbmVyYWxQdXJwb3NlQWdlbnQuanMnXG5cbmNvbnN0IE1BWF9QUk9HUkVTU19NRVNTQUdFU19UT19TSE9XID0gM1xuXG4vKipcbiAqIEd1YXJkOiBjaGVja3MgaWYgcHJvZ3Jlc3MgZGF0YSBoYXMgYSBgbWVzc2FnZWAgZmllbGQgKGFnZW50X3Byb2dyZXNzIG9yXG4gKiBza2lsbF9wcm9ncmVzcykuICBPdGhlciBwcm9ncmVzcyB0eXBlcyAoZS5nLiBiYXNoX3Byb2dyZXNzIGZvcndhcmRlZCBmcm9tXG4gKiBzdWItYWdlbnRzKSBsYWNrIHRoaXMgZmllbGQgYW5kIG11c3QgYmUgc2tpcHBlZCBieSBVSSBoZWxwZXJzLlxuICovXG5mdW5jdGlvbiBoYXNQcm9ncmVzc01lc3NhZ2UoZGF0YTogUHJvZ3Jlc3MpOiBkYXRhIGlzIEFnZW50VG9vbFByb2dyZXNzIHtcbiAgaWYgKCEoJ21lc3NhZ2UnIGluIGRhdGEpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgY29uc3QgbXNnID0gKGRhdGEgYXMgQWdlbnRUb29sUHJvZ3Jlc3MpLm1lc3NhZ2VcbiAgcmV0dXJuIG1zZyAhPSBudWxsICYmIHR5cGVvZiBtc2cgPT09ICdvYmplY3QnICYmICd0eXBlJyBpbiBtc2dcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIHByb2dyZXNzIG1lc3NhZ2UgaXMgYSBzZWFyY2gvcmVhZC9SRVBMIG9wZXJhdGlvbiAodG9vbCB1c2Ugb3IgcmVzdWx0KS5cbiAqIFJldHVybnMgeyBpc1NlYXJjaCwgaXNSZWFkLCBpc1JFUEwgfSBpZiBpdCdzIGEgY29sbGFwc2libGUgb3BlcmF0aW9uLCBudWxsIG90aGVyd2lzZS5cbiAqXG4gKiBGb3IgdG9vbF9yZXN1bHQgbWVzc2FnZXMsIHVzZXMgdGhlIHByb3ZpZGVkIGB0b29sVXNlQnlJRGAgbWFwIHRvIGZpbmQgdGhlXG4gKiBjb3JyZXNwb25kaW5nIHRvb2xfdXNlIGJsb2NrIGluc3RlYWQgb2YgcmVseWluZyBvbiBgbm9ybWFsaXplZE1lc3NhZ2VzYC5cbiAqL1xuZnVuY3Rpb24gZ2V0U2VhcmNoT3JSZWFkSW5mbyhcbiAgcHJvZ3Jlc3NNZXNzYWdlOiBQcm9ncmVzc01lc3NhZ2U8UHJvZ3Jlc3M+LFxuICB0b29sczogVG9vbHMsXG4gIHRvb2xVc2VCeUlEOiBNYXA8c3RyaW5nLCBUb29sVXNlQmxvY2tQYXJhbT4sXG4pOiB7IGlzU2VhcmNoOiBib29sZWFuOyBpc1JlYWQ6IGJvb2xlYW47IGlzUkVQTDogYm9vbGVhbiB9IHwgbnVsbCB7XG4gIGlmICghaGFzUHJvZ3Jlc3NNZXNzYWdlKHByb2dyZXNzTWVzc2FnZS5kYXRhKSkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgY29uc3QgbWVzc2FnZSA9IHByb2dyZXNzTWVzc2FnZS5kYXRhLm1lc3NhZ2VcblxuICAvLyBDaGVjayB0b29sX3VzZSAoYXNzaXN0YW50IG1lc3NhZ2UpXG4gIGlmIChtZXNzYWdlLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgcmV0dXJuIGdldFNlYXJjaE9yUmVhZEZyb21Db250ZW50KG1lc3NhZ2UubWVzc2FnZS5jb250ZW50WzBdLCB0b29scylcbiAgfVxuXG4gIC8vIENoZWNrIHRvb2xfcmVzdWx0ICh1c2VyIG1lc3NhZ2UpIC0gZmluZCBjb3JyZXNwb25kaW5nIHRvb2wgdXNlIGZyb20gdGhlIG1hcFxuICBpZiAobWVzc2FnZS50eXBlID09PSAndXNlcicpIHtcbiAgICBjb25zdCBjb250ZW50ID0gbWVzc2FnZS5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICBpZiAoY29udGVudD8udHlwZSA9PT0gJ3Rvb2xfcmVzdWx0Jykge1xuICAgICAgY29uc3QgdG9vbFVzZSA9IHRvb2xVc2VCeUlELmdldChjb250ZW50LnRvb2xfdXNlX2lkKVxuICAgICAgaWYgKHRvb2xVc2UpIHtcbiAgICAgICAgcmV0dXJuIGdldFNlYXJjaE9yUmVhZEZyb21Db250ZW50KHRvb2xVc2UsIHRvb2xzKVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBudWxsXG59XG5cbnR5cGUgU3VtbWFyeU1lc3NhZ2UgPSB7XG4gIHR5cGU6ICdzdW1tYXJ5J1xuICBzZWFyY2hDb3VudDogbnVtYmVyXG4gIHJlYWRDb3VudDogbnVtYmVyXG4gIHJlcGxDb3VudDogbnVtYmVyXG4gIHV1aWQ6IHN0cmluZ1xuICBpc0FjdGl2ZTogYm9vbGVhbiAvLyB0cnVlIGlmIHN0aWxsIGluIHByb2dyZXNzIChsYXN0IG1lc3NhZ2Ugd2FzIHRvb2xfdXNlLCBub3QgdG9vbF9yZXN1bHQpXG59XG5cbnR5cGUgUHJvY2Vzc2VkTWVzc2FnZSA9XG4gIHwgeyB0eXBlOiAnb3JpZ2luYWwnOyBtZXNzYWdlOiBQcm9ncmVzc01lc3NhZ2U8QWdlbnRUb29sUHJvZ3Jlc3M+IH1cbiAgfCBTdW1tYXJ5TWVzc2FnZVxuXG4vKipcbiAqIFByb2Nlc3MgcHJvZ3Jlc3MgbWVzc2FnZXMgdG8gZ3JvdXAgY29uc2VjdXRpdmUgc2VhcmNoL3JlYWQgb3BlcmF0aW9ucyBpbnRvIHN1bW1hcmllcy5cbiAqIEZvciBhbnRzIG9ubHkgLSByZXR1cm5zIG9yaWdpbmFsIG1lc3NhZ2VzIGZvciBub24tYW50cy5cbiAqIEBwYXJhbSBpc0FnZW50UnVubmluZyAtIElmIHRydWUsIHRoZSBsYXN0IGdyb3VwIGlzIGFsd2F5cyBtYXJrZWQgYXMgYWN0aXZlIChpbiBwcm9ncmVzcylcbiAqL1xuZnVuY3Rpb24gcHJvY2Vzc1Byb2dyZXNzTWVzc2FnZXMoXG4gIG1lc3NhZ2VzOiBQcm9ncmVzc01lc3NhZ2U8UHJvZ3Jlc3M+W10sXG4gIHRvb2xzOiBUb29scyxcbiAgaXNBZ2VudFJ1bm5pbmc6IGJvb2xlYW4sXG4pOiBQcm9jZXNzZWRNZXNzYWdlW10ge1xuICAvLyBPbmx5IHByb2Nlc3MgZm9yIGFudHNcbiAgaWYgKFwiZXh0ZXJuYWxcIiAhPT0gJ2FudCcpIHtcbiAgICByZXR1cm4gbWVzc2FnZXNcbiAgICAgIC5maWx0ZXIoXG4gICAgICAgIChtKTogbSBpcyBQcm9ncmVzc01lc3NhZ2U8QWdlbnRUb29sUHJvZ3Jlc3M+ID0+XG4gICAgICAgICAgaGFzUHJvZ3Jlc3NNZXNzYWdlKG0uZGF0YSkgJiYgbS5kYXRhLm1lc3NhZ2UudHlwZSAhPT0gJ3VzZXInLFxuICAgICAgKVxuICAgICAgLm1hcChtID0+ICh7IHR5cGU6ICdvcmlnaW5hbCcsIG1lc3NhZ2U6IG0gfSkpXG4gIH1cblxuICBjb25zdCByZXN1bHQ6IFByb2Nlc3NlZE1lc3NhZ2VbXSA9IFtdXG4gIGxldCBjdXJyZW50R3JvdXA6IHtcbiAgICBzZWFyY2hDb3VudDogbnVtYmVyXG4gICAgcmVhZENvdW50OiBudW1iZXJcbiAgICByZXBsQ291bnQ6IG51bWJlclxuICAgIHN0YXJ0VXVpZDogc3RyaW5nXG4gIH0gfCBudWxsID0gbnVsbFxuXG4gIGZ1bmN0aW9uIGZsdXNoR3JvdXAoaXNBY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgICBpZiAoXG4gICAgICBjdXJyZW50R3JvdXAgJiZcbiAgICAgIChjdXJyZW50R3JvdXAuc2VhcmNoQ291bnQgPiAwIHx8XG4gICAgICAgIGN1cnJlbnRHcm91cC5yZWFkQ291bnQgPiAwIHx8XG4gICAgICAgIGN1cnJlbnRHcm91cC5yZXBsQ291bnQgPiAwKVxuICAgICkge1xuICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICB0eXBlOiAnc3VtbWFyeScsXG4gICAgICAgIHNlYXJjaENvdW50OiBjdXJyZW50R3JvdXAuc2VhcmNoQ291bnQsXG4gICAgICAgIHJlYWRDb3VudDogY3VycmVudEdyb3VwLnJlYWRDb3VudCxcbiAgICAgICAgcmVwbENvdW50OiBjdXJyZW50R3JvdXAucmVwbENvdW50LFxuICAgICAgICB1dWlkOiBgc3VtbWFyeS0ke2N1cnJlbnRHcm91cC5zdGFydFV1aWR9YCxcbiAgICAgICAgaXNBY3RpdmUsXG4gICAgICB9KVxuICAgIH1cbiAgICBjdXJyZW50R3JvdXAgPSBudWxsXG4gIH1cblxuICBjb25zdCBhZ2VudE1lc3NhZ2VzID0gbWVzc2FnZXMuZmlsdGVyKFxuICAgIChtKTogbSBpcyBQcm9ncmVzc01lc3NhZ2U8QWdlbnRUb29sUHJvZ3Jlc3M+ID0+IGhhc1Byb2dyZXNzTWVzc2FnZShtLmRhdGEpLFxuICApXG5cbiAgLy8gQnVpbGQgdG9vbF91c2UgbG9va3VwIGluY3JlbWVudGFsbHkgYXMgd2UgaXRlcmF0ZVxuICBjb25zdCB0b29sVXNlQnlJRCA9IG5ldyBNYXA8c3RyaW5nLCBUb29sVXNlQmxvY2tQYXJhbT4oKVxuICBmb3IgKGNvbnN0IG1zZyBvZiBhZ2VudE1lc3NhZ2VzKSB7XG4gICAgLy8gVHJhY2sgdG9vbF91c2UgYmxvY2tzIGFzIHdlIHNlZSB0aGVtXG4gICAgaWYgKG1zZy5kYXRhLm1lc3NhZ2UudHlwZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgIGZvciAoY29uc3QgYyBvZiBtc2cuZGF0YS5tZXNzYWdlLm1lc3NhZ2UuY29udGVudCkge1xuICAgICAgICBpZiAoYy50eXBlID09PSAndG9vbF91c2UnKSB7XG4gICAgICAgICAgdG9vbFVzZUJ5SUQuc2V0KGMuaWQsIGMgYXMgVG9vbFVzZUJsb2NrUGFyYW0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgaW5mbyA9IGdldFNlYXJjaE9yUmVhZEluZm8obXNnLCB0b29scywgdG9vbFVzZUJ5SUQpXG5cbiAgICBpZiAoaW5mbyAmJiAoaW5mby5pc1NlYXJjaCB8fCBpbmZvLmlzUmVhZCB8fCBpbmZvLmlzUkVQTCkpIHtcbiAgICAgIC8vIFRoaXMgaXMgYSBzZWFyY2gvcmVhZC9SRVBMIG9wZXJhdGlvbiAtIGFkZCB0byBjdXJyZW50IGdyb3VwXG4gICAgICBpZiAoIWN1cnJlbnRHcm91cCkge1xuICAgICAgICBjdXJyZW50R3JvdXAgPSB7XG4gICAgICAgICAgc2VhcmNoQ291bnQ6IDAsXG4gICAgICAgICAgcmVhZENvdW50OiAwLFxuICAgICAgICAgIHJlcGxDb3VudDogMCxcbiAgICAgICAgICBzdGFydFV1aWQ6IG1zZy51dWlkLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBPbmx5IGNvdW50IHRvb2xfcmVzdWx0IG1lc3NhZ2VzIChub3QgdG9vbF91c2UpIHRvIGF2b2lkIGRvdWJsZSBjb3VudGluZ1xuICAgICAgaWYgKG1zZy5kYXRhLm1lc3NhZ2UudHlwZSA9PT0gJ3VzZXInKSB7XG4gICAgICAgIGlmIChpbmZvLmlzU2VhcmNoKSB7XG4gICAgICAgICAgY3VycmVudEdyb3VwLnNlYXJjaENvdW50KytcbiAgICAgICAgfSBlbHNlIGlmIChpbmZvLmlzUkVQTCkge1xuICAgICAgICAgIGN1cnJlbnRHcm91cC5yZXBsQ291bnQrK1xuICAgICAgICB9IGVsc2UgaWYgKGluZm8uaXNSZWFkKSB7XG4gICAgICAgICAgY3VycmVudEdyb3VwLnJlYWRDb3VudCsrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLXNlYXJjaC9yZWFkL1JFUEwgbWVzc2FnZSAtIGZsdXNoIGN1cnJlbnQgZ3JvdXAgKGNvbXBsZXRlZCkgYW5kIGFkZCB0aGlzIG1lc3NhZ2VcbiAgICAgIGZsdXNoR3JvdXAoZmFsc2UpXG4gICAgICAvLyBTa2lwIHVzZXIgdG9vbF9yZXN1bHQgbWVzc2FnZXMg4oCUIHN1YmFnZW50IHByb2dyZXNzIG1lc3NhZ2VzIGxhY2tcbiAgICAgIC8vIHRvb2xVc2VSZXN1bHQsIHNvIFVzZXJUb29sU3VjY2Vzc01lc3NhZ2UgcmV0dXJucyBudWxsIGFuZCB0aGVcbiAgICAgIC8vIGhlaWdodD0xIEJveCBpbiByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlIHNob3dzIGFzIGEgYmxhbmsgbGluZS5cbiAgICAgIGlmIChtc2cuZGF0YS5tZXNzYWdlLnR5cGUgIT09ICd1c2VyJykge1xuICAgICAgICByZXN1bHQucHVzaCh7IHR5cGU6ICdvcmlnaW5hbCcsIG1lc3NhZ2U6IG1zZyB9KVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8vIEZsdXNoIGFueSByZW1haW5pbmcgZ3JvdXAgLSBpdCdzIGFjdGl2ZSBpZiB0aGUgYWdlbnQgaXMgc3RpbGwgcnVubmluZ1xuICBmbHVzaEdyb3VwKGlzQWdlbnRSdW5uaW5nKVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuY29uc3QgRVNUSU1BVEVEX0xJTkVTX1BFUl9UT09MID0gOVxuY29uc3QgVEVSTUlOQUxfQlVGRkVSX0xJTkVTID0gN1xuXG50eXBlIE91dHB1dCA9IHouaW5wdXQ8UmV0dXJuVHlwZTx0eXBlb2Ygb3V0cHV0U2NoZW1hPj5cblxuZXhwb3J0IGZ1bmN0aW9uIEFnZW50UHJvbXB0RGlzcGxheSh7XG4gIHByb21wdCxcbiAgZGltOiBfZGltID0gZmFsc2UsXG59OiB7XG4gIHByb21wdDogc3RyaW5nXG4gIHRoZW1lPzogVGhlbWVOYW1lIC8vIGRlcHJlY2F0ZWQsIGtlcHQgZm9yIGNvbXBhdGliaWxpdHkgLSBNYXJrZG93biB1c2VzIHVzZVRoZW1lIGludGVybmFsbHlcbiAgZGltPzogYm9vbGVhbiAvLyBkZXByZWNhdGVkLCBrZXB0IGZvciBjb21wYXRpYmlsaXR5IC0gZGltQ29sb3IgY2Fubm90IGJlIGFwcGxpZWQgdG8gQm94IChNYXJrZG93biByZXR1cm5zIEJveClcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgPFRleHQgY29sb3I9XCJzdWNjZXNzXCIgYm9sZD5cbiAgICAgICAgUHJvbXB0OlxuICAgICAgPC9UZXh0PlxuICAgICAgPEJveCBwYWRkaW5nTGVmdD17Mn0+XG4gICAgICAgIDxNYXJrZG93bj57cHJvbXB0fTwvTWFya2Rvd24+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQWdlbnRSZXNwb25zZURpc3BsYXkoe1xuICBjb250ZW50LFxufToge1xuICBjb250ZW50OiB7IHR5cGU6IHN0cmluZzsgdGV4dDogc3RyaW5nIH1bXVxuICB0aGVtZT86IFRoZW1lTmFtZSAvLyBkZXByZWNhdGVkLCBrZXB0IGZvciBjb21wYXRpYmlsaXR5IC0gTWFya2Rvd24gdXNlcyB1c2VUaGVtZSBpbnRlcm5hbGx5XG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxUZXh0IGNvbG9yPVwic3VjY2Vzc1wiIGJvbGQ+XG4gICAgICAgIFJlc3BvbnNlOlxuICAgICAgPC9UZXh0PlxuICAgICAge2NvbnRlbnQubWFwKChibG9jazogeyB0eXBlOiBzdHJpbmc7IHRleHQ6IHN0cmluZyB9LCBpbmRleDogbnVtYmVyKSA9PiAoXG4gICAgICAgIDxCb3gga2V5PXtpbmRleH0gcGFkZGluZ0xlZnQ9ezJ9IG1hcmdpblRvcD17aW5kZXggPT09IDAgPyAwIDogMX0+XG4gICAgICAgICAgPE1hcmtkb3duPntibG9jay50ZXh0fTwvTWFya2Rvd24+XG4gICAgICAgIDwvQm94PlxuICAgICAgKSl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxudHlwZSBWZXJib3NlQWdlbnRUcmFuc2NyaXB0UHJvcHMgPSB7XG4gIHByb2dyZXNzTWVzc2FnZXM6IFByb2dyZXNzTWVzc2FnZTxQcm9ncmVzcz5bXVxuICB0b29sczogVG9vbHNcbiAgdmVyYm9zZTogYm9vbGVhblxufVxuXG5mdW5jdGlvbiBWZXJib3NlQWdlbnRUcmFuc2NyaXB0KHtcbiAgcHJvZ3Jlc3NNZXNzYWdlcyxcbiAgdG9vbHMsXG4gIHZlcmJvc2UsXG59OiBWZXJib3NlQWdlbnRUcmFuc2NyaXB0UHJvcHMpOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCB7IGxvb2t1cHM6IGFnZW50TG9va3VwcywgaW5Qcm9ncmVzc1Rvb2xVc2VJRHMgfSA9IGJ1aWxkU3ViYWdlbnRMb29rdXBzKFxuICAgIHByb2dyZXNzTWVzc2FnZXNcbiAgICAgIC5maWx0ZXIoKHBtKTogcG0gaXMgUHJvZ3Jlc3NNZXNzYWdlPEFnZW50VG9vbFByb2dyZXNzPiA9PlxuICAgICAgICBoYXNQcm9ncmVzc01lc3NhZ2UocG0uZGF0YSksXG4gICAgICApXG4gICAgICAubWFwKHBtID0+IHBtLmRhdGEpLFxuICApXG5cbiAgLy8gRmlsdGVyIG91dCB1c2VyIHRvb2xfcmVzdWx0IG1lc3NhZ2VzIHRoYXQgbGFjayB0b29sVXNlUmVzdWx0LlxuICAvLyBTdWJhZ2VudCBwcm9ncmVzcyBtZXNzYWdlcyBkb24ndCBjYXJyeSB0aGUgcGFyc2VkIHRvb2wgb3V0cHV0LFxuICAvLyBzbyBVc2VyVG9vbFN1Y2Nlc3NNZXNzYWdlIHJldHVybnMgbnVsbCBhbmQgTWVzc2FnZVJlc3BvbnNlIHJlbmRlcnNcbiAgLy8gYSBiYXJlIOKOvyB3aXRoIG5vIGNvbnRlbnQuXG4gIGNvbnN0IGZpbHRlcmVkTWVzc2FnZXMgPSBwcm9ncmVzc01lc3NhZ2VzLmZpbHRlcihcbiAgICAocG0pOiBwbSBpcyBQcm9ncmVzc01lc3NhZ2U8QWdlbnRUb29sUHJvZ3Jlc3M+ID0+IHtcbiAgICAgIGlmICghaGFzUHJvZ3Jlc3NNZXNzYWdlKHBtLmRhdGEpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgY29uc3QgbXNnID0gcG0uZGF0YS5tZXNzYWdlXG4gICAgICBpZiAobXNnLnR5cGUgPT09ICd1c2VyJyAmJiBtc2cudG9vbFVzZVJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9LFxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAge2ZpbHRlcmVkTWVzc2FnZXMubWFwKHByb2dyZXNzTWVzc2FnZSA9PiAoXG4gICAgICAgIDxNZXNzYWdlUmVzcG9uc2Uga2V5PXtwcm9ncmVzc01lc3NhZ2UudXVpZH0gaGVpZ2h0PXsxfT5cbiAgICAgICAgICA8TWVzc2FnZUNvbXBvbmVudFxuICAgICAgICAgICAgbWVzc2FnZT17cHJvZ3Jlc3NNZXNzYWdlLmRhdGEubWVzc2FnZX1cbiAgICAgICAgICAgIGxvb2t1cHM9e2FnZW50TG9va3Vwc31cbiAgICAgICAgICAgIGFkZE1hcmdpbj17ZmFsc2V9XG4gICAgICAgICAgICB0b29scz17dG9vbHN9XG4gICAgICAgICAgICBjb21tYW5kcz17W119XG4gICAgICAgICAgICB2ZXJib3NlPXt2ZXJib3NlfVxuICAgICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM9e2luUHJvZ3Jlc3NUb29sVXNlSURzfVxuICAgICAgICAgICAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2U9e1tdfVxuICAgICAgICAgICAgc2hvdWxkQW5pbWF0ZT17ZmFsc2V9XG4gICAgICAgICAgICBzaG91bGRTaG93RG90PXtmYWxzZX1cbiAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2ZhbHNlfVxuICAgICAgICAgICAgaXNTdGF0aWM9e3RydWV9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICApKX1cbiAgICA8Lz5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UoXG4gIGRhdGE6IE91dHB1dCxcbiAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2U6IFByb2dyZXNzTWVzc2FnZTxQcm9ncmVzcz5bXSxcbiAge1xuICAgIHRvb2xzLFxuICAgIHZlcmJvc2UsXG4gICAgdGhlbWUsXG4gICAgaXNUcmFuc2NyaXB0TW9kZSA9IGZhbHNlLFxuICB9OiB7XG4gICAgdG9vbHM6IFRvb2xzXG4gICAgdmVyYm9zZTogYm9vbGVhblxuICAgIHRoZW1lOiBUaGVtZU5hbWVcbiAgICBpc1RyYW5zY3JpcHRNb2RlPzogYm9vbGVhblxuICB9LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gUmVtb3RlLWxhdW5jaGVkIGFnZW50cyAoYW50LW9ubHkpIHVzZSBhIHByaXZhdGUgb3V0cHV0IHR5cGUgbm90IGluIHRoZVxuICAvLyBwdWJsaWMgc2NoZW1hLiBOYXJyb3cgdmlhIHRoZSBpbnRlcm5hbCBkaXNjcmltaW5hbnQuXG4gIGNvbnN0IGludGVybmFsID0gZGF0YSBhcyBPdXRwdXQgfCBSZW1vdGVMYXVuY2hlZE91dHB1dFxuICBpZiAoaW50ZXJuYWwuc3RhdHVzID09PSAncmVtb3RlX2xhdW5jaGVkJykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZSBoZWlnaHQ9ezF9PlxuICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgUmVtb3RlIGFnZW50IGxhdW5jaGVkeycgJ31cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICDCtyB7aW50ZXJuYWwudGFza0lkfSDCtyB7aW50ZXJuYWwuc2Vzc2lvblVybH1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG4gIGlmIChkYXRhLnN0YXR1cyA9PT0gJ2FzeW5jX2xhdW5jaGVkJykge1xuICAgIGNvbnN0IHsgcHJvbXB0IH0gPSBkYXRhXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8TWVzc2FnZVJlc3BvbnNlIGhlaWdodD17MX0+XG4gICAgICAgICAgPFRleHQ+XG4gICAgICAgICAgICBCYWNrZ3JvdW5kZWQgYWdlbnRcbiAgICAgICAgICAgIHshaXNUcmFuc2NyaXB0TW9kZSAmJiAoXG4gICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAgICAgIHsnICgnfVxuICAgICAgICAgICAgICAgIDxCeWxpbmU+XG4gICAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCLihpNcIiBhY3Rpb249XCJtYW5hZ2VcIiAvPlxuICAgICAgICAgICAgICAgICAge3Byb21wdCAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgICAgICAgICAgICBhY3Rpb249XCJhcHA6dG9nZ2xlVHJhbnNjcmlwdFwiXG4gICAgICAgICAgICAgICAgICAgICAgY29udGV4dD1cIkdsb2JhbFwiXG4gICAgICAgICAgICAgICAgICAgICAgZmFsbGJhY2s9XCJjdHJsK29cIlxuICAgICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uPVwiZXhwYW5kXCJcbiAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgPC9CeWxpbmU+XG4gICAgICAgICAgICAgICAgeycpJ31cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICB7aXNUcmFuc2NyaXB0TW9kZSAmJiBwcm9tcHQgJiYgKFxuICAgICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgICA8QWdlbnRQcm9tcHREaXNwbGF5IHByb21wdD17cHJvbXB0fSB0aGVtZT17dGhlbWV9IC8+XG4gICAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICl9XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICBpZiAoZGF0YS5zdGF0dXMgIT09ICdjb21wbGV0ZWQnKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICBhZ2VudElkLFxuICAgIHRvdGFsRHVyYXRpb25NcyxcbiAgICB0b3RhbFRvb2xVc2VDb3VudCxcbiAgICB0b3RhbFRva2VucyxcbiAgICB1c2FnZSxcbiAgICBjb250ZW50LFxuICAgIHByb21wdCxcbiAgfSA9IGRhdGFcbiAgY29uc3QgcmVzdWx0ID0gW1xuICAgIHRvdGFsVG9vbFVzZUNvdW50ID09PSAxID8gJzEgdG9vbCB1c2UnIDogYCR7dG90YWxUb29sVXNlQ291bnR9IHRvb2wgdXNlc2AsXG4gICAgZm9ybWF0TnVtYmVyKHRvdGFsVG9rZW5zKSArICcgdG9rZW5zJyxcbiAgICBmb3JtYXREdXJhdGlvbih0b3RhbER1cmF0aW9uTXMpLFxuICBdXG5cbiAgY29uc3QgY29tcGxldGlvbk1lc3NhZ2UgPSBgRG9uZSAoJHtyZXN1bHQuam9pbignIMK3ICcpfSlgXG5cbiAgY29uc3QgZmluYWxBc3Npc3RhbnRNZXNzYWdlID0gY3JlYXRlQXNzaXN0YW50TWVzc2FnZSh7XG4gICAgY29udGVudDogY29tcGxldGlvbk1lc3NhZ2UsXG4gICAgdXNhZ2U6IHsgLi4udXNhZ2UsIGluZmVyZW5jZV9nZW86IG51bGwsIGl0ZXJhdGlvbnM6IG51bGwsIHNwZWVkOiBudWxsIH0sXG4gIH0pXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIHtcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIChcbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgIFtBTlQtT05MWV0gQVBJIGNhbGxzOiB7Z2V0RGlzcGxheVBhdGgoZ2V0RHVtcFByb21wdHNQYXRoKGFnZW50SWQpKX1cbiAgICAgICAgICA8L1RleHQ+XG4gICAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgICAgKX1cbiAgICAgIHtpc1RyYW5zY3JpcHRNb2RlICYmIHByb21wdCAmJiAoXG4gICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgPEFnZW50UHJvbXB0RGlzcGxheSBwcm9tcHQ9e3Byb21wdH0gdGhlbWU9e3RoZW1lfSAvPlxuICAgICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgICl9XG4gICAgICB7aXNUcmFuc2NyaXB0TW9kZSA/IChcbiAgICAgICAgPFN1YkFnZW50UHJvdmlkZXI+XG4gICAgICAgICAgPFZlcmJvc2VBZ2VudFRyYW5zY3JpcHRcbiAgICAgICAgICAgIHByb2dyZXNzTWVzc2FnZXM9e3Byb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlfVxuICAgICAgICAgICAgdG9vbHM9e3Rvb2xzfVxuICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAvPlxuICAgICAgICA8L1N1YkFnZW50UHJvdmlkZXI+XG4gICAgICApIDogbnVsbH1cbiAgICAgIHtpc1RyYW5zY3JpcHRNb2RlICYmIGNvbnRlbnQgJiYgY29udGVudC5sZW5ndGggPiAwICYmIChcbiAgICAgICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgICAgICA8QWdlbnRSZXNwb25zZURpc3BsYXkgY29udGVudD17Y29udGVudH0gdGhlbWU9e3RoZW1lfSAvPlxuICAgICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgICl9XG4gICAgICA8TWVzc2FnZVJlc3BvbnNlIGhlaWdodD17MX0+XG4gICAgICAgIDxNZXNzYWdlQ29tcG9uZW50XG4gICAgICAgICAgbWVzc2FnZT17ZmluYWxBc3Npc3RhbnRNZXNzYWdlfVxuICAgICAgICAgIGxvb2t1cHM9e0VNUFRZX0xPT0tVUFN9XG4gICAgICAgICAgYWRkTWFyZ2luPXtmYWxzZX1cbiAgICAgICAgICB0b29scz17dG9vbHN9XG4gICAgICAgICAgY29tbWFuZHM9e1tdfVxuICAgICAgICAgIHZlcmJvc2U9e3ZlcmJvc2V9XG4gICAgICAgICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM9e25ldyBTZXQoKX1cbiAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17W119XG4gICAgICAgICAgc2hvdWxkQW5pbWF0ZT17ZmFsc2V9XG4gICAgICAgICAgc2hvdWxkU2hvd0RvdD17ZmFsc2V9XG4gICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17ZmFsc2V9XG4gICAgICAgICAgaXNTdGF0aWM9e3RydWV9XG4gICAgICAgIC8+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgIHshaXNUcmFuc2NyaXB0TW9kZSAmJiAoXG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgIHsnICAnfVxuICAgICAgICAgIDxDdHJsT1RvRXhwYW5kIC8+XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlclRvb2xVc2VNZXNzYWdlKHtcbiAgZGVzY3JpcHRpb24sXG4gIHByb21wdCxcbn06IFBhcnRpYWw8e1xuICBkZXNjcmlwdGlvbjogc3RyaW5nXG4gIHByb21wdDogc3RyaW5nXG59Pik6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGlmICghZGVzY3JpcHRpb24gfHwgIXByb21wdCkge1xuICAgIHJldHVybiBudWxsXG4gIH1cbiAgcmV0dXJuIGRlc2NyaXB0aW9uXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlVGFnKFxuICBpbnB1dDogUGFydGlhbDx7XG4gICAgZGVzY3JpcHRpb246IHN0cmluZ1xuICAgIHByb21wdDogc3RyaW5nXG4gICAgc3ViYWdlbnRfdHlwZTogc3RyaW5nXG4gICAgbW9kZWw/OiBNb2RlbEFsaWFzXG4gIH0+LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgdGFnczogUmVhY3QuUmVhY3ROb2RlW10gPSBbXVxuXG4gIGlmIChpbnB1dC5tb2RlbCkge1xuICAgIGNvbnN0IG1haW5Nb2RlbCA9IGdldE1haW5Mb29wTW9kZWwoKVxuICAgIGNvbnN0IGFnZW50TW9kZWwgPSBwYXJzZVVzZXJTcGVjaWZpZWRNb2RlbChpbnB1dC5tb2RlbClcbiAgICBpZiAoYWdlbnRNb2RlbCAhPT0gbWFpbk1vZGVsKSB7XG4gICAgICB0YWdzLnB1c2goXG4gICAgICAgIDxCb3gga2V5PVwibW9kZWxcIiBmbGV4V3JhcD1cIm5vd3JhcFwiIG1hcmdpbkxlZnQ9ezF9PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntyZW5kZXJNb2RlbE5hbWUoYWdlbnRNb2RlbCl9PC9UZXh0PlxuICAgICAgICA8L0JveD4sXG4gICAgICApXG4gICAgfVxuICB9XG5cbiAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIHJldHVybiA8Pnt0YWdzfTwvPlxufVxuXG5jb25zdCBJTklUSUFMSVpJTkdfVEVYVCA9ICdJbml0aWFsaXppbmfigKYnXG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlUHJvZ3Jlc3NNZXNzYWdlKFxuICBwcm9ncmVzc01lc3NhZ2VzOiBQcm9ncmVzc01lc3NhZ2U8UHJvZ3Jlc3M+W10sXG4gIHtcbiAgICB0b29scyxcbiAgICB2ZXJib3NlLFxuICAgIHRlcm1pbmFsU2l6ZSxcbiAgICBpblByb2dyZXNzVG9vbENhbGxDb3VudCxcbiAgICBpc1RyYW5zY3JpcHRNb2RlID0gZmFsc2UsXG4gIH06IHtcbiAgICB0b29sczogVG9vbHNcbiAgICB2ZXJib3NlOiBib29sZWFuXG4gICAgdGVybWluYWxTaXplPzogeyBjb2x1bW5zOiBudW1iZXI7IHJvd3M6IG51bWJlciB9XG4gICAgaW5Qcm9ncmVzc1Rvb2xDYWxsQ291bnQ/OiBudW1iZXJcbiAgICBpc1RyYW5zY3JpcHRNb2RlPzogYm9vbGVhblxuICB9LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgaWYgKCFwcm9ncmVzc01lc3NhZ2VzLmxlbmd0aCkge1xuICAgIHJldHVybiAoXG4gICAgICA8TWVzc2FnZVJlc3BvbnNlIGhlaWdodD17MX0+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPntJTklUSUFMSVpJTkdfVEVYVH08L1RleHQ+XG4gICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICApXG4gIH1cblxuICAvLyBDaGVja3MgdG8gc2VlIGlmIHdlIHNob3VsZCBzaG93IGEgc3VwZXIgY29uZGVuc2VkIHByb2dyZXNzIG1lc3NhZ2Ugc3VtbWFyeS5cbiAgLy8gVGhpcyBwcmV2ZW50cyBmbGlja2VycyB3aGVuIHRoZSB0ZXJtaW5hbCBzaXplIGlzIHRvbyBzbWFsbCB0byByZW5kZXIgYWxsIHRoZSBkeW5hbWljIGNvbnRlbnRcbiAgY29uc3QgdG9vbFRvb2xSZW5kZXJMaW5lc0VzdGltYXRlID1cbiAgICAoaW5Qcm9ncmVzc1Rvb2xDYWxsQ291bnQgPz8gMSkgKiBFU1RJTUFURURfTElORVNfUEVSX1RPT0wgK1xuICAgIFRFUk1JTkFMX0JVRkZFUl9MSU5FU1xuICBjb25zdCBzaG91bGRVc2VDb25kZW5zZWRNb2RlID1cbiAgICAhaXNUcmFuc2NyaXB0TW9kZSAmJlxuICAgIHRlcm1pbmFsU2l6ZSAmJlxuICAgIHRlcm1pbmFsU2l6ZS5yb3dzICYmXG4gICAgdGVybWluYWxTaXplLnJvd3MgPCB0b29sVG9vbFJlbmRlckxpbmVzRXN0aW1hdGVcblxuICBjb25zdCBnZXRQcm9ncmVzc1N0YXRzID0gKCkgPT4ge1xuICAgIGNvbnN0IHRvb2xVc2VDb3VudCA9IGNvdW50KHByb2dyZXNzTWVzc2FnZXMsIG1zZyA9PiB7XG4gICAgICBpZiAoIWhhc1Byb2dyZXNzTWVzc2FnZShtc2cuZGF0YSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgICBjb25zdCBtZXNzYWdlID0gbXNnLmRhdGEubWVzc2FnZVxuICAgICAgcmV0dXJuIG1lc3NhZ2UubWVzc2FnZS5jb250ZW50LnNvbWUoXG4gICAgICAgIGNvbnRlbnQgPT4gY29udGVudC50eXBlID09PSAndG9vbF91c2UnLFxuICAgICAgKVxuICAgIH0pXG5cbiAgICBjb25zdCBsYXRlc3RBc3Npc3RhbnQgPSBwcm9ncmVzc01lc3NhZ2VzLmZpbmRMYXN0KFxuICAgICAgKG1zZyk6IG1zZyBpcyBQcm9ncmVzc01lc3NhZ2U8QWdlbnRUb29sUHJvZ3Jlc3M+ID0+XG4gICAgICAgIGhhc1Byb2dyZXNzTWVzc2FnZShtc2cuZGF0YSkgJiYgbXNnLmRhdGEubWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50JyxcbiAgICApXG5cbiAgICBsZXQgdG9rZW5zID0gbnVsbFxuICAgIGlmIChsYXRlc3RBc3Npc3RhbnQ/LmRhdGEubWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgY29uc3QgdXNhZ2UgPSBsYXRlc3RBc3Npc3RhbnQuZGF0YS5tZXNzYWdlLm1lc3NhZ2UudXNhZ2VcbiAgICAgIHRva2VucyA9XG4gICAgICAgICh1c2FnZS5jYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMgPz8gMCkgK1xuICAgICAgICAodXNhZ2UuY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMgPz8gMCkgK1xuICAgICAgICB1c2FnZS5pbnB1dF90b2tlbnMgK1xuICAgICAgICB1c2FnZS5vdXRwdXRfdG9rZW5zXG4gICAgfVxuXG4gICAgcmV0dXJuIHsgdG9vbFVzZUNvdW50LCB0b2tlbnMgfVxuICB9XG5cbiAgaWYgKHNob3VsZFVzZUNvbmRlbnNlZE1vZGUpIHtcbiAgICBjb25zdCB7IHRvb2xVc2VDb3VudCwgdG9rZW5zIH0gPSBnZXRQcm9ncmVzc1N0YXRzKClcblxuICAgIHJldHVybiAoXG4gICAgICA8TWVzc2FnZVJlc3BvbnNlIGhlaWdodD17MX0+XG4gICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgIEluIHByb2dyZXNz4oCmIMK3IDxUZXh0IGJvbGQ+e3Rvb2xVc2VDb3VudH08L1RleHQ+IHRvb2x7JyAnfVxuICAgICAgICAgIHt0b29sVXNlQ291bnQgPT09IDEgPyAndXNlJyA6ICd1c2VzJ31cbiAgICAgICAgICB7dG9rZW5zICYmIGAgwrcgJHtmb3JtYXROdW1iZXIodG9rZW5zKX0gdG9rZW5zYH0gwrd7JyAnfVxuICAgICAgICAgIDxDb25maWd1cmFibGVTaG9ydGN1dEhpbnRcbiAgICAgICAgICAgIGFjdGlvbj1cImFwcDp0b2dnbGVUcmFuc2NyaXB0XCJcbiAgICAgICAgICAgIGNvbnRleHQ9XCJHbG9iYWxcIlxuICAgICAgICAgICAgZmFsbGJhY2s9XCJjdHJsK29cIlxuICAgICAgICAgICAgZGVzY3JpcHRpb249XCJleHBhbmRcIlxuICAgICAgICAgICAgcGFyZW5zXG4gICAgICAgICAgLz5cbiAgICAgICAgPC9UZXh0PlxuICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgKVxuICB9XG5cbiAgLy8gUHJvY2VzcyBtZXNzYWdlcyB0byBncm91cCBjb25zZWN1dGl2ZSBzZWFyY2gvcmVhZCBvcGVyYXRpb25zIGludG8gc3VtbWFyaWVzIChhbnRzIG9ubHkpXG4gIC8vIGlzQWdlbnRSdW5uaW5nPXRydWUgc2luY2UgdGhpcyBpcyB0aGUgcHJvZ3Jlc3MgdmlldyB3aGlsZSB0aGUgYWdlbnQgaXMgc3RpbGwgcnVubmluZ1xuICBjb25zdCBwcm9jZXNzZWRNZXNzYWdlcyA9IHByb2Nlc3NQcm9ncmVzc01lc3NhZ2VzKFxuICAgIHByb2dyZXNzTWVzc2FnZXMsXG4gICAgdG9vbHMsXG4gICAgdHJ1ZSxcbiAgKVxuXG4gIC8vIEZvciBkaXNwbGF5LCB0YWtlIHRoZSBsYXN0IGZldyBwcm9jZXNzZWQgbWVzc2FnZXNcbiAgY29uc3QgZGlzcGxheWVkTWVzc2FnZXMgPSBpc1RyYW5zY3JpcHRNb2RlXG4gICAgPyBwcm9jZXNzZWRNZXNzYWdlc1xuICAgIDogcHJvY2Vzc2VkTWVzc2FnZXMuc2xpY2UoLU1BWF9QUk9HUkVTU19NRVNTQUdFU19UT19TSE9XKVxuXG4gIC8vIENvdW50IGhpZGRlbiB0b29sIHVzZXMgc3BlY2lmaWNhbGx5IChub3QgYWxsIG1lc3NhZ2VzKSB0byBtYXRjaCB0aGVcbiAgLy8gZmluYWwgXCJEb25lIChOIHRvb2wgdXNlcylcIiBjb3VudC4gRWFjaCB0b29sIHVzZSBnZW5lcmF0ZXMgbXVsdGlwbGVcbiAgLy8gcHJvZ3Jlc3MgbWVzc2FnZXMgKHRvb2xfdXNlICsgdG9vbF9yZXN1bHQgKyB0ZXh0KSwgc28gY291bnRpbmcgYWxsXG4gIC8vIGhpZGRlbiBtZXNzYWdlcyBpbmZsYXRlcyB0aGUgbnVtYmVyIHNob3duIHRvIHRoZSB1c2VyLlxuICBjb25zdCBoaWRkZW5NZXNzYWdlcyA9IGlzVHJhbnNjcmlwdE1vZGVcbiAgICA/IFtdXG4gICAgOiBwcm9jZXNzZWRNZXNzYWdlcy5zbGljZShcbiAgICAgICAgMCxcbiAgICAgICAgTWF0aC5tYXgoMCwgcHJvY2Vzc2VkTWVzc2FnZXMubGVuZ3RoIC0gTUFYX1BST0dSRVNTX01FU1NBR0VTX1RPX1NIT1cpLFxuICAgICAgKVxuICBjb25zdCBoaWRkZW5Ub29sVXNlQ291bnQgPSBjb3VudChoaWRkZW5NZXNzYWdlcywgbSA9PiB7XG4gICAgaWYgKG0udHlwZSA9PT0gJ3N1bW1hcnknKSB7XG4gICAgICByZXR1cm4gbS5zZWFyY2hDb3VudCArIG0ucmVhZENvdW50ICsgbS5yZXBsQ291bnQgPiAwXG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBtLm1lc3NhZ2UuZGF0YVxuICAgIGlmICghaGFzUHJvZ3Jlc3NNZXNzYWdlKGRhdGEpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgcmV0dXJuIGRhdGEubWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQuc29tZShcbiAgICAgIGNvbnRlbnQgPT4gY29udGVudC50eXBlID09PSAndG9vbF91c2UnLFxuICAgIClcbiAgfSlcblxuICBjb25zdCBmaXJzdERhdGEgPSBwcm9ncmVzc01lc3NhZ2VzWzBdPy5kYXRhXG4gIGNvbnN0IHByb21wdCA9XG4gICAgZmlyc3REYXRhICYmIGhhc1Byb2dyZXNzTWVzc2FnZShmaXJzdERhdGEpID8gZmlyc3REYXRhLnByb21wdCA6IHVuZGVmaW5lZFxuXG4gIC8vIEFmdGVyIGdyb3VwaW5nLCBkaXNwbGF5ZWRNZXNzYWdlcyBjYW4gYmUgZW1wdHkgd2hlbiB0aGUgb25seSBwcm9ncmVzcyBzb1xuICAvLyBmYXIgaXMgYW4gYXNzaXN0YW50IHRvb2xfdXNlIGZvciBhIHNlYXJjaC9yZWFkIG9wIChncm91cGVkIGJ1dCBub3QgeWV0XG4gIC8vIGNvdW50ZWQsIHNpbmNlIGNvdW50cyBpbmNyZW1lbnQgb24gdG9vbF9yZXN1bHQpLiBGYWxsIGJhY2sgdG8gdGhlXG4gIC8vIGluaXRpYWxpemluZyB0ZXh0IHNvIE1lc3NhZ2VSZXNwb25zZSBkb2Vzbid0IHJlbmRlciBhIGJhcmUg4o6/LlxuICBpZiAoZGlzcGxheWVkTWVzc2FnZXMubGVuZ3RoID09PSAwICYmICEoaXNUcmFuc2NyaXB0TW9kZSAmJiBwcm9tcHQpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxNZXNzYWdlUmVzcG9uc2UgaGVpZ2h0PXsxfT5cbiAgICAgICAgPFRleHQgZGltQ29sb3I+e0lOSVRJQUxJWklOR19URVhUfTwvVGV4dD5cbiAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IHtcbiAgICBsb29rdXBzOiBzdWJhZ2VudExvb2t1cHMsXG4gICAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IGNvbGxhcHNlZEluUHJvZ3Jlc3NJRHMsXG4gIH0gPSBidWlsZFN1YmFnZW50TG9va3VwcyhcbiAgICBwcm9ncmVzc01lc3NhZ2VzXG4gICAgICAuZmlsdGVyKChwbSk6IHBtIGlzIFByb2dyZXNzTWVzc2FnZTxBZ2VudFRvb2xQcm9ncmVzcz4gPT5cbiAgICAgICAgaGFzUHJvZ3Jlc3NNZXNzYWdlKHBtLmRhdGEpLFxuICAgICAgKVxuICAgICAgLm1hcChwbSA9PiBwbS5kYXRhKSxcbiAgKVxuXG4gIHJldHVybiAoXG4gICAgPE1lc3NhZ2VSZXNwb25zZT5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICA8U3ViQWdlbnRQcm92aWRlcj5cbiAgICAgICAgICB7aXNUcmFuc2NyaXB0TW9kZSAmJiBwcm9tcHQgJiYgKFxuICAgICAgICAgICAgPEJveCBtYXJnaW5Cb3R0b209ezF9PlxuICAgICAgICAgICAgICA8QWdlbnRQcm9tcHREaXNwbGF5IHByb21wdD17cHJvbXB0fSAvPlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgKX1cbiAgICAgICAgICB7ZGlzcGxheWVkTWVzc2FnZXMubWFwKHByb2Nlc3NlZCA9PiB7XG4gICAgICAgICAgICBpZiAocHJvY2Vzc2VkLnR5cGUgPT09ICdzdW1tYXJ5Jykge1xuICAgICAgICAgICAgICAvLyBSZW5kZXIgc3VtbWFyeSBmb3IgZ3JvdXBlZCBzZWFyY2gvcmVhZC9SRVBMIG9wZXJhdGlvbnMgdXNpbmcgc2hhcmVkIGZvcm1hdHRpbmdcbiAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeVRleHQgPSBnZXRTZWFyY2hSZWFkU3VtbWFyeVRleHQoXG4gICAgICAgICAgICAgICAgcHJvY2Vzc2VkLnNlYXJjaENvdW50LFxuICAgICAgICAgICAgICAgIHByb2Nlc3NlZC5yZWFkQ291bnQsXG4gICAgICAgICAgICAgICAgcHJvY2Vzc2VkLmlzQWN0aXZlLFxuICAgICAgICAgICAgICAgIHByb2Nlc3NlZC5yZXBsQ291bnQsXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICA8Qm94IGtleT17cHJvY2Vzc2VkLnV1aWR9IGhlaWdodD17MX0gb3ZlcmZsb3c9XCJoaWRkZW5cIj5cbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPntzdW1tYXJ5VGV4dH08L1RleHQ+XG4gICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIFJlbmRlciBvcmlnaW5hbCBtZXNzYWdlIHdpdGhvdXQgaGVpZ2h0PTEgd3JhcHBlciBzbyBudWxsXG4gICAgICAgICAgICAvLyBjb250ZW50ICh0b29sIG5vdCBmb3VuZCwgcmVuZGVyVG9vbFVzZU1lc3NhZ2UgcmV0dXJucyBudWxsKVxuICAgICAgICAgICAgLy8gZG9lc24ndCBsZWF2ZSBhIGJsYW5rIGxpbmUuIFRvb2wgY2FsbCBoZWFkZXJzIGFyZSBzaW5nbGUtbGluZVxuICAgICAgICAgICAgLy8gYW55d2F5IHNvIHRydW5jYXRpb24gaXNuJ3QgbmVlZGVkLlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgPE1lc3NhZ2VDb21wb25lbnRcbiAgICAgICAgICAgICAgICBrZXk9e3Byb2Nlc3NlZC5tZXNzYWdlLnV1aWR9XG4gICAgICAgICAgICAgICAgbWVzc2FnZT17cHJvY2Vzc2VkLm1lc3NhZ2UuZGF0YS5tZXNzYWdlfVxuICAgICAgICAgICAgICAgIGxvb2t1cHM9e3N1YmFnZW50TG9va3Vwc31cbiAgICAgICAgICAgICAgICBhZGRNYXJnaW49e2ZhbHNlfVxuICAgICAgICAgICAgICAgIHRvb2xzPXt0b29sc31cbiAgICAgICAgICAgICAgICBjb21tYW5kcz17W119XG4gICAgICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAgICAgICBpblByb2dyZXNzVG9vbFVzZUlEcz17Y29sbGFwc2VkSW5Qcm9ncmVzc0lEc31cbiAgICAgICAgICAgICAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZT17W119XG4gICAgICAgICAgICAgICAgc2hvdWxkQW5pbWF0ZT17ZmFsc2V9XG4gICAgICAgICAgICAgICAgc2hvdWxkU2hvd0RvdD17ZmFsc2V9XG4gICAgICAgICAgICAgICAgc3R5bGU9XCJjb25kZW5zZWRcIlxuICAgICAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2ZhbHNlfVxuICAgICAgICAgICAgICAgIGlzU3RhdGljPXt0cnVlfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgKVxuICAgICAgICAgIH0pfVxuICAgICAgICA8L1N1YkFnZW50UHJvdmlkZXI+XG4gICAgICAgIHtoaWRkZW5Ub29sVXNlQ291bnQgPiAwICYmIChcbiAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICt7aGlkZGVuVG9vbFVzZUNvdW50fSBtb3JlIHRvb2x7JyAnfVxuICAgICAgICAgICAge2hpZGRlblRvb2xVc2VDb3VudCA9PT0gMSA/ICd1c2UnIDogJ3VzZXMnfSA8Q3RybE9Ub0V4cGFuZCAvPlxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlUmVqZWN0ZWRNZXNzYWdlKFxuICBfaW5wdXQ6IHsgZGVzY3JpcHRpb246IHN0cmluZzsgcHJvbXB0OiBzdHJpbmc7IHN1YmFnZW50X3R5cGU6IHN0cmluZyB9LFxuICB7XG4gICAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2UsXG4gICAgdG9vbHMsXG4gICAgdmVyYm9zZSxcbiAgICBpc1RyYW5zY3JpcHRNb2RlLFxuICB9OiB7XG4gICAgY29sdW1uczogbnVtYmVyXG4gICAgbWVzc2FnZXM6IE1lc3NhZ2VbXVxuICAgIHN0eWxlPzogJ2NvbmRlbnNlZCdcbiAgICB0aGVtZTogVGhlbWVOYW1lXG4gICAgcHJvZ3Jlc3NNZXNzYWdlc0Zvck1lc3NhZ2U6IFByb2dyZXNzTWVzc2FnZTxQcm9ncmVzcz5bXVxuICAgIHRvb2xzOiBUb29sc1xuICAgIHZlcmJvc2U6IGJvb2xlYW5cbiAgICBpc1RyYW5zY3JpcHRNb2RlPzogYm9vbGVhblxuICB9LFxuKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgLy8gR2V0IGFnZW50SWQgZnJvbSBwcm9ncmVzcyBtZXNzYWdlcyBpZiBhdmFpbGFibGUgKGFnZW50IHdhcyBydW5uaW5nIGJlZm9yZSByZWplY3Rpb24pXG4gIGNvbnN0IGZpcnN0RGF0YSA9IHByb2dyZXNzTWVzc2FnZXNGb3JNZXNzYWdlWzBdPy5kYXRhXG4gIGNvbnN0IGFnZW50SWQgPVxuICAgIGZpcnN0RGF0YSAmJiBoYXNQcm9ncmVzc01lc3NhZ2UoZmlyc3REYXRhKSA/IGZpcnN0RGF0YS5hZ2VudElkIDogdW5kZWZpbmVkXG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAge1wiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgYWdlbnRJZCAmJiAoXG4gICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgPFRleHQgY29sb3I9XCJ3YXJuaW5nXCI+XG4gICAgICAgICAgICBbQU5ULU9OTFldIEFQSSBjYWxsczoge2dldERpc3BsYXlQYXRoKGdldER1bXBQcm9tcHRzUGF0aChhZ2VudElkKSl9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L01lc3NhZ2VSZXNwb25zZT5cbiAgICAgICl9XG4gICAgICB7cmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZShwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZSwge1xuICAgICAgICB0b29scyxcbiAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgaXNUcmFuc2NyaXB0TW9kZSxcbiAgICAgIH0pfVxuICAgICAgPEZhbGxiYWNrVG9vbFVzZVJlamVjdGVkTWVzc2FnZSAvPlxuICAgIDwvPlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJUb29sVXNlRXJyb3JNZXNzYWdlKFxuICByZXN1bHQ6IFRvb2xSZXN1bHRCbG9ja1BhcmFtWydjb250ZW50J10sXG4gIHtcbiAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZSxcbiAgICB0b29scyxcbiAgICB2ZXJib3NlLFxuICAgIGlzVHJhbnNjcmlwdE1vZGUsXG4gIH06IHtcbiAgICBwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZTogUHJvZ3Jlc3NNZXNzYWdlPFByb2dyZXNzPltdXG4gICAgdG9vbHM6IFRvb2xzXG4gICAgdmVyYm9zZTogYm9vbGVhblxuICAgIGlzVHJhbnNjcmlwdE1vZGU/OiBib29sZWFuXG4gIH0sXG4pOiBSZWFjdC5SZWFjdE5vZGUge1xuICByZXR1cm4gKFxuICAgIDw+XG4gICAgICB7cmVuZGVyVG9vbFVzZVByb2dyZXNzTWVzc2FnZShwcm9ncmVzc01lc3NhZ2VzRm9yTWVzc2FnZSwge1xuICAgICAgICB0b29scyxcbiAgICAgICAgdmVyYm9zZSxcbiAgICAgICAgaXNUcmFuc2NyaXB0TW9kZSxcbiAgICAgIH0pfVxuICAgICAgPEZhbGxiYWNrVG9vbFVzZUVycm9yTWVzc2FnZSByZXN1bHQ9e3Jlc3VsdH0gdmVyYm9zZT17dmVyYm9zZX0gLz5cbiAgICA8Lz5cbiAgKVxufVxuXG5mdW5jdGlvbiBjYWxjdWxhdGVBZ2VudFN0YXRzKHByb2dyZXNzTWVzc2FnZXM6IFByb2dyZXNzTWVzc2FnZTxQcm9ncmVzcz5bXSk6IHtcbiAgdG9vbFVzZUNvdW50OiBudW1iZXJcbiAgdG9rZW5zOiBudW1iZXIgfCBudWxsXG59IHtcbiAgY29uc3QgdG9vbFVzZUNvdW50ID0gY291bnQocHJvZ3Jlc3NNZXNzYWdlcywgbXNnID0+IHtcbiAgICBpZiAoIWhhc1Byb2dyZXNzTWVzc2FnZShtc2cuZGF0YSkpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICBjb25zdCBtZXNzYWdlID0gbXNnLmRhdGEubWVzc2FnZVxuICAgIHJldHVybiAoXG4gICAgICBtZXNzYWdlLnR5cGUgPT09ICd1c2VyJyAmJlxuICAgICAgbWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQuc29tZShjb250ZW50ID0+IGNvbnRlbnQudHlwZSA9PT0gJ3Rvb2xfcmVzdWx0JylcbiAgICApXG4gIH0pXG5cbiAgY29uc3QgbGF0ZXN0QXNzaXN0YW50ID0gcHJvZ3Jlc3NNZXNzYWdlcy5maW5kTGFzdChcbiAgICAobXNnKTogbXNnIGlzIFByb2dyZXNzTWVzc2FnZTxBZ2VudFRvb2xQcm9ncmVzcz4gPT5cbiAgICAgIGhhc1Byb2dyZXNzTWVzc2FnZShtc2cuZGF0YSkgJiYgbXNnLmRhdGEubWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50JyxcbiAgKVxuXG4gIGxldCB0b2tlbnMgPSBudWxsXG4gIGlmIChsYXRlc3RBc3Npc3RhbnQ/LmRhdGEubWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgIGNvbnN0IHVzYWdlID0gbGF0ZXN0QXNzaXN0YW50LmRhdGEubWVzc2FnZS5tZXNzYWdlLnVzYWdlXG4gICAgdG9rZW5zID1cbiAgICAgICh1c2FnZS5jYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMgPz8gMCkgK1xuICAgICAgKHVzYWdlLmNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zID8/IDApICtcbiAgICAgIHVzYWdlLmlucHV0X3Rva2VucyArXG4gICAgICB1c2FnZS5vdXRwdXRfdG9rZW5zXG4gIH1cblxuICByZXR1cm4geyB0b29sVXNlQ291bnQsIHRva2VucyB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXJHcm91cGVkQWdlbnRUb29sVXNlKFxuICB0b29sVXNlczogQXJyYXk8e1xuICAgIHBhcmFtOiBUb29sVXNlQmxvY2tQYXJhbVxuICAgIGlzUmVzb2x2ZWQ6IGJvb2xlYW5cbiAgICBpc0Vycm9yOiBib29sZWFuXG4gICAgaXNJblByb2dyZXNzOiBib29sZWFuXG4gICAgcHJvZ3Jlc3NNZXNzYWdlczogUHJvZ3Jlc3NNZXNzYWdlPFByb2dyZXNzPltdXG4gICAgcmVzdWx0Pzoge1xuICAgICAgcGFyYW06IFRvb2xSZXN1bHRCbG9ja1BhcmFtXG4gICAgICBvdXRwdXQ6IE91dHB1dFxuICAgIH1cbiAgfT4sXG4gIG9wdGlvbnM6IHtcbiAgICBzaG91bGRBbmltYXRlOiBib29sZWFuXG4gICAgdG9vbHM6IFRvb2xzXG4gIH0sXG4pOiBSZWFjdC5SZWFjdE5vZGUgfCBudWxsIHtcbiAgY29uc3QgeyBzaG91bGRBbmltYXRlLCB0b29scyB9ID0gb3B0aW9uc1xuXG4gIC8vIENhbGN1bGF0ZSBzdGF0cyBmb3IgZWFjaCBhZ2VudFxuICBjb25zdCBhZ2VudFN0YXRzID0gdG9vbFVzZXMubWFwKFxuICAgICh7IHBhcmFtLCBpc1Jlc29sdmVkLCBpc0Vycm9yLCBwcm9ncmVzc01lc3NhZ2VzLCByZXN1bHQgfSkgPT4ge1xuICAgICAgY29uc3Qgc3RhdHMgPSBjYWxjdWxhdGVBZ2VudFN0YXRzKHByb2dyZXNzTWVzc2FnZXMpXG4gICAgICBjb25zdCBsYXN0VG9vbEluZm8gPSBleHRyYWN0TGFzdFRvb2xJbmZvKHByb2dyZXNzTWVzc2FnZXMsIHRvb2xzKVxuICAgICAgY29uc3QgcGFyc2VkSW5wdXQgPSBpbnB1dFNjaGVtYSgpLnNhZmVQYXJzZShwYXJhbS5pbnB1dClcblxuICAgICAgLy8gdGVhbW1hdGVfc3Bhd25lZCBpcyBub3QgcGFydCBvZiB0aGUgZXhwb3J0ZWQgT3V0cHV0IHR5cGUgKGNhc3QgdGhyb3VnaCB1bmtub3duXG4gICAgICAvLyBmb3IgZGVhZCBjb2RlIGVsaW1pbmF0aW9uKSwgc28gY2hlY2sgdmlhIHN0cmluZyBjb21wYXJpc29uIG9uIHRoZSByYXcgdmFsdWVcbiAgICAgIGNvbnN0IGlzVGVhbW1hdGVTcGF3biA9XG4gICAgICAgIChyZXN1bHQ/Lm91dHB1dD8uc3RhdHVzIGFzIHN0cmluZykgPT09ICd0ZWFtbWF0ZV9zcGF3bmVkJ1xuXG4gICAgICAvLyBGb3IgdGVhbW1hdGUgc3Bhd25zLCBzaG93IEBuYW1lIHdpdGggdHlwZSBpbiBwYXJlbnMgYW5kIGRlc2NyaXB0aW9uIGFzIHN0YXR1c1xuICAgICAgbGV0IGFnZW50VHlwZTogc3RyaW5nXG4gICAgICBsZXQgZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZFxuICAgICAgbGV0IGNvbG9yOiBrZXlvZiBUaGVtZSB8IHVuZGVmaW5lZFxuICAgICAgbGV0IGRlc2NyaXB0aW9uQ29sb3I6IGtleW9mIFRoZW1lIHwgdW5kZWZpbmVkXG4gICAgICBsZXQgdGFza0Rlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWRcbiAgICAgIGlmIChpc1RlYW1tYXRlU3Bhd24gJiYgcGFyc2VkSW5wdXQuc3VjY2VzcyAmJiBwYXJzZWRJbnB1dC5kYXRhLm5hbWUpIHtcbiAgICAgICAgYWdlbnRUeXBlID0gYEAke3BhcnNlZElucHV0LmRhdGEubmFtZX1gXG4gICAgICAgIGNvbnN0IHN1YmFnZW50VHlwZSA9IHBhcnNlZElucHV0LmRhdGEuc3ViYWdlbnRfdHlwZVxuICAgICAgICBkZXNjcmlwdGlvbiA9IGlzQ3VzdG9tU3ViYWdlbnRUeXBlKHN1YmFnZW50VHlwZSlcbiAgICAgICAgICA/IHN1YmFnZW50VHlwZVxuICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgIHRhc2tEZXNjcmlwdGlvbiA9IHBhcnNlZElucHV0LmRhdGEuZGVzY3JpcHRpb25cbiAgICAgICAgLy8gVXNlIHRoZSBjdXN0b20gYWdlbnQgZGVmaW5pdGlvbidzIGNvbG9yIG9uIHRoZSB0eXBlLCBub3QgdGhlIG5hbWVcbiAgICAgICAgZGVzY3JpcHRpb25Db2xvciA9IGlzQ3VzdG9tU3ViYWdlbnRUeXBlKHN1YmFnZW50VHlwZSlcbiAgICAgICAgICA/IChnZXRBZ2VudENvbG9yKHN1YmFnZW50VHlwZSkgYXMga2V5b2YgVGhlbWUgfCB1bmRlZmluZWQpXG4gICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFnZW50VHlwZSA9IHBhcnNlZElucHV0LnN1Y2Nlc3NcbiAgICAgICAgICA/IHVzZXJGYWNpbmdOYW1lKHBhcnNlZElucHV0LmRhdGEpXG4gICAgICAgICAgOiAnQWdlbnQnXG4gICAgICAgIGRlc2NyaXB0aW9uID0gcGFyc2VkSW5wdXQuc3VjY2Vzc1xuICAgICAgICAgID8gcGFyc2VkSW5wdXQuZGF0YS5kZXNjcmlwdGlvblxuICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgIGNvbG9yID0gcGFyc2VkSW5wdXQuc3VjY2Vzc1xuICAgICAgICAgID8gdXNlckZhY2luZ05hbWVCYWNrZ3JvdW5kQ29sb3IocGFyc2VkSW5wdXQuZGF0YSlcbiAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICB0YXNrRGVzY3JpcHRpb24gPSB1bmRlZmluZWRcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgdGhpcyB3YXMgbGF1bmNoZWQgYXMgYSBiYWNrZ3JvdW5kIGFnZW50IE9SIGJhY2tncm91bmRlZCBtaWQtZXhlY3V0aW9uXG4gICAgICBjb25zdCBsYXVuY2hlZEFzQXN5bmMgPVxuICAgICAgICBwYXJzZWRJbnB1dC5zdWNjZXNzICYmXG4gICAgICAgICdydW5faW5fYmFja2dyb3VuZCcgaW4gcGFyc2VkSW5wdXQuZGF0YSAmJlxuICAgICAgICBwYXJzZWRJbnB1dC5kYXRhLnJ1bl9pbl9iYWNrZ3JvdW5kID09PSB0cnVlXG4gICAgICBjb25zdCBvdXRwdXRTdGF0dXMgPSAocmVzdWx0Py5vdXRwdXQgYXMgeyBzdGF0dXM/OiBzdHJpbmcgfSB8IHVuZGVmaW5lZClcbiAgICAgICAgPy5zdGF0dXNcbiAgICAgIGNvbnN0IGJhY2tncm91bmRlZE1pZEV4ZWN1dGlvbiA9XG4gICAgICAgIG91dHB1dFN0YXR1cyA9PT0gJ2FzeW5jX2xhdW5jaGVkJyB8fCBvdXRwdXRTdGF0dXMgPT09ICdyZW1vdGVfbGF1bmNoZWQnXG4gICAgICBjb25zdCBpc0FzeW5jID1cbiAgICAgICAgbGF1bmNoZWRBc0FzeW5jIHx8IGJhY2tncm91bmRlZE1pZEV4ZWN1dGlvbiB8fCBpc1RlYW1tYXRlU3Bhd25cblxuICAgICAgY29uc3QgbmFtZSA9IHBhcnNlZElucHV0LnN1Y2Nlc3MgPyBwYXJzZWRJbnB1dC5kYXRhLm5hbWUgOiB1bmRlZmluZWRcblxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgaWQ6IHBhcmFtLmlkLFxuICAgICAgICBhZ2VudFR5cGUsXG4gICAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgICB0b29sVXNlQ291bnQ6IHN0YXRzLnRvb2xVc2VDb3VudCxcbiAgICAgICAgdG9rZW5zOiBzdGF0cy50b2tlbnMsXG4gICAgICAgIGlzUmVzb2x2ZWQsXG4gICAgICAgIGlzRXJyb3IsXG4gICAgICAgIGlzQXN5bmMsXG4gICAgICAgIGNvbG9yLFxuICAgICAgICBkZXNjcmlwdGlvbkNvbG9yLFxuICAgICAgICBsYXN0VG9vbEluZm8sXG4gICAgICAgIHRhc2tEZXNjcmlwdGlvbixcbiAgICAgICAgbmFtZSxcbiAgICAgIH1cbiAgICB9LFxuICApXG5cbiAgY29uc3QgYW55VW5yZXNvbHZlZCA9IHRvb2xVc2VzLnNvbWUodCA9PiAhdC5pc1Jlc29sdmVkKVxuICBjb25zdCBhbnlFcnJvciA9IHRvb2xVc2VzLnNvbWUodCA9PiB0LmlzRXJyb3IpXG4gIGNvbnN0IGFsbENvbXBsZXRlID0gIWFueVVucmVzb2x2ZWRcblxuICAvLyBDaGVjayBpZiBhbGwgYWdlbnRzIGFyZSB0aGUgc2FtZSB0eXBlXG4gIGNvbnN0IGFsbFNhbWVUeXBlID1cbiAgICBhZ2VudFN0YXRzLmxlbmd0aCA+IDAgJiZcbiAgICBhZ2VudFN0YXRzLmV2ZXJ5KHN0YXQgPT4gc3RhdC5hZ2VudFR5cGUgPT09IGFnZW50U3RhdHNbMF0/LmFnZW50VHlwZSlcbiAgY29uc3QgY29tbW9uVHlwZSA9XG4gICAgYWxsU2FtZVR5cGUgJiYgYWdlbnRTdGF0c1swXT8uYWdlbnRUeXBlICE9PSAnQWdlbnQnXG4gICAgICA/IGFnZW50U3RhdHNbMF0/LmFnZW50VHlwZVxuICAgICAgOiBudWxsXG5cbiAgLy8gQ2hlY2sgaWYgYWxsIHJlc29sdmVkIGFnZW50cyBhcmUgYXN5bmMgKGJhY2tncm91bmQpXG4gIGNvbnN0IGFsbEFzeW5jID0gYWdlbnRTdGF0cy5ldmVyeShzdGF0ID0+IHN0YXQuaXNBc3luYylcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgPFRvb2xVc2VMb2FkZXJcbiAgICAgICAgICBzaG91bGRBbmltYXRlPXtzaG91bGRBbmltYXRlICYmIGFueVVucmVzb2x2ZWR9XG4gICAgICAgICAgaXNVbnJlc29sdmVkPXthbnlVbnJlc29sdmVkfVxuICAgICAgICAgIGlzRXJyb3I9e2FueUVycm9yfVxuICAgICAgICAvPlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICB7YWxsQ29tcGxldGUgPyAoXG4gICAgICAgICAgICBhbGxBc3luYyA/IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8VGV4dCBib2xkPnt0b29sVXNlcy5sZW5ndGh9PC9UZXh0PiBiYWNrZ3JvdW5kIGFnZW50cyBsYXVuY2hlZHsnICd9XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICA8S2V5Ym9hcmRTaG9ydGN1dEhpbnQgc2hvcnRjdXQ9XCLihpNcIiBhY3Rpb249XCJtYW5hZ2VcIiBwYXJlbnMgLz5cbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8VGV4dCBib2xkPnt0b29sVXNlcy5sZW5ndGh9PC9UZXh0PnsnICd9XG4gICAgICAgICAgICAgICAge2NvbW1vblR5cGUgPyBgJHtjb21tb25UeXBlfSBhZ2VudHNgIDogJ2FnZW50cyd9IGZpbmlzaGVkXG4gICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgKVxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8PlxuICAgICAgICAgICAgICBSdW5uaW5nIDxUZXh0IGJvbGQ+e3Rvb2xVc2VzLmxlbmd0aH08L1RleHQ+eycgJ31cbiAgICAgICAgICAgICAge2NvbW1vblR5cGUgPyBgJHtjb21tb25UeXBlfSBhZ2VudHNgIDogJ2FnZW50cyd94oCmXG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApfXsnICd9XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAgeyFhbGxBc3luYyAmJiA8Q3RybE9Ub0V4cGFuZCAvPn1cbiAgICAgIDwvQm94PlxuICAgICAge2FnZW50U3RhdHMubWFwKChzdGF0LCBpbmRleCkgPT4gKFxuICAgICAgICA8QWdlbnRQcm9ncmVzc0xpbmVcbiAgICAgICAgICBrZXk9e3N0YXQuaWR9XG4gICAgICAgICAgYWdlbnRUeXBlPXtzdGF0LmFnZW50VHlwZX1cbiAgICAgICAgICBkZXNjcmlwdGlvbj17c3RhdC5kZXNjcmlwdGlvbn1cbiAgICAgICAgICBkZXNjcmlwdGlvbkNvbG9yPXtzdGF0LmRlc2NyaXB0aW9uQ29sb3J9XG4gICAgICAgICAgdGFza0Rlc2NyaXB0aW9uPXtzdGF0LnRhc2tEZXNjcmlwdGlvbn1cbiAgICAgICAgICB0b29sVXNlQ291bnQ9e3N0YXQudG9vbFVzZUNvdW50fVxuICAgICAgICAgIHRva2Vucz17c3RhdC50b2tlbnN9XG4gICAgICAgICAgY29sb3I9e3N0YXQuY29sb3J9XG4gICAgICAgICAgaXNMYXN0PXtpbmRleCA9PT0gYWdlbnRTdGF0cy5sZW5ndGggLSAxfVxuICAgICAgICAgIGlzUmVzb2x2ZWQ9e3N0YXQuaXNSZXNvbHZlZH1cbiAgICAgICAgICBpc0Vycm9yPXtzdGF0LmlzRXJyb3J9XG4gICAgICAgICAgaXNBc3luYz17c3RhdC5pc0FzeW5jfVxuICAgICAgICAgIHNob3VsZEFuaW1hdGU9e3Nob3VsZEFuaW1hdGV9XG4gICAgICAgICAgbGFzdFRvb2xJbmZvPXtzdGF0Lmxhc3RUb29sSW5mb31cbiAgICAgICAgICBoaWRlVHlwZT17YWxsU2FtZVR5cGV9XG4gICAgICAgICAgbmFtZT17c3RhdC5uYW1lfVxuICAgICAgICAvPlxuICAgICAgKSl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZXJGYWNpbmdOYW1lKFxuICBpbnB1dDpcbiAgICB8IFBhcnRpYWw8e1xuICAgICAgICBkZXNjcmlwdGlvbjogc3RyaW5nXG4gICAgICAgIHByb21wdDogc3RyaW5nXG4gICAgICAgIHN1YmFnZW50X3R5cGU6IHN0cmluZ1xuICAgICAgICBuYW1lOiBzdHJpbmdcbiAgICAgICAgdGVhbV9uYW1lOiBzdHJpbmdcbiAgICAgIH0+XG4gICAgfCB1bmRlZmluZWQsXG4pOiBzdHJpbmcge1xuICBpZiAoXG4gICAgaW5wdXQ/LnN1YmFnZW50X3R5cGUgJiZcbiAgICBpbnB1dC5zdWJhZ2VudF90eXBlICE9PSBHRU5FUkFMX1BVUlBPU0VfQUdFTlQuYWdlbnRUeXBlXG4gICkge1xuICAgIC8vIERpc3BsYXkgXCJ3b3JrZXJcIiBhZ2VudHMgYXMgXCJBZ2VudFwiIGZvciBjbGVhbmVyIFVJXG4gICAgaWYgKGlucHV0LnN1YmFnZW50X3R5cGUgPT09ICd3b3JrZXInKSB7XG4gICAgICByZXR1cm4gJ0FnZW50J1xuICAgIH1cbiAgICByZXR1cm4gaW5wdXQuc3ViYWdlbnRfdHlwZVxuICB9XG4gIHJldHVybiAnQWdlbnQnXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VyRmFjaW5nTmFtZUJhY2tncm91bmRDb2xvcihcbiAgaW5wdXQ6XG4gICAgfCBQYXJ0aWFsPHsgZGVzY3JpcHRpb246IHN0cmluZzsgcHJvbXB0OiBzdHJpbmc7IHN1YmFnZW50X3R5cGU6IHN0cmluZyB9PlxuICAgIHwgdW5kZWZpbmVkLFxuKToga2V5b2YgVGhlbWUgfCB1bmRlZmluZWQge1xuICBpZiAoIWlucHV0Py5zdWJhZ2VudF90eXBlKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gR2V0IHRoZSBjb2xvciBmb3IgdGhpcyBhZ2VudFxuICByZXR1cm4gZ2V0QWdlbnRDb2xvcihpbnB1dC5zdWJhZ2VudF90eXBlKSBhcyBrZXlvZiBUaGVtZSB8IHVuZGVmaW5lZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdExhc3RUb29sSW5mbyhcbiAgcHJvZ3Jlc3NNZXNzYWdlczogUHJvZ3Jlc3NNZXNzYWdlPFByb2dyZXNzPltdLFxuICB0b29sczogVG9vbHMsXG4pOiBzdHJpbmcgfCBudWxsIHtcbiAgLy8gQnVpbGQgdG9vbF91c2UgbG9va3VwIGZyb20gYWxsIHByb2dyZXNzIG1lc3NhZ2VzIChuZWVkZWQgZm9yIHJldmVyc2UgaXRlcmF0aW9uKVxuICBjb25zdCB0b29sVXNlQnlJRCA9IG5ldyBNYXA8c3RyaW5nLCBUb29sVXNlQmxvY2tQYXJhbT4oKVxuICBmb3IgKGNvbnN0IHBtIG9mIHByb2dyZXNzTWVzc2FnZXMpIHtcbiAgICBpZiAoIWhhc1Byb2dyZXNzTWVzc2FnZShwbS5kYXRhKSkge1xuICAgICAgY29udGludWVcbiAgICB9XG4gICAgaWYgKHBtLmRhdGEubWVzc2FnZS50eXBlID09PSAnYXNzaXN0YW50Jykge1xuICAgICAgZm9yIChjb25zdCBjIG9mIHBtLmRhdGEubWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQpIHtcbiAgICAgICAgaWYgKGMudHlwZSA9PT0gJ3Rvb2xfdXNlJykge1xuICAgICAgICAgIHRvb2xVc2VCeUlELnNldChjLmlkLCBjIGFzIFRvb2xVc2VCbG9ja1BhcmFtKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ291bnQgdHJhaWxpbmcgY29uc2VjdXRpdmUgc2VhcmNoL3JlYWQgb3BlcmF0aW9ucyBmcm9tIHRoZSBlbmRcbiAgbGV0IHNlYXJjaENvdW50ID0gMFxuICBsZXQgcmVhZENvdW50ID0gMFxuICBmb3IgKGxldCBpID0gcHJvZ3Jlc3NNZXNzYWdlcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGNvbnN0IG1zZyA9IHByb2dyZXNzTWVzc2FnZXNbaV0hXG4gICAgaWYgKCFoYXNQcm9ncmVzc01lc3NhZ2UobXNnLmRhdGEpKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cbiAgICBjb25zdCBpbmZvID0gZ2V0U2VhcmNoT3JSZWFkSW5mbyhtc2csIHRvb2xzLCB0b29sVXNlQnlJRClcbiAgICBpZiAoaW5mbyAmJiAoaW5mby5pc1NlYXJjaCB8fCBpbmZvLmlzUmVhZCkpIHtcbiAgICAgIC8vIE9ubHkgY291bnQgdG9vbF9yZXN1bHQgbWVzc2FnZXMgdG8gYXZvaWQgZG91YmxlIGNvdW50aW5nXG4gICAgICBpZiAobXNnLmRhdGEubWVzc2FnZS50eXBlID09PSAndXNlcicpIHtcbiAgICAgICAgaWYgKGluZm8uaXNTZWFyY2gpIHtcbiAgICAgICAgICBzZWFyY2hDb3VudCsrXG4gICAgICAgIH0gZWxzZSBpZiAoaW5mby5pc1JlYWQpIHtcbiAgICAgICAgICByZWFkQ291bnQrK1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHNlYXJjaENvdW50ICsgcmVhZENvdW50ID49IDIpIHtcbiAgICByZXR1cm4gZ2V0U2VhcmNoUmVhZFN1bW1hcnlUZXh0KHNlYXJjaENvdW50LCByZWFkQ291bnQsIHRydWUpXG4gIH1cblxuICAvLyBGaW5kIHRoZSBsYXN0IHRvb2xfcmVzdWx0IG1lc3NhZ2VcbiAgY29uc3QgbGFzdFRvb2xSZXN1bHQgPSBwcm9ncmVzc01lc3NhZ2VzLmZpbmRMYXN0KFxuICAgIChtc2cpOiBtc2cgaXMgUHJvZ3Jlc3NNZXNzYWdlPEFnZW50VG9vbFByb2dyZXNzPiA9PiB7XG4gICAgICBpZiAoIWhhc1Byb2dyZXNzTWVzc2FnZShtc2cuZGF0YSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgICBjb25zdCBtZXNzYWdlID0gbXNnLmRhdGEubWVzc2FnZVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgbWVzc2FnZS50eXBlID09PSAndXNlcicgJiZcbiAgICAgICAgbWVzc2FnZS5tZXNzYWdlLmNvbnRlbnQuc29tZShjID0+IGMudHlwZSA9PT0gJ3Rvb2xfcmVzdWx0JylcbiAgICAgIClcbiAgICB9LFxuICApXG5cbiAgaWYgKGxhc3RUb29sUmVzdWx0Py5kYXRhLm1lc3NhZ2UudHlwZSA9PT0gJ3VzZXInKSB7XG4gICAgY29uc3QgdG9vbFJlc3VsdEJsb2NrID0gbGFzdFRvb2xSZXN1bHQuZGF0YS5tZXNzYWdlLm1lc3NhZ2UuY29udGVudC5maW5kKFxuICAgICAgYyA9PiBjLnR5cGUgPT09ICd0b29sX3Jlc3VsdCcsXG4gICAgKVxuXG4gICAgaWYgKHRvb2xSZXN1bHRCbG9jaz8udHlwZSA9PT0gJ3Rvb2xfcmVzdWx0Jykge1xuICAgICAgLy8gTG9vayB1cCB0aGUgY29ycmVzcG9uZGluZyB0b29sX3VzZSDigJQgYWxyZWFkeSBpbmRleGVkIGFib3ZlXG4gICAgICBjb25zdCB0b29sVXNlQmxvY2sgPSB0b29sVXNlQnlJRC5nZXQodG9vbFJlc3VsdEJsb2NrLnRvb2xfdXNlX2lkKVxuXG4gICAgICBpZiAodG9vbFVzZUJsb2NrKSB7XG4gICAgICAgIGNvbnN0IHRvb2wgPSBmaW5kVG9vbEJ5TmFtZSh0b29scywgdG9vbFVzZUJsb2NrLm5hbWUpXG4gICAgICAgIGlmICghdG9vbCkge1xuICAgICAgICAgIHJldHVybiB0b29sVXNlQmxvY2submFtZSAvLyBGYWxsYmFjayB0byByYXcgbmFtZVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgaW5wdXQgPSB0b29sVXNlQmxvY2suaW5wdXQgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgICAgICAgY29uc3QgcGFyc2VkSW5wdXQgPSB0b29sLmlucHV0U2NoZW1hLnNhZmVQYXJzZShpbnB1dClcblxuICAgICAgICAvLyBHZXQgdXNlci1mYWNpbmcgdG9vbCBuYW1lXG4gICAgICAgIGNvbnN0IHVzZXJGYWNpbmdUb29sTmFtZSA9IHRvb2wudXNlckZhY2luZ05hbWUoXG4gICAgICAgICAgcGFyc2VkSW5wdXQuc3VjY2VzcyA/IHBhcnNlZElucHV0LmRhdGEgOiB1bmRlZmluZWQsXG4gICAgICAgIClcblxuICAgICAgICAvLyBUcnkgdG8gZ2V0IHN1bW1hcnkgZnJvbSB0aGUgdG9vbCBpdHNlbGZcbiAgICAgICAgaWYgKHRvb2wuZ2V0VG9vbFVzZVN1bW1hcnkpIHtcbiAgICAgICAgICBjb25zdCBzdW1tYXJ5ID0gdG9vbC5nZXRUb29sVXNlU3VtbWFyeShcbiAgICAgICAgICAgIHBhcnNlZElucHV0LnN1Y2Nlc3MgPyBwYXJzZWRJbnB1dC5kYXRhIDogdW5kZWZpbmVkLFxuICAgICAgICAgIClcbiAgICAgICAgICBpZiAoc3VtbWFyeSkge1xuICAgICAgICAgICAgcmV0dXJuIGAke3VzZXJGYWNpbmdUb29sTmFtZX06ICR7c3VtbWFyeX1gXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gRGVmYXVsdDoganVzdCBzaG93IHVzZXItZmFjaW5nIHRvb2wgbmFtZVxuICAgICAgICByZXR1cm4gdXNlckZhY2luZ1Rvb2xOYW1lXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaXNDdXN0b21TdWJhZ2VudFR5cGUoXG4gIHN1YmFnZW50VHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLFxuKTogc3ViYWdlbnRUeXBlIGlzIHN0cmluZyB7XG4gIHJldHVybiAoXG4gICAgISFzdWJhZ2VudFR5cGUgJiZcbiAgICBzdWJhZ2VudFR5cGUgIT09IEdFTkVSQUxfUFVSUE9TRV9BR0VOVC5hZ2VudFR5cGUgJiZcbiAgICBzdWJhZ2VudFR5cGUgIT09ICd3b3JrZXInXG4gIClcbn1cbiJdLCJtYXBwaW5ncyI6IjtBQUFBLGNBQ0VBLG9CQUFvQixFQUNwQkMsaUJBQWlCLFFBQ1osdUNBQXVDO0FBQzlDLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsU0FBU0Msd0JBQXdCLFFBQVEsNENBQTRDO0FBQ3JGLFNBQ0VDLGFBQWEsRUFDYkMsZ0JBQWdCLFFBQ1gsaUNBQWlDO0FBQ3hDLFNBQVNDLE1BQU0sUUFBUSx3Q0FBd0M7QUFDL0QsU0FBU0Msb0JBQW9CLFFBQVEsc0RBQXNEO0FBQzNGLGNBQWNDLENBQUMsUUFBUSxRQUFRO0FBQy9CLFNBQVNDLGlCQUFpQixRQUFRLHVDQUF1QztBQUN6RSxTQUFTQywyQkFBMkIsUUFBUSxpREFBaUQ7QUFDN0YsU0FBU0MsOEJBQThCLFFBQVEsb0RBQW9EO0FBQ25HLFNBQVNDLFFBQVEsUUFBUSw4QkFBOEI7QUFDdkQsU0FBU0MsT0FBTyxJQUFJQyxnQkFBZ0IsUUFBUSw2QkFBNkI7QUFDekUsU0FBU0MsZUFBZSxRQUFRLHFDQUFxQztBQUNyRSxTQUFTQyxhQUFhLFFBQVEsbUNBQW1D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