import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import { basename } from 'path';
import React, { useRef } from 'react';
import { useMinDisplayTime } from '../../hooks/useMinDisplayTime.js';
import { Ansi, Box, Text, useTheme } from '../../ink.js';
import { findToolByName, type Tools } from '../../Tool.js';
import { getReplPrimitiveTools } from '../../tools/REPLTool/primitiveTools.js';
import type { CollapsedReadSearchGroup, NormalizedAssistantMessage } from '../../types/message.js';
import { uniq } from '../../utils/array.js';
import { getToolUseIdsFromCollapsedGroup } from '../../utils/collapseReadSearch.js';
import { getDisplayPath } from '../../utils/file.js';
import { formatDuration, formatSecondsShort } from '../../utils/format.js';
import { isFullscreenEnvEnabled } from '../../utils/fullscreen.js';
import type { buildMessageLookups } from '../../utils/messages.js';
import type { ThemeName } from '../../utils/theme.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { useSelectedMessageBg } from '../messageActions.js';
import { PrBadge } from '../PrBadge.js';
import { ToolUseLoader } from '../ToolUseLoader.js';

/* eslint-disable @typescript-eslint/no-require-imports */
const teamMemCollapsed = feature('TEAMMEM') ? require('./teamMemCollapsed.js') as typeof import('./teamMemCollapsed.js') : null;
/* eslint-enable @typescript-eslint/no-require-imports */

// Hold each ⤿ hint for a minimum duration so fast-completing tool calls
// (bash commands, file reads, search patterns) are actually readable instead
// of flickering past in a single frame.
const MIN_HINT_DISPLAY_MS = 700;
type Props = {
  message: CollapsedReadSearchGroup;
  inProgressToolUseIDs: Set<string>;
  shouldAnimate: boolean;
  verbose: boolean;
  tools: Tools;
  lookups: ReturnType<typeof buildMessageLookups>;
  /** True if this is the currently active collapsed group (last one, still loading) */
  isActiveGroup?: boolean;
};

/** Render a single tool use in verbose mode */
function VerboseToolUse(t0) {
  const $ = _c(24);
  const {
    content,
    tools,
    lookups,
    inProgressToolUseIDs,
    shouldAnimate,
    theme
  } = t0;
  const bg = useSelectedMessageBg();
  let t1;
  let t2;
  if ($[0] !== bg || $[1] !== content.id || $[2] !== content.input || $[3] !== content.name || $[4] !== inProgressToolUseIDs || $[5] !== lookups || $[6] !== shouldAnimate || $[7] !== theme || $[8] !== tools) {
    t2 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const tool = findToolByName(tools, content.name) ?? findToolByName(getReplPrimitiveTools(), content.name);
      if (!tool) {
        t2 = null;
        break bb0;
      }
      let t3;
      if ($[11] !== content.id || $[12] !== lookups.resolvedToolUseIDs) {
        t3 = lookups.resolvedToolUseIDs.has(content.id);
        $[11] = content.id;
        $[12] = lookups.resolvedToolUseIDs;
        $[13] = t3;
      } else {
        t3 = $[13];
      }
      const isResolved = t3;
      let t4;
      if ($[14] !== content.id || $[15] !== lookups.erroredToolUseIDs) {
        t4 = lookups.erroredToolUseIDs.has(content.id);
        $[14] = content.id;
        $[15] = lookups.erroredToolUseIDs;
        $[16] = t4;
      } else {
        t4 = $[16];
      }
      const isError = t4;
      let t5;
      if ($[17] !== content.id || $[18] !== inProgressToolUseIDs) {
        t5 = inProgressToolUseIDs.has(content.id);
        $[17] = content.id;
        $[18] = inProgressToolUseIDs;
        $[19] = t5;
      } else {
        t5 = $[19];
      }
      const isInProgress = t5;
      const resultMsg = lookups.toolResultByToolUseID.get(content.id);
      const rawToolResult = resultMsg?.type === "user" ? resultMsg.toolUseResult : undefined;
      const parsedOutput = tool.outputSchema?.safeParse(rawToolResult);
      const toolResult = parsedOutput?.success ? parsedOutput.data : undefined;
      const parsedInput = tool.inputSchema.safeParse(content.input);
      const input = parsedInput.success ? parsedInput.data : undefined;
      const userFacingName = tool.userFacingName(input);
      const toolUseMessage = input ? tool.renderToolUseMessage(input, {
        theme,
        verbose: true
      }) : null;
      const t6 = shouldAnimate && isInProgress;
      const t7 = !isResolved;
      let t8;
      if ($[20] !== isError || $[21] !== t6 || $[22] !== t7) {
        t8 = <ToolUseLoader shouldAnimate={t6} isUnresolved={t7} isError={isError} />;
        $[20] = isError;
        $[21] = t6;
        $[22] = t7;
        $[23] = t8;
      } else {
        t8 = $[23];
      }
      t1 = <Box key={content.id} flexDirection="column" marginTop={1} backgroundColor={bg}><Box flexDirection="row">{t8}<Text><Text bold={true}>{userFacingName}</Text>{toolUseMessage && <Text>({toolUseMessage})</Text>}</Text>{input && tool.renderToolUseTag?.(input)}</Box>{isResolved && !isError && toolResult !== undefined && <Box>{tool.renderToolResultMessage?.(toolResult, [], {
            verbose: true,
            tools,
            theme
          })}</Box>}</Box>;
    }
    $[0] = bg;
    $[1] = content.id;
    $[2] = content.input;
    $[3] = content.name;
    $[4] = inProgressToolUseIDs;
    $[5] = lookups;
    $[6] = shouldAnimate;
    $[7] = theme;
    $[8] = tools;
    $[9] = t1;
    $[10] = t2;
  } else {
    t1 = $[9];
    t2 = $[10];
  }
  if (t2 !== Symbol.for("react.early_return_sentinel")) {
    return t2;
  }
  return t1;
}
export function CollapsedReadSearchContent({
  message,
  inProgressToolUseIDs,
  shouldAnimate,
  verbose,
  tools,
  lookups,
  isActiveGroup
}: Props): React.ReactNode {
  const bg = useSelectedMessageBg();
  const {
    searchCount: rawSearchCount,
    readCount: rawReadCount,
    listCount: rawListCount,
    replCount,
    memorySearchCount,
    memoryReadCount,
    memoryWriteCount,
    messages: groupMessages
  } = message;
  const [theme] = useTheme();
  const toolUseIds = getToolUseIdsFromCollapsedGroup(message);
  const anyError = toolUseIds.some(id => lookups.erroredToolUseIDs.has(id));
  const hasMemoryOps = memorySearchCount > 0 || memoryReadCount > 0 || memoryWriteCount > 0;
  const hasTeamMemoryOps = feature('TEAMMEM') ? teamMemCollapsed!.checkHasTeamMemOps(message) : false;

  // Track the max seen counts so they only ever increase. The debounce timer
  // causes extra re-renders at arbitrary times; during a brief "invisible window"
  // in the streaming executor the group count can dip, which causes jitter.
  const maxReadCountRef = useRef(0);
  const maxSearchCountRef = useRef(0);
  const maxListCountRef = useRef(0);
  const maxMcpCountRef = useRef(0);
  const maxBashCountRef = useRef(0);
  maxReadCountRef.current = Math.max(maxReadCountRef.current, rawReadCount);
  maxSearchCountRef.current = Math.max(maxSearchCountRef.current, rawSearchCount);
  maxListCountRef.current = Math.max(maxListCountRef.current, rawListCount);
  maxMcpCountRef.current = Math.max(maxMcpCountRef.current, message.mcpCallCount ?? 0);
  maxBashCountRef.current = Math.max(maxBashCountRef.current, message.bashCount ?? 0);
  const readCount = maxReadCountRef.current;
  const searchCount = maxSearchCountRef.current;
  const listCount = maxListCountRef.current;
  const mcpCallCount = maxMcpCountRef.current;
  // Subtract commands surfaced as "Committed …" / "Created PR …" so the
  // same command isn't counted twice. gitOpBashCount is read live (no max-ref
  // needed — it's 0 until results arrive, then only grows).
  const gitOpBashCount = message.gitOpBashCount ?? 0;
  const bashCount = isFullscreenEnvEnabled() ? Math.max(0, maxBashCountRef.current - gitOpBashCount) : 0;
  const hasNonMemoryOps = searchCount > 0 || readCount > 0 || listCount > 0 || replCount > 0 || mcpCallCount > 0 || bashCount > 0 || gitOpBashCount > 0;
  const readPaths = message.readFilePaths;
  const searchArgs = message.searchArgs;
  let incomingHint = message.latestDisplayHint;
  if (incomingHint === undefined) {
    const lastSearchRaw = searchArgs?.at(-1);
    const lastSearch = lastSearchRaw !== undefined ? `"${lastSearchRaw}"` : undefined;
    const lastRead = readPaths?.at(-1);
    incomingHint = lastRead !== undefined ? getDisplayPath(lastRead) : lastSearch;
  }

  // Active REPL calls emit repl_tool_call progress with the current inner
  // tool's name+input. Virtual messages don't arrive until REPL completes,
  // so this is the only source of a live hint during execution.
  if (isActiveGroup) {
    for (const id_0 of toolUseIds) {
      if (!inProgressToolUseIDs.has(id_0)) continue;
      const latest = lookups.progressMessagesByToolUseID.get(id_0)?.at(-1)?.data;
      if (latest?.type === 'repl_tool_call' && latest.phase === 'start') {
        const input = latest.toolInput as {
          command?: string;
          pattern?: string;
          file_path?: string;
        };
        incomingHint = input.file_path ?? (input.pattern ? `"${input.pattern}"` : undefined) ?? input.command ?? latest.toolName;
      }
    }
  }
  const displayedHint = useMinDisplayTime(incomingHint, MIN_HINT_DISPLAY_MS);

  // In verbose mode, render each tool use with its 1-line result summary
  if (verbose) {
    const toolUses: NormalizedAssistantMessage[] = [];
    for (const msg of groupMessages) {
      if (msg.type === 'assistant') {
        toolUses.push(msg);
      } else if (msg.type === 'grouped_tool_use') {
        toolUses.push(...msg.messages);
      }
    }
    return <Box flexDirection="column">
        {toolUses.map(msg_0 => {
        const content = msg_0.message.content[0];
        if (content?.type !== 'tool_use') return null;
        return <VerboseToolUse key={content.id} content={content} tools={tools} lookups={lookups} inProgressToolUseIDs={inProgressToolUseIDs} shouldAnimate={shouldAnimate} theme={theme} />;
      })}
        {message.hookInfos && message.hookInfos.length > 0 && <>
            <Text dimColor>
              {'  ⎿  '}Ran {message.hookCount} PreToolUse{' '}
              {message.hookCount === 1 ? 'hook' : 'hooks'} (
              {formatSecondsShort(message.hookTotalMs ?? 0)})
            </Text>
            {message.hookInfos.map((info, idx) => <Text key={`hook-${idx}`} dimColor>
                {'     ⎿ '}
                {info.command} ({formatSecondsShort(info.durationMs ?? 0)})
              </Text>)}
          </>}
        {message.relevantMemories?.map(m => <Box key={m.path} flexDirection="column" marginTop={1}>
            <Text dimColor>
              {'  ⎿  '}Recalled {basename(m.path)}
            </Text>
            <Box paddingLeft={5}>
              <Text>
                <Ansi>{m.content}</Ansi>
              </Text>
            </Box>
          </Box>)}
      </Box>;
  }

  // Non-verbose mode: Show counts with blinking grey dot while active, green dot when finalized
  // Use present tense when active, past tense when finalized

  // Defensive: If all counts are 0, don't render the collapsed group
  // This shouldn't happen in normal operation, but handles edge cases
  if (!hasMemoryOps && !hasTeamMemoryOps && !hasNonMemoryOps) {
    return null;
  }

  // Find the slowest in-progress shell command in this group. BashTool yields
  // progress every second but the collapsed renderer never showed it — long
  // commands (npm install, tests) looked frozen. Shown after 2s so fast
  // commands stay clean; the ticking counter reassures that slow ones aren't stuck.
  let shellProgressSuffix = '';
  if (isFullscreenEnvEnabled() && isActiveGroup) {
    let elapsed: number | undefined;
    let lines = 0;
    for (const id_1 of toolUseIds) {
      if (!inProgressToolUseIDs.has(id_1)) continue;
      const data = lookups.progressMessagesByToolUseID.get(id_1)?.at(-1)?.data;
      if (data?.type !== 'bash_progress' && data?.type !== 'powershell_progress') {
        continue;
      }
      if (elapsed === undefined || data.elapsedTimeSeconds > elapsed) {
        elapsed = data.elapsedTimeSeconds;
        lines = data.totalLines;
      }
    }
    if (elapsed !== undefined && elapsed >= 2) {
      const time = formatDuration(elapsed * 1000);
      shellProgressSuffix = lines > 0 ? ` (${time} · ${lines} ${lines === 1 ? 'line' : 'lines'})` : ` (${time})`;
    }
  }

  // Build non-memory parts first (search, read, repl, mcp, bash) — these render
  // before memory so the line reads "Ran 3 bash commands, recalled 1 memory".
  const nonMemParts: React.ReactNode[] = [];

  // Git operations lead the line — they're the load-bearing outcome.
  function pushPart(key: string, verb: string, body: React.ReactNode): void {
    const isFirst = nonMemParts.length === 0;
    if (!isFirst) nonMemParts.push(<Text key={`comma-${key}`}>, </Text>);
    nonMemParts.push(<Text key={key}>
        {isFirst ? verb[0]!.toUpperCase() + verb.slice(1) : verb} {body}
      </Text>);
  }
  if (isFullscreenEnvEnabled() && message.commits?.length) {
    const byKind = {
      committed: 'committed',
      amended: 'amended commit',
      'cherry-picked': 'cherry-picked'
    };
    for (const kind of ['committed', 'amended', 'cherry-picked'] as const) {
      const shas = message.commits.filter(c => c.kind === kind).map(c_0 => c_0.sha);
      if (shas.length) {
        pushPart(kind, byKind[kind], <Text bold>{shas.join(', ')}</Text>);
      }
    }
  }
  if (isFullscreenEnvEnabled() && message.pushes?.length) {
    const branches = uniq(message.pushes.map(p => p.branch));
    pushPart('push', 'pushed to', <Text bold>{branches.join(', ')}</Text>);
  }
  if (isFullscreenEnvEnabled() && message.branches?.length) {
    const byAction = {
      merged: 'merged',
      rebased: 'rebased onto'
    };
    for (const b of message.branches) {
      pushPart(`br-${b.action}-${b.ref}`, byAction[b.action], <Text bold>{b.ref}</Text>);
    }
  }
  if (isFullscreenEnvEnabled() && message.prs?.length) {
    const verbs = {
      created: 'created',
      edited: 'edited',
      merged: 'merged',
      commented: 'commented on',
      closed: 'closed',
      ready: 'marked ready'
    };
    for (const pr of message.prs) {
      pushPart(`pr-${pr.action}-${pr.number}`, verbs[pr.action], pr.url ? <PrBadge number={pr.number} url={pr.url} bold /> : <Text bold>PR #{pr.number}</Text>);
    }
  }
  if (searchCount > 0) {
    const isFirst_0 = nonMemParts.length === 0;
    const searchVerb = isActiveGroup ? isFirst_0 ? 'Searching for' : 'searching for' : isFirst_0 ? 'Searched for' : 'searched for';
    if (!isFirst_0) {
      nonMemParts.push(<Text key="comma-s">, </Text>);
    }
    nonMemParts.push(<Text key="search">
        {searchVerb} <Text bold>{searchCount}</Text>{' '}
        {searchCount === 1 ? 'pattern' : 'patterns'}
      </Text>);
  }
  if (readCount > 0) {
    const isFirst_1 = nonMemParts.length === 0;
    const readVerb = isActiveGroup ? isFirst_1 ? 'Reading' : 'reading' : isFirst_1 ? 'Read' : 'read';
    if (!isFirst_1) {
      nonMemParts.push(<Text key="comma-r">, </Text>);
    }
    nonMemParts.push(<Text key="read">
        {readVerb} <Text bold>{readCount}</Text>{' '}
        {readCount === 1 ? 'file' : 'files'}
      </Text>);
  }
  if (listCount > 0) {
    const isFirst_2 = nonMemParts.length === 0;
    const listVerb = isActiveGroup ? isFirst_2 ? 'Listing' : 'listing' : isFirst_2 ? 'Listed' : 'listed';
    if (!isFirst_2) {
      nonMemParts.push(<Text key="comma-l">, </Text>);
    }
    nonMemParts.push(<Text key="list">
        {listVerb} <Text bold>{listCount}</Text>{' '}
        {listCount === 1 ? 'directory' : 'directories'}
      </Text>);
  }
  if (replCount > 0) {
    const replVerb = isActiveGroup ? "REPL'ing" : "REPL'd";
    if (nonMemParts.length > 0) {
      nonMemParts.push(<Text key="comma-repl">, </Text>);
    }
    nonMemParts.push(<Text key="repl">
        {replVerb} <Text bold>{replCount}</Text>{' '}
        {replCount === 1 ? 'time' : 'times'}
      </Text>);
  }
  if (mcpCallCount > 0) {
    const serverLabel = message.mcpServerNames?.map(n => n.replace(/^claude\.ai /, '')).join(', ') || 'MCP';
    const isFirst_3 = nonMemParts.length === 0;
    const verb_0 = isActiveGroup ? isFirst_3 ? 'Querying' : 'querying' : isFirst_3 ? 'Queried' : 'queried';
    if (!isFirst_3) {
      nonMemParts.push(<Text key="comma-mcp">, </Text>);
    }
    nonMemParts.push(<Text key="mcp">
        {verb_0} {serverLabel}
        {mcpCallCount > 1 && <>
            {' '}
            <Text bold>{mcpCallCount}</Text> times
          </>}
      </Text>);
  }
  if (isFullscreenEnvEnabled() && bashCount > 0) {
    const isFirst_4 = nonMemParts.length === 0;
    const verb_1 = isActiveGroup ? isFirst_4 ? 'Running' : 'running' : isFirst_4 ? 'Ran' : 'ran';
    if (!isFirst_4) {
      nonMemParts.push(<Text key="comma-bash">, </Text>);
    }
    nonMemParts.push(<Text key="bash">
        {verb_1} <Text bold>{bashCount}</Text> bash{' '}
        {bashCount === 1 ? 'command' : 'commands'}
      </Text>);
  }

  // Build memory parts (auto-memory) — rendered after nonMemParts
  const hasPrecedingNonMem = nonMemParts.length > 0;
  const memParts: React.ReactNode[] = [];
  if (memoryReadCount > 0) {
    const isFirst_5 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_2 = isActiveGroup ? isFirst_5 ? 'Recalling' : 'recalling' : isFirst_5 ? 'Recalled' : 'recalled';
    if (!isFirst_5) {
      memParts.push(<Text key="comma-mr">, </Text>);
    }
    memParts.push(<Text key="mem-read">
        {verb_2} <Text bold>{memoryReadCount}</Text>{' '}
        {memoryReadCount === 1 ? 'memory' : 'memories'}
      </Text>);
  }
  if (memorySearchCount > 0) {
    const isFirst_6 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_3 = isActiveGroup ? isFirst_6 ? 'Searching' : 'searching' : isFirst_6 ? 'Searched' : 'searched';
    if (!isFirst_6) {
      memParts.push(<Text key="comma-ms">, </Text>);
    }
    memParts.push(<Text key="mem-search">{`${verb_3} memories`}</Text>);
  }
  if (memoryWriteCount > 0) {
    const isFirst_7 = !hasPrecedingNonMem && memParts.length === 0;
    const verb_4 = isActiveGroup ? isFirst_7 ? 'Writing' : 'writing' : isFirst_7 ? 'Wrote' : 'wrote';
    if (!isFirst_7) {
      memParts.push(<Text key="comma-mw">, </Text>);
    }
    memParts.push(<Text key="mem-write">
        {verb_4} <Text bold>{memoryWriteCount}</Text>{' '}
        {memoryWriteCount === 1 ? 'memory' : 'memories'}
      </Text>);
  }
  return <Box flexDirection="column" marginTop={1} backgroundColor={bg}>
      <Box flexDirection="row">
        {isActiveGroup ? <ToolUseLoader shouldAnimate isUnresolved isError={anyError} /> : <Box minWidth={2} />}
        <Text dimColor={!isActiveGroup}>
          {nonMemParts}
          {memParts}
          {feature('TEAMMEM') ? teamMemCollapsed!.TeamMemCountParts({
          message,
          isActiveGroup,
          hasPrecedingParts: hasPrecedingNonMem || memParts.length > 0
        }) : null}
          {isActiveGroup && <Text key="ellipsis">…</Text>} <CtrlOToExpand />
        </Text>
      </Box>
      {isActiveGroup && displayedHint !== undefined &&
    // Row layout: 5-wide gutter for ⎿, then a flex column for the text.
    // Ink's wrap stays inside the right column so continuation lines
    // indent under ⎿. MAX_HINT_CHARS in commandAsHint caps total at ~5 lines.
    <Box flexDirection="row">
          <Box width={5} flexShrink={0}>
            <Text dimColor>{'  ⎿  '}</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            {displayedHint.split('\n').map((line, i, arr) => <Text key={`hint-${i}`} dimColor>
                {line}
                {i === arr.length - 1 && shellProgressSuffix}
              </Text>)}
          </Box>
        </Box>}
      {message.hookTotalMs !== undefined && message.hookTotalMs > 0 && <Text dimColor>
          {'  ⎿  '}Ran {message.hookCount} PreToolUse{' '}
          {message.hookCount === 1 ? 'hook' : 'hooks'} (
          {formatSecondsShort(message.hookTotalMs)})
        </Text>}
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiYmFzZW5hbWUiLCJSZWFjdCIsInVzZVJlZiIsInVzZU1pbkRpc3BsYXlUaW1lIiwiQW5zaSIsIkJveCIsIlRleHQiLCJ1c2VUaGVtZSIsImZpbmRUb29sQnlOYW1lIiwiVG9vbHMiLCJnZXRSZXBsUHJpbWl0aXZlVG9vbHMiLCJDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXAiLCJOb3JtYWxpemVkQXNzaXN0YW50TWVzc2FnZSIsInVuaXEiLCJnZXRUb29sVXNlSWRzRnJvbUNvbGxhcHNlZEdyb3VwIiwiZ2V0RGlzcGxheVBhdGgiLCJmb3JtYXREdXJhdGlvbiIsImZvcm1hdFNlY29uZHNTaG9ydCIsImlzRnVsbHNjcmVlbkVudkVuYWJsZWQiLCJidWlsZE1lc3NhZ2VMb29rdXBzIiwiVGhlbWVOYW1lIiwiQ3RybE9Ub0V4cGFuZCIsInVzZVNlbGVjdGVkTWVzc2FnZUJnIiwiUHJCYWRnZSIsIlRvb2xVc2VMb2FkZXIiLCJ0ZWFtTWVtQ29sbGFwc2VkIiwicmVxdWlyZSIsIk1JTl9ISU5UX0RJU1BMQVlfTVMiLCJQcm9wcyIsIm1lc3NhZ2UiLCJpblByb2dyZXNzVG9vbFVzZUlEcyIsIlNldCIsInNob3VsZEFuaW1hdGUiLCJ2ZXJib3NlIiwidG9vbHMiLCJsb29rdXBzIiwiUmV0dXJuVHlwZSIsImlzQWN0aXZlR3JvdXAiLCJWZXJib3NlVG9vbFVzZSIsInQwIiwiJCIsIl9jIiwiY29udGVudCIsInRoZW1lIiwiYmciLCJ0MSIsInQyIiwiaWQiLCJpbnB1dCIsIm5hbWUiLCJTeW1ib2wiLCJmb3IiLCJiYjAiLCJ0b29sIiwidDMiLCJyZXNvbHZlZFRvb2xVc2VJRHMiLCJoYXMiLCJpc1Jlc29sdmVkIiwidDQiLCJlcnJvcmVkVG9vbFVzZUlEcyIsImlzRXJyb3IiLCJ0NSIsImlzSW5Qcm9ncmVzcyIsInJlc3VsdE1zZyIsInRvb2xSZXN1bHRCeVRvb2xVc2VJRCIsImdldCIsInJhd1Rvb2xSZXN1bHQiLCJ0eXBlIiwidG9vbFVzZVJlc3VsdCIsInVuZGVmaW5lZCIsInBhcnNlZE91dHB1dCIsIm91dHB1dFNjaGVtYSIsInNhZmVQYXJzZSIsInRvb2xSZXN1bHQiLCJzdWNjZXNzIiwiZGF0YSIsInBhcnNlZElucHV0IiwiaW5wdXRTY2hlbWEiLCJ1c2VyRmFjaW5nTmFtZSIsInRvb2xVc2VNZXNzYWdlIiwicmVuZGVyVG9vbFVzZU1lc3NhZ2UiLCJ0NiIsInQ3IiwidDgiLCJyZW5kZXJUb29sVXNlVGFnIiwicmVuZGVyVG9vbFJlc3VsdE1lc3NhZ2UiLCJDb2xsYXBzZWRSZWFkU2VhcmNoQ29udGVudCIsIlJlYWN0Tm9kZSIsInNlYXJjaENvdW50IiwicmF3U2VhcmNoQ291bnQiLCJyZWFkQ291bnQiLCJyYXdSZWFkQ291bnQiLCJsaXN0Q291bnQiLCJyYXdMaXN0Q291bnQiLCJyZXBsQ291bnQiLCJtZW1vcnlTZWFyY2hDb3VudCIsIm1lbW9yeVJlYWRDb3VudCIsIm1lbW9yeVdyaXRlQ291bnQiLCJtZXNzYWdlcyIsImdyb3VwTWVzc2FnZXMiLCJ0b29sVXNlSWRzIiwiYW55RXJyb3IiLCJzb21lIiwiaGFzTWVtb3J5T3BzIiwiaGFzVGVhbU1lbW9yeU9wcyIsImNoZWNrSGFzVGVhbU1lbU9wcyIsIm1heFJlYWRDb3VudFJlZiIsIm1heFNlYXJjaENvdW50UmVmIiwibWF4TGlzdENvdW50UmVmIiwibWF4TWNwQ291bnRSZWYiLCJtYXhCYXNoQ291bnRSZWYiLCJjdXJyZW50IiwiTWF0aCIsIm1heCIsIm1jcENhbGxDb3VudCIsImJhc2hDb3VudCIsImdpdE9wQmFzaENvdW50IiwiaGFzTm9uTWVtb3J5T3BzIiwicmVhZFBhdGhzIiwicmVhZEZpbGVQYXRocyIsInNlYXJjaEFyZ3MiLCJpbmNvbWluZ0hpbnQiLCJsYXRlc3REaXNwbGF5SGludCIsImxhc3RTZWFyY2hSYXciLCJhdCIsImxhc3RTZWFyY2giLCJsYXN0UmVhZCIsImxhdGVzdCIsInByb2dyZXNzTWVzc2FnZXNCeVRvb2xVc2VJRCIsInBoYXNlIiwidG9vbElucHV0IiwiY29tbWFuZCIsInBhdHRlcm4iLCJmaWxlX3BhdGgiLCJ0b29sTmFtZSIsImRpc3BsYXllZEhpbnQiLCJ0b29sVXNlcyIsIm1zZyIsInB1c2giLCJtYXAiLCJob29rSW5mb3MiLCJsZW5ndGgiLCJob29rQ291bnQiLCJob29rVG90YWxNcyIsImluZm8iLCJpZHgiLCJkdXJhdGlvbk1zIiwicmVsZXZhbnRNZW1vcmllcyIsIm0iLCJwYXRoIiwic2hlbGxQcm9ncmVzc1N1ZmZpeCIsImVsYXBzZWQiLCJsaW5lcyIsImVsYXBzZWRUaW1lU2Vjb25kcyIsInRvdGFsTGluZXMiLCJ0aW1lIiwibm9uTWVtUGFydHMiLCJwdXNoUGFydCIsImtleSIsInZlcmIiLCJib2R5IiwiaXNGaXJzdCIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJjb21taXRzIiwiYnlLaW5kIiwiY29tbWl0dGVkIiwiYW1lbmRlZCIsImtpbmQiLCJjb25zdCIsInNoYXMiLCJmaWx0ZXIiLCJjIiwic2hhIiwiam9pbiIsInB1c2hlcyIsImJyYW5jaGVzIiwicCIsImJyYW5jaCIsImJ5QWN0aW9uIiwibWVyZ2VkIiwicmViYXNlZCIsImIiLCJhY3Rpb24iLCJyZWYiLCJwcnMiLCJ2ZXJicyIsImNyZWF0ZWQiLCJlZGl0ZWQiLCJjb21tZW50ZWQiLCJjbG9zZWQiLCJyZWFkeSIsInByIiwibnVtYmVyIiwidXJsIiwic2VhcmNoVmVyYiIsInJlYWRWZXJiIiwibGlzdFZlcmIiLCJyZXBsVmVyYiIsInNlcnZlckxhYmVsIiwibWNwU2VydmVyTmFtZXMiLCJuIiwicmVwbGFjZSIsImhhc1ByZWNlZGluZ05vbk1lbSIsIm1lbVBhcnRzIiwiVGVhbU1lbUNvdW50UGFydHMiLCJoYXNQcmVjZWRpbmdQYXJ0cyIsInNwbGl0IiwibGluZSIsImkiLCJhcnIiXSwic291cmNlcyI6WyJDb2xsYXBzZWRSZWFkU2VhcmNoQ29udGVudC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZmVhdHVyZSB9IGZyb20gJ2J1bjpidW5kbGUnXG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgUmVhY3QsIHsgdXNlUmVmIH0gZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VNaW5EaXNwbGF5VGltZSB9IGZyb20gJy4uLy4uL2hvb2tzL3VzZU1pbkRpc3BsYXlUaW1lLmpzJ1xuaW1wb3J0IHsgQW5zaSwgQm94LCBUZXh0LCB1c2VUaGVtZSB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB7IGZpbmRUb29sQnlOYW1lLCB0eXBlIFRvb2xzIH0gZnJvbSAnLi4vLi4vVG9vbC5qcydcbmltcG9ydCB7IGdldFJlcGxQcmltaXRpdmVUb29scyB9IGZyb20gJy4uLy4uL3Rvb2xzL1JFUExUb29sL3ByaW1pdGl2ZVRvb2xzLmpzJ1xuaW1wb3J0IHR5cGUge1xuICBDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXAsXG4gIE5vcm1hbGl6ZWRBc3Npc3RhbnRNZXNzYWdlLFxufSBmcm9tICcuLi8uLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHsgdW5pcSB9IGZyb20gJy4uLy4uL3V0aWxzL2FycmF5LmpzJ1xuaW1wb3J0IHsgZ2V0VG9vbFVzZUlkc0Zyb21Db2xsYXBzZWRHcm91cCB9IGZyb20gJy4uLy4uL3V0aWxzL2NvbGxhcHNlUmVhZFNlYXJjaC5qcydcbmltcG9ydCB7IGdldERpc3BsYXlQYXRoIH0gZnJvbSAnLi4vLi4vdXRpbHMvZmlsZS5qcydcbmltcG9ydCB7IGZvcm1hdER1cmF0aW9uLCBmb3JtYXRTZWNvbmRzU2hvcnQgfSBmcm9tICcuLi8uLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgeyBpc0Z1bGxzY3JlZW5FbnZFbmFibGVkIH0gZnJvbSAnLi4vLi4vdXRpbHMvZnVsbHNjcmVlbi5qcydcbmltcG9ydCB0eXBlIHsgYnVpbGRNZXNzYWdlTG9va3VwcyB9IGZyb20gJy4uLy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGVtZU5hbWUgfSBmcm9tICcuLi8uLi91dGlscy90aGVtZS5qcydcbmltcG9ydCB7IEN0cmxPVG9FeHBhbmQgfSBmcm9tICcuLi9DdHJsT1RvRXhwYW5kLmpzJ1xuaW1wb3J0IHsgdXNlU2VsZWN0ZWRNZXNzYWdlQmcgfSBmcm9tICcuLi9tZXNzYWdlQWN0aW9ucy5qcydcbmltcG9ydCB7IFByQmFkZ2UgfSBmcm9tICcuLi9QckJhZGdlLmpzJ1xuaW1wb3J0IHsgVG9vbFVzZUxvYWRlciB9IGZyb20gJy4uL1Rvb2xVc2VMb2FkZXIuanMnXG5cbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbmNvbnN0IHRlYW1NZW1Db2xsYXBzZWQgPSBmZWF0dXJlKCdURUFNTUVNJylcbiAgPyAocmVxdWlyZSgnLi90ZWFtTWVtQ29sbGFwc2VkLmpzJykgYXMgdHlwZW9mIGltcG9ydCgnLi90ZWFtTWVtQ29sbGFwc2VkLmpzJykpXG4gIDogbnVsbFxuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG5cbi8vIEhvbGQgZWFjaCDipL8gaGludCBmb3IgYSBtaW5pbXVtIGR1cmF0aW9uIHNvIGZhc3QtY29tcGxldGluZyB0b29sIGNhbGxzXG4vLyAoYmFzaCBjb21tYW5kcywgZmlsZSByZWFkcywgc2VhcmNoIHBhdHRlcm5zKSBhcmUgYWN0dWFsbHkgcmVhZGFibGUgaW5zdGVhZFxuLy8gb2YgZmxpY2tlcmluZyBwYXN0IGluIGEgc2luZ2xlIGZyYW1lLlxuY29uc3QgTUlOX0hJTlRfRElTUExBWV9NUyA9IDcwMFxuXG50eXBlIFByb3BzID0ge1xuICBtZXNzYWdlOiBDb2xsYXBzZWRSZWFkU2VhcmNoR3JvdXBcbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHNob3VsZEFuaW1hdGU6IGJvb2xlYW5cbiAgdmVyYm9zZTogYm9vbGVhblxuICB0b29sczogVG9vbHNcbiAgbG9va3VwczogUmV0dXJuVHlwZTx0eXBlb2YgYnVpbGRNZXNzYWdlTG9va3Vwcz5cbiAgLyoqIFRydWUgaWYgdGhpcyBpcyB0aGUgY3VycmVudGx5IGFjdGl2ZSBjb2xsYXBzZWQgZ3JvdXAgKGxhc3Qgb25lLCBzdGlsbCBsb2FkaW5nKSAqL1xuICBpc0FjdGl2ZUdyb3VwPzogYm9vbGVhblxufVxuXG4vKiogUmVuZGVyIGEgc2luZ2xlIHRvb2wgdXNlIGluIHZlcmJvc2UgbW9kZSAqL1xuZnVuY3Rpb24gVmVyYm9zZVRvb2xVc2Uoe1xuICBjb250ZW50LFxuICB0b29scyxcbiAgbG9va3VwcyxcbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHMsXG4gIHNob3VsZEFuaW1hdGUsXG4gIHRoZW1lLFxufToge1xuICBjb250ZW50OiB7IHR5cGU6ICd0b29sX3VzZSc7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZzsgaW5wdXQ6IHVua25vd24gfVxuICB0b29sczogVG9vbHNcbiAgbG9va3VwczogUmV0dXJuVHlwZTx0eXBlb2YgYnVpbGRNZXNzYWdlTG9va3Vwcz5cbiAgaW5Qcm9ncmVzc1Rvb2xVc2VJRHM6IFNldDxzdHJpbmc+XG4gIHNob3VsZEFuaW1hdGU6IGJvb2xlYW5cbiAgdGhlbWU6IFRoZW1lTmFtZVxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGJnID0gdXNlU2VsZWN0ZWRNZXNzYWdlQmcoKVxuICAvLyBTYW1lIFJFUEwtcHJpbWl0aXZlIGZhbGxiYWNrIGFzIGdldFRvb2xTZWFyY2hPclJlYWRJbmZvIOKAlCBSRVBMIG1vZGUgc3RyaXBzXG4gIC8vIHRoZXNlIGZyb20gdGhlIGV4ZWN1dGlvbiB0b29scyBsaXN0LCBidXQgdmlydHVhbCBtZXNzYWdlcyBzdGlsbCBuZWVkIHRoZW1cbiAgLy8gdG8gcmVuZGVyIGluIHZlcmJvc2UgbW9kZS5cbiAgY29uc3QgdG9vbCA9XG4gICAgZmluZFRvb2xCeU5hbWUodG9vbHMsIGNvbnRlbnQubmFtZSkgPz9cbiAgICBmaW5kVG9vbEJ5TmFtZShnZXRSZXBsUHJpbWl0aXZlVG9vbHMoKSwgY29udGVudC5uYW1lKVxuICBpZiAoIXRvb2wpIHJldHVybiBudWxsXG5cbiAgY29uc3QgaXNSZXNvbHZlZCA9IGxvb2t1cHMucmVzb2x2ZWRUb29sVXNlSURzLmhhcyhjb250ZW50LmlkKVxuICBjb25zdCBpc0Vycm9yID0gbG9va3Vwcy5lcnJvcmVkVG9vbFVzZUlEcy5oYXMoY29udGVudC5pZClcbiAgY29uc3QgaXNJblByb2dyZXNzID0gaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuaGFzKGNvbnRlbnQuaWQpXG5cbiAgY29uc3QgcmVzdWx0TXNnID0gbG9va3Vwcy50b29sUmVzdWx0QnlUb29sVXNlSUQuZ2V0KGNvbnRlbnQuaWQpXG4gIGNvbnN0IHJhd1Rvb2xSZXN1bHQgPVxuICAgIHJlc3VsdE1zZz8udHlwZSA9PT0gJ3VzZXInID8gcmVzdWx0TXNnLnRvb2xVc2VSZXN1bHQgOiB1bmRlZmluZWRcbiAgY29uc3QgcGFyc2VkT3V0cHV0ID0gdG9vbC5vdXRwdXRTY2hlbWE/LnNhZmVQYXJzZShyYXdUb29sUmVzdWx0KVxuICBjb25zdCB0b29sUmVzdWx0ID0gcGFyc2VkT3V0cHV0Py5zdWNjZXNzID8gcGFyc2VkT3V0cHV0LmRhdGEgOiB1bmRlZmluZWRcblxuICBjb25zdCBwYXJzZWRJbnB1dCA9IHRvb2wuaW5wdXRTY2hlbWEuc2FmZVBhcnNlKGNvbnRlbnQuaW5wdXQpXG4gIGNvbnN0IGlucHV0ID0gcGFyc2VkSW5wdXQuc3VjY2VzcyA/IHBhcnNlZElucHV0LmRhdGEgOiB1bmRlZmluZWRcbiAgY29uc3QgdXNlckZhY2luZ05hbWUgPSB0b29sLnVzZXJGYWNpbmdOYW1lKGlucHV0KVxuICBjb25zdCB0b29sVXNlTWVzc2FnZSA9IGlucHV0XG4gICAgPyB0b29sLnJlbmRlclRvb2xVc2VNZXNzYWdlKGlucHV0LCB7IHRoZW1lLCB2ZXJib3NlOiB0cnVlIH0pXG4gICAgOiBudWxsXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94XG4gICAgICBrZXk9e2NvbnRlbnQuaWR9XG4gICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgIG1hcmdpblRvcD17MX1cbiAgICAgIGJhY2tncm91bmRDb2xvcj17Ymd9XG4gICAgPlxuICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCI+XG4gICAgICAgIDxUb29sVXNlTG9hZGVyXG4gICAgICAgICAgc2hvdWxkQW5pbWF0ZT17c2hvdWxkQW5pbWF0ZSAmJiBpc0luUHJvZ3Jlc3N9XG4gICAgICAgICAgaXNVbnJlc29sdmVkPXshaXNSZXNvbHZlZH1cbiAgICAgICAgICBpc0Vycm9yPXtpc0Vycm9yfVxuICAgICAgICAvPlxuICAgICAgICA8VGV4dD5cbiAgICAgICAgICA8VGV4dCBib2xkPnt1c2VyRmFjaW5nTmFtZX08L1RleHQ+XG4gICAgICAgICAge3Rvb2xVc2VNZXNzYWdlICYmIDxUZXh0Pih7dG9vbFVzZU1lc3NhZ2V9KTwvVGV4dD59XG4gICAgICAgIDwvVGV4dD5cbiAgICAgICAge2lucHV0ICYmIHRvb2wucmVuZGVyVG9vbFVzZVRhZz8uKGlucHV0KX1cbiAgICAgIDwvQm94PlxuICAgICAge2lzUmVzb2x2ZWQgJiYgIWlzRXJyb3IgJiYgdG9vbFJlc3VsdCAhPT0gdW5kZWZpbmVkICYmIChcbiAgICAgICAgPEJveD5cbiAgICAgICAgICB7dG9vbC5yZW5kZXJUb29sUmVzdWx0TWVzc2FnZT8uKHRvb2xSZXN1bHQsIFtdLCB7XG4gICAgICAgICAgICB2ZXJib3NlOiB0cnVlLFxuICAgICAgICAgICAgdG9vbHMsXG4gICAgICAgICAgICB0aGVtZSxcbiAgICAgICAgICB9KX1cbiAgICAgICAgPC9Cb3g+XG4gICAgICApfVxuICAgIDwvQm94PlxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb2xsYXBzZWRSZWFkU2VhcmNoQ29udGVudCh7XG4gIG1lc3NhZ2UsXG4gIGluUHJvZ3Jlc3NUb29sVXNlSURzLFxuICBzaG91bGRBbmltYXRlLFxuICB2ZXJib3NlLFxuICB0b29scyxcbiAgbG9va3VwcyxcbiAgaXNBY3RpdmVHcm91cCxcbn06IFByb3BzKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgYmcgPSB1c2VTZWxlY3RlZE1lc3NhZ2VCZygpXG4gIGNvbnN0IHtcbiAgICBzZWFyY2hDb3VudDogcmF3U2VhcmNoQ291bnQsXG4gICAgcmVhZENvdW50OiByYXdSZWFkQ291bnQsXG4gICAgbGlzdENvdW50OiByYXdMaXN0Q291bnQsXG4gICAgcmVwbENvdW50LFxuICAgIG1lbW9yeVNlYXJjaENvdW50LFxuICAgIG1lbW9yeVJlYWRDb3VudCxcbiAgICBtZW1vcnlXcml0ZUNvdW50LFxuICAgIG1lc3NhZ2VzOiBncm91cE1lc3NhZ2VzLFxuICB9ID0gbWVzc2FnZVxuICBjb25zdCBbdGhlbWVdID0gdXNlVGhlbWUoKVxuICBjb25zdCB0b29sVXNlSWRzID0gZ2V0VG9vbFVzZUlkc0Zyb21Db2xsYXBzZWRHcm91cChtZXNzYWdlKVxuICBjb25zdCBhbnlFcnJvciA9IHRvb2xVc2VJZHMuc29tZShpZCA9PiBsb29rdXBzLmVycm9yZWRUb29sVXNlSURzLmhhcyhpZCkpXG4gIGNvbnN0IGhhc01lbW9yeU9wcyA9XG4gICAgbWVtb3J5U2VhcmNoQ291bnQgPiAwIHx8IG1lbW9yeVJlYWRDb3VudCA+IDAgfHwgbWVtb3J5V3JpdGVDb3VudCA+IDBcbiAgY29uc3QgaGFzVGVhbU1lbW9yeU9wcyA9IGZlYXR1cmUoJ1RFQU1NRU0nKVxuICAgID8gdGVhbU1lbUNvbGxhcHNlZCEuY2hlY2tIYXNUZWFtTWVtT3BzKG1lc3NhZ2UpXG4gICAgOiBmYWxzZVxuXG4gIC8vIFRyYWNrIHRoZSBtYXggc2VlbiBjb3VudHMgc28gdGhleSBvbmx5IGV2ZXIgaW5jcmVhc2UuIFRoZSBkZWJvdW5jZSB0aW1lclxuICAvLyBjYXVzZXMgZXh0cmEgcmUtcmVuZGVycyBhdCBhcmJpdHJhcnkgdGltZXM7IGR1cmluZyBhIGJyaWVmIFwiaW52aXNpYmxlIHdpbmRvd1wiXG4gIC8vIGluIHRoZSBzdHJlYW1pbmcgZXhlY3V0b3IgdGhlIGdyb3VwIGNvdW50IGNhbiBkaXAsIHdoaWNoIGNhdXNlcyBqaXR0ZXIuXG4gIGNvbnN0IG1heFJlYWRDb3VudFJlZiA9IHVzZVJlZigwKVxuICBjb25zdCBtYXhTZWFyY2hDb3VudFJlZiA9IHVzZVJlZigwKVxuICBjb25zdCBtYXhMaXN0Q291bnRSZWYgPSB1c2VSZWYoMClcbiAgY29uc3QgbWF4TWNwQ291bnRSZWYgPSB1c2VSZWYoMClcbiAgY29uc3QgbWF4QmFzaENvdW50UmVmID0gdXNlUmVmKDApXG4gIG1heFJlYWRDb3VudFJlZi5jdXJyZW50ID0gTWF0aC5tYXgobWF4UmVhZENvdW50UmVmLmN1cnJlbnQsIHJhd1JlYWRDb3VudClcbiAgbWF4U2VhcmNoQ291bnRSZWYuY3VycmVudCA9IE1hdGgubWF4KFxuICAgIG1heFNlYXJjaENvdW50UmVmLmN1cnJlbnQsXG4gICAgcmF3U2VhcmNoQ291bnQsXG4gIClcbiAgbWF4TGlzdENvdW50UmVmLmN1cnJlbnQgPSBNYXRoLm1heChtYXhMaXN0Q291bnRSZWYuY3VycmVudCwgcmF3TGlzdENvdW50KVxuICBtYXhNY3BDb3VudFJlZi5jdXJyZW50ID0gTWF0aC5tYXgoXG4gICAgbWF4TWNwQ291bnRSZWYuY3VycmVudCxcbiAgICBtZXNzYWdlLm1jcENhbGxDb3VudCA/PyAwLFxuICApXG4gIG1heEJhc2hDb3VudFJlZi5jdXJyZW50ID0gTWF0aC5tYXgoXG4gICAgbWF4QmFzaENvdW50UmVmLmN1cnJlbnQsXG4gICAgbWVzc2FnZS5iYXNoQ291bnQgPz8gMCxcbiAgKVxuICBjb25zdCByZWFkQ291bnQgPSBtYXhSZWFkQ291bnRSZWYuY3VycmVudFxuICBjb25zdCBzZWFyY2hDb3VudCA9IG1heFNlYXJjaENvdW50UmVmLmN1cnJlbnRcbiAgY29uc3QgbGlzdENvdW50ID0gbWF4TGlzdENvdW50UmVmLmN1cnJlbnRcbiAgY29uc3QgbWNwQ2FsbENvdW50ID0gbWF4TWNwQ291bnRSZWYuY3VycmVudFxuICAvLyBTdWJ0cmFjdCBjb21tYW5kcyBzdXJmYWNlZCBhcyBcIkNvbW1pdHRlZCDigKZcIiAvIFwiQ3JlYXRlZCBQUiDigKZcIiBzbyB0aGVcbiAgLy8gc2FtZSBjb21tYW5kIGlzbid0IGNvdW50ZWQgdHdpY2UuIGdpdE9wQmFzaENvdW50IGlzIHJlYWQgbGl2ZSAobm8gbWF4LXJlZlxuICAvLyBuZWVkZWQg4oCUIGl0J3MgMCB1bnRpbCByZXN1bHRzIGFycml2ZSwgdGhlbiBvbmx5IGdyb3dzKS5cbiAgY29uc3QgZ2l0T3BCYXNoQ291bnQgPSBtZXNzYWdlLmdpdE9wQmFzaENvdW50ID8/IDBcbiAgY29uc3QgYmFzaENvdW50ID0gaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpXG4gICAgPyBNYXRoLm1heCgwLCBtYXhCYXNoQ291bnRSZWYuY3VycmVudCAtIGdpdE9wQmFzaENvdW50KVxuICAgIDogMFxuXG4gIGNvbnN0IGhhc05vbk1lbW9yeU9wcyA9XG4gICAgc2VhcmNoQ291bnQgPiAwIHx8XG4gICAgcmVhZENvdW50ID4gMCB8fFxuICAgIGxpc3RDb3VudCA+IDAgfHxcbiAgICByZXBsQ291bnQgPiAwIHx8XG4gICAgbWNwQ2FsbENvdW50ID4gMCB8fFxuICAgIGJhc2hDb3VudCA+IDAgfHxcbiAgICBnaXRPcEJhc2hDb3VudCA+IDBcblxuICBjb25zdCByZWFkUGF0aHMgPSBtZXNzYWdlLnJlYWRGaWxlUGF0aHNcbiAgY29uc3Qgc2VhcmNoQXJncyA9IG1lc3NhZ2Uuc2VhcmNoQXJnc1xuICBsZXQgaW5jb21pbmdIaW50ID0gbWVzc2FnZS5sYXRlc3REaXNwbGF5SGludFxuICBpZiAoaW5jb21pbmdIaW50ID09PSB1bmRlZmluZWQpIHtcbiAgICBjb25zdCBsYXN0U2VhcmNoUmF3ID0gc2VhcmNoQXJncz8uYXQoLTEpXG4gICAgY29uc3QgbGFzdFNlYXJjaCA9XG4gICAgICBsYXN0U2VhcmNoUmF3ICE9PSB1bmRlZmluZWQgPyBgXCIke2xhc3RTZWFyY2hSYXd9XCJgIDogdW5kZWZpbmVkXG4gICAgY29uc3QgbGFzdFJlYWQgPSByZWFkUGF0aHM/LmF0KC0xKVxuICAgIGluY29taW5nSGludCA9XG4gICAgICBsYXN0UmVhZCAhPT0gdW5kZWZpbmVkID8gZ2V0RGlzcGxheVBhdGgobGFzdFJlYWQpIDogbGFzdFNlYXJjaFxuICB9XG5cbiAgLy8gQWN0aXZlIFJFUEwgY2FsbHMgZW1pdCByZXBsX3Rvb2xfY2FsbCBwcm9ncmVzcyB3aXRoIHRoZSBjdXJyZW50IGlubmVyXG4gIC8vIHRvb2wncyBuYW1lK2lucHV0LiBWaXJ0dWFsIG1lc3NhZ2VzIGRvbid0IGFycml2ZSB1bnRpbCBSRVBMIGNvbXBsZXRlcyxcbiAgLy8gc28gdGhpcyBpcyB0aGUgb25seSBzb3VyY2Ugb2YgYSBsaXZlIGhpbnQgZHVyaW5nIGV4ZWN1dGlvbi5cbiAgaWYgKGlzQWN0aXZlR3JvdXApIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRvb2xVc2VJZHMpIHtcbiAgICAgIGlmICghaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuaGFzKGlkKSkgY29udGludWVcbiAgICAgIGNvbnN0IGxhdGVzdCA9IGxvb2t1cHMucHJvZ3Jlc3NNZXNzYWdlc0J5VG9vbFVzZUlELmdldChpZCk/LmF0KC0xKT8uZGF0YVxuICAgICAgaWYgKGxhdGVzdD8udHlwZSA9PT0gJ3JlcGxfdG9vbF9jYWxsJyAmJiBsYXRlc3QucGhhc2UgPT09ICdzdGFydCcpIHtcbiAgICAgICAgY29uc3QgaW5wdXQgPSBsYXRlc3QudG9vbElucHV0IGFzIHtcbiAgICAgICAgICBjb21tYW5kPzogc3RyaW5nXG4gICAgICAgICAgcGF0dGVybj86IHN0cmluZ1xuICAgICAgICAgIGZpbGVfcGF0aD86IHN0cmluZ1xuICAgICAgICB9XG4gICAgICAgIGluY29taW5nSGludCA9XG4gICAgICAgICAgaW5wdXQuZmlsZV9wYXRoID8/XG4gICAgICAgICAgKGlucHV0LnBhdHRlcm4gPyBgXCIke2lucHV0LnBhdHRlcm59XCJgIDogdW5kZWZpbmVkKSA/P1xuICAgICAgICAgIGlucHV0LmNvbW1hbmQgPz9cbiAgICAgICAgICBsYXRlc3QudG9vbE5hbWVcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBkaXNwbGF5ZWRIaW50ID0gdXNlTWluRGlzcGxheVRpbWUoaW5jb21pbmdIaW50LCBNSU5fSElOVF9ESVNQTEFZX01TKVxuXG4gIC8vIEluIHZlcmJvc2UgbW9kZSwgcmVuZGVyIGVhY2ggdG9vbCB1c2Ugd2l0aCBpdHMgMS1saW5lIHJlc3VsdCBzdW1tYXJ5XG4gIGlmICh2ZXJib3NlKSB7XG4gICAgY29uc3QgdG9vbFVzZXM6IE5vcm1hbGl6ZWRBc3Npc3RhbnRNZXNzYWdlW10gPSBbXVxuICAgIGZvciAoY29uc3QgbXNnIG9mIGdyb3VwTWVzc2FnZXMpIHtcbiAgICAgIGlmIChtc2cudHlwZSA9PT0gJ2Fzc2lzdGFudCcpIHtcbiAgICAgICAgdG9vbFVzZXMucHVzaChtc2cpXG4gICAgICB9IGVsc2UgaWYgKG1zZy50eXBlID09PSAnZ3JvdXBlZF90b29sX3VzZScpIHtcbiAgICAgICAgdG9vbFVzZXMucHVzaCguLi5tc2cubWVzc2FnZXMpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICB7dG9vbFVzZXMubWFwKG1zZyA9PiB7XG4gICAgICAgICAgY29uc3QgY29udGVudCA9IG1zZy5tZXNzYWdlLmNvbnRlbnRbMF1cbiAgICAgICAgICBpZiAoY29udGVudD8udHlwZSAhPT0gJ3Rvb2xfdXNlJykgcmV0dXJuIG51bGxcbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPFZlcmJvc2VUb29sVXNlXG4gICAgICAgICAgICAgIGtleT17Y29udGVudC5pZH1cbiAgICAgICAgICAgICAgY29udGVudD17Y29udGVudH1cbiAgICAgICAgICAgICAgdG9vbHM9e3Rvb2xzfVxuICAgICAgICAgICAgICBsb29rdXBzPXtsb29rdXBzfVxuICAgICAgICAgICAgICBpblByb2dyZXNzVG9vbFVzZUlEcz17aW5Qcm9ncmVzc1Rvb2xVc2VJRHN9XG4gICAgICAgICAgICAgIHNob3VsZEFuaW1hdGU9e3Nob3VsZEFuaW1hdGV9XG4gICAgICAgICAgICAgIHRoZW1lPXt0aGVtZX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKVxuICAgICAgICB9KX1cbiAgICAgICAge21lc3NhZ2UuaG9va0luZm9zICYmIG1lc3NhZ2UuaG9va0luZm9zLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgeycgIOKOvyAgJ31SYW4ge21lc3NhZ2UuaG9va0NvdW50fSBQcmVUb29sVXNleycgJ31cbiAgICAgICAgICAgICAge21lc3NhZ2UuaG9va0NvdW50ID09PSAxID8gJ2hvb2snIDogJ2hvb2tzJ30gKFxuICAgICAgICAgICAgICB7Zm9ybWF0U2Vjb25kc1Nob3J0KG1lc3NhZ2UuaG9va1RvdGFsTXMgPz8gMCl9KVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAge21lc3NhZ2UuaG9va0luZm9zLm1hcCgoaW5mbywgaWR4KSA9PiAoXG4gICAgICAgICAgICAgIDxUZXh0IGtleT17YGhvb2stJHtpZHh9YH0gZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgeycgICAgIOKOvyAnfVxuICAgICAgICAgICAgICAgIHtpbmZvLmNvbW1hbmR9ICh7Zm9ybWF0U2Vjb25kc1Nob3J0KGluZm8uZHVyYXRpb25NcyA/PyAwKX0pXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgICB7bWVzc2FnZS5yZWxldmFudE1lbW9yaWVzPy5tYXAobSA9PiAoXG4gICAgICAgICAgPEJveCBrZXk9e20ucGF0aH0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgeycgIOKOvyAgJ31SZWNhbGxlZCB7YmFzZW5hbWUobS5wYXRoKX1cbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3ggcGFkZGluZ0xlZnQ9ezV9PlxuICAgICAgICAgICAgICA8VGV4dD5cbiAgICAgICAgICAgICAgICA8QW5zaT57bS5jb250ZW50fTwvQW5zaT5cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICkpfVxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgLy8gTm9uLXZlcmJvc2UgbW9kZTogU2hvdyBjb3VudHMgd2l0aCBibGlua2luZyBncmV5IGRvdCB3aGlsZSBhY3RpdmUsIGdyZWVuIGRvdCB3aGVuIGZpbmFsaXplZFxuICAvLyBVc2UgcHJlc2VudCB0ZW5zZSB3aGVuIGFjdGl2ZSwgcGFzdCB0ZW5zZSB3aGVuIGZpbmFsaXplZFxuXG4gIC8vIERlZmVuc2l2ZTogSWYgYWxsIGNvdW50cyBhcmUgMCwgZG9uJ3QgcmVuZGVyIHRoZSBjb2xsYXBzZWQgZ3JvdXBcbiAgLy8gVGhpcyBzaG91bGRuJ3QgaGFwcGVuIGluIG5vcm1hbCBvcGVyYXRpb24sIGJ1dCBoYW5kbGVzIGVkZ2UgY2FzZXNcbiAgaWYgKCFoYXNNZW1vcnlPcHMgJiYgIWhhc1RlYW1NZW1vcnlPcHMgJiYgIWhhc05vbk1lbW9yeU9wcykge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICAvLyBGaW5kIHRoZSBzbG93ZXN0IGluLXByb2dyZXNzIHNoZWxsIGNvbW1hbmQgaW4gdGhpcyBncm91cC4gQmFzaFRvb2wgeWllbGRzXG4gIC8vIHByb2dyZXNzIGV2ZXJ5IHNlY29uZCBidXQgdGhlIGNvbGxhcHNlZCByZW5kZXJlciBuZXZlciBzaG93ZWQgaXQg4oCUIGxvbmdcbiAgLy8gY29tbWFuZHMgKG5wbSBpbnN0YWxsLCB0ZXN0cykgbG9va2VkIGZyb3plbi4gU2hvd24gYWZ0ZXIgMnMgc28gZmFzdFxuICAvLyBjb21tYW5kcyBzdGF5IGNsZWFuOyB0aGUgdGlja2luZyBjb3VudGVyIHJlYXNzdXJlcyB0aGF0IHNsb3cgb25lcyBhcmVuJ3Qgc3R1Y2suXG4gIGxldCBzaGVsbFByb2dyZXNzU3VmZml4ID0gJydcbiAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSAmJiBpc0FjdGl2ZUdyb3VwKSB7XG4gICAgbGV0IGVsYXBzZWQ6IG51bWJlciB8IHVuZGVmaW5lZFxuICAgIGxldCBsaW5lcyA9IDBcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHRvb2xVc2VJZHMpIHtcbiAgICAgIGlmICghaW5Qcm9ncmVzc1Rvb2xVc2VJRHMuaGFzKGlkKSkgY29udGludWVcbiAgICAgIGNvbnN0IGRhdGEgPSBsb29rdXBzLnByb2dyZXNzTWVzc2FnZXNCeVRvb2xVc2VJRC5nZXQoaWQpPy5hdCgtMSk/LmRhdGFcbiAgICAgIGlmIChcbiAgICAgICAgZGF0YT8udHlwZSAhPT0gJ2Jhc2hfcHJvZ3Jlc3MnICYmXG4gICAgICAgIGRhdGE/LnR5cGUgIT09ICdwb3dlcnNoZWxsX3Byb2dyZXNzJ1xuICAgICAgKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBpZiAoZWxhcHNlZCA9PT0gdW5kZWZpbmVkIHx8IGRhdGEuZWxhcHNlZFRpbWVTZWNvbmRzID4gZWxhcHNlZCkge1xuICAgICAgICBlbGFwc2VkID0gZGF0YS5lbGFwc2VkVGltZVNlY29uZHNcbiAgICAgICAgbGluZXMgPSBkYXRhLnRvdGFsTGluZXNcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGVsYXBzZWQgIT09IHVuZGVmaW5lZCAmJiBlbGFwc2VkID49IDIpIHtcbiAgICAgIGNvbnN0IHRpbWUgPSBmb3JtYXREdXJhdGlvbihlbGFwc2VkICogMTAwMClcbiAgICAgIHNoZWxsUHJvZ3Jlc3NTdWZmaXggPVxuICAgICAgICBsaW5lcyA+IDBcbiAgICAgICAgICA/IGAgKCR7dGltZX0gwrcgJHtsaW5lc30gJHtsaW5lcyA9PT0gMSA/ICdsaW5lJyA6ICdsaW5lcyd9KWBcbiAgICAgICAgICA6IGAgKCR7dGltZX0pYFxuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWxkIG5vbi1tZW1vcnkgcGFydHMgZmlyc3QgKHNlYXJjaCwgcmVhZCwgcmVwbCwgbWNwLCBiYXNoKSDigJQgdGhlc2UgcmVuZGVyXG4gIC8vIGJlZm9yZSBtZW1vcnkgc28gdGhlIGxpbmUgcmVhZHMgXCJSYW4gMyBiYXNoIGNvbW1hbmRzLCByZWNhbGxlZCAxIG1lbW9yeVwiLlxuICBjb25zdCBub25NZW1QYXJ0czogUmVhY3QuUmVhY3ROb2RlW10gPSBbXVxuXG4gIC8vIEdpdCBvcGVyYXRpb25zIGxlYWQgdGhlIGxpbmUg4oCUIHRoZXkncmUgdGhlIGxvYWQtYmVhcmluZyBvdXRjb21lLlxuICBmdW5jdGlvbiBwdXNoUGFydChrZXk6IHN0cmluZywgdmVyYjogc3RyaW5nLCBib2R5OiBSZWFjdC5SZWFjdE5vZGUpOiB2b2lkIHtcbiAgICBjb25zdCBpc0ZpcnN0ID0gbm9uTWVtUGFydHMubGVuZ3RoID09PSAwXG4gICAgaWYgKCFpc0ZpcnN0KSBub25NZW1QYXJ0cy5wdXNoKDxUZXh0IGtleT17YGNvbW1hLSR7a2V5fWB9PiwgPC9UZXh0PilcbiAgICBub25NZW1QYXJ0cy5wdXNoKFxuICAgICAgPFRleHQga2V5PXtrZXl9PlxuICAgICAgICB7aXNGaXJzdCA/IHZlcmJbMF0hLnRvVXBwZXJDYXNlKCkgKyB2ZXJiLnNsaWNlKDEpIDogdmVyYn0ge2JvZHl9XG4gICAgICA8L1RleHQ+LFxuICAgIClcbiAgfVxuICBpZiAoaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIG1lc3NhZ2UuY29tbWl0cz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgYnlLaW5kID0ge1xuICAgICAgY29tbWl0dGVkOiAnY29tbWl0dGVkJyxcbiAgICAgIGFtZW5kZWQ6ICdhbWVuZGVkIGNvbW1pdCcsXG4gICAgICAnY2hlcnJ5LXBpY2tlZCc6ICdjaGVycnktcGlja2VkJyxcbiAgICB9XG4gICAgZm9yIChjb25zdCBraW5kIG9mIFsnY29tbWl0dGVkJywgJ2FtZW5kZWQnLCAnY2hlcnJ5LXBpY2tlZCddIGFzIGNvbnN0KSB7XG4gICAgICBjb25zdCBzaGFzID0gbWVzc2FnZS5jb21taXRzLmZpbHRlcihjID0+IGMua2luZCA9PT0ga2luZCkubWFwKGMgPT4gYy5zaGEpXG4gICAgICBpZiAoc2hhcy5sZW5ndGgpIHtcbiAgICAgICAgcHVzaFBhcnQoa2luZCwgYnlLaW5kW2tpbmRdLCA8VGV4dCBib2xkPntzaGFzLmpvaW4oJywgJyl9PC9UZXh0PilcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSAmJiBtZXNzYWdlLnB1c2hlcz8ubGVuZ3RoKSB7XG4gICAgY29uc3QgYnJhbmNoZXMgPSB1bmlxKG1lc3NhZ2UucHVzaGVzLm1hcChwID0+IHAuYnJhbmNoKSlcbiAgICBwdXNoUGFydCgncHVzaCcsICdwdXNoZWQgdG8nLCA8VGV4dCBib2xkPnticmFuY2hlcy5qb2luKCcsICcpfTwvVGV4dD4pXG4gIH1cbiAgaWYgKGlzRnVsbHNjcmVlbkVudkVuYWJsZWQoKSAmJiBtZXNzYWdlLmJyYW5jaGVzPy5sZW5ndGgpIHtcbiAgICBjb25zdCBieUFjdGlvbiA9IHsgbWVyZ2VkOiAnbWVyZ2VkJywgcmViYXNlZDogJ3JlYmFzZWQgb250bycgfVxuICAgIGZvciAoY29uc3QgYiBvZiBtZXNzYWdlLmJyYW5jaGVzKSB7XG4gICAgICBwdXNoUGFydChcbiAgICAgICAgYGJyLSR7Yi5hY3Rpb259LSR7Yi5yZWZ9YCxcbiAgICAgICAgYnlBY3Rpb25bYi5hY3Rpb25dLFxuICAgICAgICA8VGV4dCBib2xkPntiLnJlZn08L1RleHQ+LFxuICAgICAgKVxuICAgIH1cbiAgfVxuICBpZiAoaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIG1lc3NhZ2UucHJzPy5sZW5ndGgpIHtcbiAgICBjb25zdCB2ZXJicyA9IHtcbiAgICAgIGNyZWF0ZWQ6ICdjcmVhdGVkJyxcbiAgICAgIGVkaXRlZDogJ2VkaXRlZCcsXG4gICAgICBtZXJnZWQ6ICdtZXJnZWQnLFxuICAgICAgY29tbWVudGVkOiAnY29tbWVudGVkIG9uJyxcbiAgICAgIGNsb3NlZDogJ2Nsb3NlZCcsXG4gICAgICByZWFkeTogJ21hcmtlZCByZWFkeScsXG4gICAgfVxuICAgIGZvciAoY29uc3QgcHIgb2YgbWVzc2FnZS5wcnMpIHtcbiAgICAgIHB1c2hQYXJ0KFxuICAgICAgICBgcHItJHtwci5hY3Rpb259LSR7cHIubnVtYmVyfWAsXG4gICAgICAgIHZlcmJzW3ByLmFjdGlvbl0sXG4gICAgICAgIHByLnVybCA/IChcbiAgICAgICAgICA8UHJCYWRnZSBudW1iZXI9e3ByLm51bWJlcn0gdXJsPXtwci51cmx9IGJvbGQgLz5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8VGV4dCBib2xkPlBSICN7cHIubnVtYmVyfTwvVGV4dD5cbiAgICAgICAgKSxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBpZiAoc2VhcmNoQ291bnQgPiAwKSB7XG4gICAgY29uc3QgaXNGaXJzdCA9IG5vbk1lbVBhcnRzLmxlbmd0aCA9PT0gMFxuICAgIGNvbnN0IHNlYXJjaFZlcmIgPSBpc0FjdGl2ZUdyb3VwXG4gICAgICA/IGlzRmlyc3RcbiAgICAgICAgPyAnU2VhcmNoaW5nIGZvcidcbiAgICAgICAgOiAnc2VhcmNoaW5nIGZvcidcbiAgICAgIDogaXNGaXJzdFxuICAgICAgICA/ICdTZWFyY2hlZCBmb3InXG4gICAgICAgIDogJ3NlYXJjaGVkIGZvcidcbiAgICBpZiAoIWlzRmlyc3QpIHtcbiAgICAgIG5vbk1lbVBhcnRzLnB1c2goPFRleHQga2V5PVwiY29tbWEtc1wiPiwgPC9UZXh0PilcbiAgICB9XG4gICAgbm9uTWVtUGFydHMucHVzaChcbiAgICAgIDxUZXh0IGtleT1cInNlYXJjaFwiPlxuICAgICAgICB7c2VhcmNoVmVyYn0gPFRleHQgYm9sZD57c2VhcmNoQ291bnR9PC9UZXh0PnsnICd9XG4gICAgICAgIHtzZWFyY2hDb3VudCA9PT0gMSA/ICdwYXR0ZXJuJyA6ICdwYXR0ZXJucyd9XG4gICAgICA8L1RleHQ+LFxuICAgIClcbiAgfVxuXG4gIGlmIChyZWFkQ291bnQgPiAwKSB7XG4gICAgY29uc3QgaXNGaXJzdCA9IG5vbk1lbVBhcnRzLmxlbmd0aCA9PT0gMFxuICAgIGNvbnN0IHJlYWRWZXJiID0gaXNBY3RpdmVHcm91cFxuICAgICAgPyBpc0ZpcnN0XG4gICAgICAgID8gJ1JlYWRpbmcnXG4gICAgICAgIDogJ3JlYWRpbmcnXG4gICAgICA6IGlzRmlyc3RcbiAgICAgICAgPyAnUmVhZCdcbiAgICAgICAgOiAncmVhZCdcbiAgICBpZiAoIWlzRmlyc3QpIHtcbiAgICAgIG5vbk1lbVBhcnRzLnB1c2goPFRleHQga2V5PVwiY29tbWEtclwiPiwgPC9UZXh0PilcbiAgICB9XG4gICAgbm9uTWVtUGFydHMucHVzaChcbiAgICAgIDxUZXh0IGtleT1cInJlYWRcIj5cbiAgICAgICAge3JlYWRWZXJifSA8VGV4dCBib2xkPntyZWFkQ291bnR9PC9UZXh0PnsnICd9XG4gICAgICAgIHtyZWFkQ291bnQgPT09IDEgPyAnZmlsZScgOiAnZmlsZXMnfVxuICAgICAgPC9UZXh0PixcbiAgICApXG4gIH1cblxuICBpZiAobGlzdENvdW50ID4gMCkge1xuICAgIGNvbnN0IGlzRmlyc3QgPSBub25NZW1QYXJ0cy5sZW5ndGggPT09IDBcbiAgICBjb25zdCBsaXN0VmVyYiA9IGlzQWN0aXZlR3JvdXBcbiAgICAgID8gaXNGaXJzdFxuICAgICAgICA/ICdMaXN0aW5nJ1xuICAgICAgICA6ICdsaXN0aW5nJ1xuICAgICAgOiBpc0ZpcnN0XG4gICAgICAgID8gJ0xpc3RlZCdcbiAgICAgICAgOiAnbGlzdGVkJ1xuICAgIGlmICghaXNGaXJzdCkge1xuICAgICAgbm9uTWVtUGFydHMucHVzaCg8VGV4dCBrZXk9XCJjb21tYS1sXCI+LCA8L1RleHQ+KVxuICAgIH1cbiAgICBub25NZW1QYXJ0cy5wdXNoKFxuICAgICAgPFRleHQga2V5PVwibGlzdFwiPlxuICAgICAgICB7bGlzdFZlcmJ9IDxUZXh0IGJvbGQ+e2xpc3RDb3VudH08L1RleHQ+eycgJ31cbiAgICAgICAge2xpc3RDb3VudCA9PT0gMSA/ICdkaXJlY3RvcnknIDogJ2RpcmVjdG9yaWVzJ31cbiAgICAgIDwvVGV4dD4sXG4gICAgKVxuICB9XG5cbiAgaWYgKHJlcGxDb3VudCA+IDApIHtcbiAgICBjb25zdCByZXBsVmVyYiA9IGlzQWN0aXZlR3JvdXAgPyBcIlJFUEwnaW5nXCIgOiBcIlJFUEwnZFwiXG4gICAgaWYgKG5vbk1lbVBhcnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIG5vbk1lbVBhcnRzLnB1c2goPFRleHQga2V5PVwiY29tbWEtcmVwbFwiPiwgPC9UZXh0PilcbiAgICB9XG4gICAgbm9uTWVtUGFydHMucHVzaChcbiAgICAgIDxUZXh0IGtleT1cInJlcGxcIj5cbiAgICAgICAge3JlcGxWZXJifSA8VGV4dCBib2xkPntyZXBsQ291bnR9PC9UZXh0PnsnICd9XG4gICAgICAgIHtyZXBsQ291bnQgPT09IDEgPyAndGltZScgOiAndGltZXMnfVxuICAgICAgPC9UZXh0PixcbiAgICApXG4gIH1cblxuICBpZiAobWNwQ2FsbENvdW50ID4gMCkge1xuICAgIGNvbnN0IHNlcnZlckxhYmVsID1cbiAgICAgIG1lc3NhZ2UubWNwU2VydmVyTmFtZXNcbiAgICAgICAgPy5tYXAobiA9PiBuLnJlcGxhY2UoL15jbGF1ZGVcXC5haSAvLCAnJykpXG4gICAgICAgIC5qb2luKCcsICcpIHx8ICdNQ1AnXG4gICAgY29uc3QgaXNGaXJzdCA9IG5vbk1lbVBhcnRzLmxlbmd0aCA9PT0gMFxuICAgIGNvbnN0IHZlcmIgPSBpc0FjdGl2ZUdyb3VwXG4gICAgICA/IGlzRmlyc3RcbiAgICAgICAgPyAnUXVlcnlpbmcnXG4gICAgICAgIDogJ3F1ZXJ5aW5nJ1xuICAgICAgOiBpc0ZpcnN0XG4gICAgICAgID8gJ1F1ZXJpZWQnXG4gICAgICAgIDogJ3F1ZXJpZWQnXG4gICAgaWYgKCFpc0ZpcnN0KSB7XG4gICAgICBub25NZW1QYXJ0cy5wdXNoKDxUZXh0IGtleT1cImNvbW1hLW1jcFwiPiwgPC9UZXh0PilcbiAgICB9XG4gICAgbm9uTWVtUGFydHMucHVzaChcbiAgICAgIDxUZXh0IGtleT1cIm1jcFwiPlxuICAgICAgICB7dmVyYn0ge3NlcnZlckxhYmVsfVxuICAgICAgICB7bWNwQ2FsbENvdW50ID4gMSAmJiAoXG4gICAgICAgICAgPD5cbiAgICAgICAgICAgIHsnICd9XG4gICAgICAgICAgICA8VGV4dCBib2xkPnttY3BDYWxsQ291bnR9PC9UZXh0PiB0aW1lc1xuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgPC9UZXh0PixcbiAgICApXG4gIH1cblxuICBpZiAoaXNGdWxsc2NyZWVuRW52RW5hYmxlZCgpICYmIGJhc2hDb3VudCA+IDApIHtcbiAgICBjb25zdCBpc0ZpcnN0ID0gbm9uTWVtUGFydHMubGVuZ3RoID09PSAwXG4gICAgY29uc3QgdmVyYiA9IGlzQWN0aXZlR3JvdXBcbiAgICAgID8gaXNGaXJzdFxuICAgICAgICA/ICdSdW5uaW5nJ1xuICAgICAgICA6ICdydW5uaW5nJ1xuICAgICAgOiBpc0ZpcnN0XG4gICAgICAgID8gJ1JhbidcbiAgICAgICAgOiAncmFuJ1xuICAgIGlmICghaXNGaXJzdCkge1xuICAgICAgbm9uTWVtUGFydHMucHVzaCg8VGV4dCBrZXk9XCJjb21tYS1iYXNoXCI+LCA8L1RleHQ+KVxuICAgIH1cbiAgICBub25NZW1QYXJ0cy5wdXNoKFxuICAgICAgPFRleHQga2V5PVwiYmFzaFwiPlxuICAgICAgICB7dmVyYn0gPFRleHQgYm9sZD57YmFzaENvdW50fTwvVGV4dD4gYmFzaHsnICd9XG4gICAgICAgIHtiYXNoQ291bnQgPT09IDEgPyAnY29tbWFuZCcgOiAnY29tbWFuZHMnfVxuICAgICAgPC9UZXh0PixcbiAgICApXG4gIH1cblxuICAvLyBCdWlsZCBtZW1vcnkgcGFydHMgKGF1dG8tbWVtb3J5KSDigJQgcmVuZGVyZWQgYWZ0ZXIgbm9uTWVtUGFydHNcbiAgY29uc3QgaGFzUHJlY2VkaW5nTm9uTWVtID0gbm9uTWVtUGFydHMubGVuZ3RoID4gMFxuICBjb25zdCBtZW1QYXJ0czogUmVhY3QuUmVhY3ROb2RlW10gPSBbXVxuXG4gIGlmIChtZW1vcnlSZWFkQ291bnQgPiAwKSB7XG4gICAgY29uc3QgaXNGaXJzdCA9ICFoYXNQcmVjZWRpbmdOb25NZW0gJiYgbWVtUGFydHMubGVuZ3RoID09PSAwXG4gICAgY29uc3QgdmVyYiA9IGlzQWN0aXZlR3JvdXBcbiAgICAgID8gaXNGaXJzdFxuICAgICAgICA/ICdSZWNhbGxpbmcnXG4gICAgICAgIDogJ3JlY2FsbGluZydcbiAgICAgIDogaXNGaXJzdFxuICAgICAgICA/ICdSZWNhbGxlZCdcbiAgICAgICAgOiAncmVjYWxsZWQnXG4gICAgaWYgKCFpc0ZpcnN0KSB7XG4gICAgICBtZW1QYXJ0cy5wdXNoKDxUZXh0IGtleT1cImNvbW1hLW1yXCI+LCA8L1RleHQ+KVxuICAgIH1cbiAgICBtZW1QYXJ0cy5wdXNoKFxuICAgICAgPFRleHQga2V5PVwibWVtLXJlYWRcIj5cbiAgICAgICAge3ZlcmJ9IDxUZXh0IGJvbGQ+e21lbW9yeVJlYWRDb3VudH08L1RleHQ+eycgJ31cbiAgICAgICAge21lbW9yeVJlYWRDb3VudCA9PT0gMSA/ICdtZW1vcnknIDogJ21lbW9yaWVzJ31cbiAgICAgIDwvVGV4dD4sXG4gICAgKVxuICB9XG5cbiAgaWYgKG1lbW9yeVNlYXJjaENvdW50ID4gMCkge1xuICAgIGNvbnN0IGlzRmlyc3QgPSAhaGFzUHJlY2VkaW5nTm9uTWVtICYmIG1lbVBhcnRzLmxlbmd0aCA9PT0gMFxuICAgIGNvbnN0IHZlcmIgPSBpc0FjdGl2ZUdyb3VwXG4gICAgICA/IGlzRmlyc3RcbiAgICAgICAgPyAnU2VhcmNoaW5nJ1xuICAgICAgICA6ICdzZWFyY2hpbmcnXG4gICAgICA6IGlzRmlyc3RcbiAgICAgICAgPyAnU2VhcmNoZWQnXG4gICAgICAgIDogJ3NlYXJjaGVkJ1xuICAgIGlmICghaXNGaXJzdCkge1xuICAgICAgbWVtUGFydHMucHVzaCg8VGV4dCBrZXk9XCJjb21tYS1tc1wiPiwgPC9UZXh0PilcbiAgICB9XG4gICAgbWVtUGFydHMucHVzaCg8VGV4dCBrZXk9XCJtZW0tc2VhcmNoXCI+e2Ake3ZlcmJ9IG1lbW9yaWVzYH08L1RleHQ+KVxuICB9XG5cbiAgaWYgKG1lbW9yeVdyaXRlQ291bnQgPiAwKSB7XG4gICAgY29uc3QgaXNGaXJzdCA9ICFoYXNQcmVjZWRpbmdOb25NZW0gJiYgbWVtUGFydHMubGVuZ3RoID09PSAwXG4gICAgY29uc3QgdmVyYiA9IGlzQWN0aXZlR3JvdXBcbiAgICAgID8gaXNGaXJzdFxuICAgICAgICA/ICdXcml0aW5nJ1xuICAgICAgICA6ICd3cml0aW5nJ1xuICAgICAgOiBpc0ZpcnN0XG4gICAgICAgID8gJ1dyb3RlJ1xuICAgICAgICA6ICd3cm90ZSdcbiAgICBpZiAoIWlzRmlyc3QpIHtcbiAgICAgIG1lbVBhcnRzLnB1c2goPFRleHQga2V5PVwiY29tbWEtbXdcIj4sIDwvVGV4dD4pXG4gICAgfVxuICAgIG1lbVBhcnRzLnB1c2goXG4gICAgICA8VGV4dCBrZXk9XCJtZW0td3JpdGVcIj5cbiAgICAgICAge3ZlcmJ9IDxUZXh0IGJvbGQ+e21lbW9yeVdyaXRlQ291bnR9PC9UZXh0PnsnICd9XG4gICAgICAgIHttZW1vcnlXcml0ZUNvdW50ID09PSAxID8gJ21lbW9yeScgOiAnbWVtb3JpZXMnfVxuICAgICAgPC9UZXh0PixcbiAgICApXG4gIH1cblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0gYmFja2dyb3VuZENvbG9yPXtiZ30+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAge2lzQWN0aXZlR3JvdXAgPyAoXG4gICAgICAgICAgPFRvb2xVc2VMb2FkZXIgc2hvdWxkQW5pbWF0ZSBpc1VucmVzb2x2ZWQgaXNFcnJvcj17YW55RXJyb3J9IC8+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgPEJveCBtaW5XaWR0aD17Mn0gLz5cbiAgICAgICAgKX1cbiAgICAgICAgPFRleHQgZGltQ29sb3I9eyFpc0FjdGl2ZUdyb3VwfT5cbiAgICAgICAgICB7bm9uTWVtUGFydHN9XG4gICAgICAgICAge21lbVBhcnRzfVxuICAgICAgICAgIHtmZWF0dXJlKCdURUFNTUVNJylcbiAgICAgICAgICAgID8gdGVhbU1lbUNvbGxhcHNlZCEuVGVhbU1lbUNvdW50UGFydHMoe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgaXNBY3RpdmVHcm91cCxcbiAgICAgICAgICAgICAgICBoYXNQcmVjZWRpbmdQYXJ0czogaGFzUHJlY2VkaW5nTm9uTWVtIHx8IG1lbVBhcnRzLmxlbmd0aCA+IDAsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICA6IG51bGx9XG4gICAgICAgICAge2lzQWN0aXZlR3JvdXAgJiYgPFRleHQga2V5PVwiZWxsaXBzaXNcIj7igKY8L1RleHQ+fSA8Q3RybE9Ub0V4cGFuZCAvPlxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICAgIHtpc0FjdGl2ZUdyb3VwICYmIGRpc3BsYXllZEhpbnQgIT09IHVuZGVmaW5lZCAmJiAoXG4gICAgICAgIC8vIFJvdyBsYXlvdXQ6IDUtd2lkZSBndXR0ZXIgZm9yIOKOvywgdGhlbiBhIGZsZXggY29sdW1uIGZvciB0aGUgdGV4dC5cbiAgICAgICAgLy8gSW5rJ3Mgd3JhcCBzdGF5cyBpbnNpZGUgdGhlIHJpZ2h0IGNvbHVtbiBzbyBjb250aW51YXRpb24gbGluZXNcbiAgICAgICAgLy8gaW5kZW50IHVuZGVyIOKOvy4gTUFYX0hJTlRfQ0hBUlMgaW4gY29tbWFuZEFzSGludCBjYXBzIHRvdGFsIGF0IH41IGxpbmVzLlxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgICA8Qm94IHdpZHRoPXs1fSBmbGV4U2hyaW5rPXswfT5cbiAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPnsnICDijr8gICd9PC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGZsZXhHcm93PXsxfT5cbiAgICAgICAgICAgIHtkaXNwbGF5ZWRIaW50LnNwbGl0KCdcXG4nKS5tYXAoKGxpbmUsIGksIGFycikgPT4gKFxuICAgICAgICAgICAgICA8VGV4dCBrZXk9e2BoaW50LSR7aX1gfSBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICB7bGluZX1cbiAgICAgICAgICAgICAgICB7aSA9PT0gYXJyLmxlbmd0aCAtIDEgJiYgc2hlbGxQcm9ncmVzc1N1ZmZpeH1cbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgKSl9XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgIDwvQm94PlxuICAgICAgKX1cbiAgICAgIHttZXNzYWdlLmhvb2tUb3RhbE1zICE9PSB1bmRlZmluZWQgJiYgbWVzc2FnZS5ob29rVG90YWxNcyA+IDAgJiYgKFxuICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICB7JyAg4o6/ICAnfVJhbiB7bWVzc2FnZS5ob29rQ291bnR9IFByZVRvb2xVc2V7JyAnfVxuICAgICAgICAgIHttZXNzYWdlLmhvb2tDb3VudCA9PT0gMSA/ICdob29rJyA6ICdob29rcyd9IChcbiAgICAgICAgICB7Zm9ybWF0U2Vjb25kc1Nob3J0KG1lc3NhZ2UuaG9va1RvdGFsTXMpfSlcbiAgICAgICAgPC9UZXh0PlxuICAgICAgKX1cbiAgICA8L0JveD5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsU0FBU0EsT0FBTyxRQUFRLFlBQVk7QUFDcEMsU0FBU0MsUUFBUSxRQUFRLE1BQU07QUFDL0IsT0FBT0MsS0FBSyxJQUFJQyxNQUFNLFFBQVEsT0FBTztBQUNyQyxTQUFTQyxpQkFBaUIsUUFBUSxrQ0FBa0M7QUFDcEUsU0FBU0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLElBQUksRUFBRUMsUUFBUSxRQUFRLGNBQWM7QUFDeEQsU0FBU0MsY0FBYyxFQUFFLEtBQUtDLEtBQUssUUFBUSxlQUFlO0FBQzFELFNBQVNDLHFCQUFxQixRQUFRLHdDQUF3QztBQUM5RSxjQUNFQyx3QkFBd0IsRUFDeEJDLDBCQUEwQixRQUNyQix3QkFBd0I7QUFDL0IsU0FBU0MsSUFBSSxRQUFRLHNCQUFzQjtBQUMzQyxTQUFTQywrQkFBK0IsUUFBUSxtQ0FBbUM7QUFDbkYsU0FBU0MsY0FBYyxRQUFRLHFCQUFxQjtBQUNwRCxTQUFTQyxjQUFjLEVBQUVDLGtCQUFrQixRQUFRLHVCQUF1QjtBQUMxRSxTQUFTQyxzQkFBc0IsUUFBUSwyQkFBMkI7QUFDbEUsY0FBY0MsbUJBQW1CLFFBQVEseUJBQXlCO0FBQ2xFLGNBQWNDLFNBQVMsUUFBUSxzQkFBc0I7QUFDckQsU0FBU0MsYUFBYSxRQUFRLHFCQUFxQjtBQUNuRCxTQUFTQyxvQkFBb0IsUUFBUSxzQkFBc0I7QUFDM0QsU0FBU0MsT0FBTyxRQUFRLGVBQWU7QUFDdkMsU0FBU0MsYUFBYSxRQUFRLHFCQUFxQjs7QUFFbkQ7QUFDQSxNQUFNQyxnQkFBZ0IsR0FBRzFCLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FDdEMyQixPQUFPLENBQUMsdUJBQXVCLENBQUMsSUFBSSxPQUFPLE9BQU8sdUJBQXVCLENBQUMsR0FDM0UsSUFBSTtBQUNSOztBQUVBO0FBQ0E7QUFDQTtBQUNBLE1BQU1DLG1CQUFtQixHQUFHLEdBQUc7QUFFL0IsS0FBS0MsS0FBSyxHQUFHO0VBQ1hDLE9BQU8sRUFBRWxCLHdCQUF3QjtFQUNqQ21CLG9CQUFvQixFQUFFQyxHQUFHLENBQUMsTUFBTSxDQUFDO0VBQ2pDQyxhQUFhLEVBQUUsT0FBTztFQUN0QkMsT0FBTyxFQUFFLE9BQU87RUFDaEJDLEtBQUssRUFBRXpCLEtBQUs7RUFDWjBCLE9BQU8sRUFBRUMsVUFBVSxDQUFDLE9BQU9qQixtQkFBbUIsQ0FBQztFQUMvQztFQUNBa0IsYUFBYSxDQUFDLEVBQUUsT0FBTztBQUN6QixDQUFDOztBQUVEO0FBQ0EsU0FBQUMsZUFBQUMsRUFBQTtFQUFBLE1BQUFDLENBQUEsR0FBQUMsRUFBQTtFQUF3QjtJQUFBQyxPQUFBO0lBQUFSLEtBQUE7SUFBQUMsT0FBQTtJQUFBTCxvQkFBQTtJQUFBRSxhQUFBO0lBQUFXO0VBQUEsSUFBQUosRUFjdkI7RUFDQyxNQUFBSyxFQUFBLEdBQVd0QixvQkFBb0IsQ0FBQyxDQUFDO0VBQUEsSUFBQXVCLEVBQUE7RUFBQSxJQUFBQyxFQUFBO0VBQUEsSUFBQU4sQ0FBQSxRQUFBSSxFQUFBLElBQUFKLENBQUEsUUFBQUUsT0FBQSxDQUFBSyxFQUFBLElBQUFQLENBQUEsUUFBQUUsT0FBQSxDQUFBTSxLQUFBLElBQUFSLENBQUEsUUFBQUUsT0FBQSxDQUFBTyxJQUFBLElBQUFULENBQUEsUUFBQVYsb0JBQUEsSUFBQVUsQ0FBQSxRQUFBTCxPQUFBLElBQUFLLENBQUEsUUFBQVIsYUFBQSxJQUFBUSxDQUFBLFFBQUFHLEtBQUEsSUFBQUgsQ0FBQSxRQUFBTixLQUFBO0lBT2ZZLEVBQUEsR0FBQUksTUFBSSxDQUFBQyxHQUFBLENBQUosNkJBQUcsQ0FBQztJQUFBQyxHQUFBO01BSHRCLE1BQUFDLElBQUEsR0FDRTdDLGNBQWMsQ0FBQzBCLEtBQUssRUFBRVEsT0FBTyxDQUFBTyxJQUN1QixDQUFDLElBQXJEekMsY0FBYyxDQUFDRSxxQkFBcUIsQ0FBQyxDQUFDLEVBQUVnQyxPQUFPLENBQUFPLElBQUssQ0FBQztNQUN2RCxJQUFJLENBQUNJLElBQUk7UUFBU1AsRUFBQSxPQUFJO1FBQUosTUFBQU0sR0FBQTtNQUFJO01BQUEsSUFBQUUsRUFBQTtNQUFBLElBQUFkLENBQUEsU0FBQUUsT0FBQSxDQUFBSyxFQUFBLElBQUFQLENBQUEsU0FBQUwsT0FBQSxDQUFBb0Isa0JBQUE7UUFFSEQsRUFBQSxHQUFBbkIsT0FBTyxDQUFBb0Isa0JBQW1CLENBQUFDLEdBQUksQ0FBQ2QsT0FBTyxDQUFBSyxFQUFHLENBQUM7UUFBQVAsQ0FBQSxPQUFBRSxPQUFBLENBQUFLLEVBQUE7UUFBQVAsQ0FBQSxPQUFBTCxPQUFBLENBQUFvQixrQkFBQTtRQUFBZixDQUFBLE9BQUFjLEVBQUE7TUFBQTtRQUFBQSxFQUFBLEdBQUFkLENBQUE7TUFBQTtNQUE3RCxNQUFBaUIsVUFBQSxHQUFtQkgsRUFBMEM7TUFBQSxJQUFBSSxFQUFBO01BQUEsSUFBQWxCLENBQUEsU0FBQUUsT0FBQSxDQUFBSyxFQUFBLElBQUFQLENBQUEsU0FBQUwsT0FBQSxDQUFBd0IsaUJBQUE7UUFDN0NELEVBQUEsR0FBQXZCLE9BQU8sQ0FBQXdCLGlCQUFrQixDQUFBSCxHQUFJLENBQUNkLE9BQU8sQ0FBQUssRUFBRyxDQUFDO1FBQUFQLENBQUEsT0FBQUUsT0FBQSxDQUFBSyxFQUFBO1FBQUFQLENBQUEsT0FBQUwsT0FBQSxDQUFBd0IsaUJBQUE7UUFBQW5CLENBQUEsT0FBQWtCLEVBQUE7TUFBQTtRQUFBQSxFQUFBLEdBQUFsQixDQUFBO01BQUE7TUFBekQsTUFBQW9CLE9BQUEsR0FBZ0JGLEVBQXlDO01BQUEsSUFBQUcsRUFBQTtNQUFBLElBQUFyQixDQUFBLFNBQUFFLE9BQUEsQ0FBQUssRUFBQSxJQUFBUCxDQUFBLFNBQUFWLG9CQUFBO1FBQ3BDK0IsRUFBQSxHQUFBL0Isb0JBQW9CLENBQUEwQixHQUFJLENBQUNkLE9BQU8sQ0FBQUssRUFBRyxDQUFDO1FBQUFQLENBQUEsT0FBQUUsT0FBQSxDQUFBSyxFQUFBO1FBQUFQLENBQUEsT0FBQVYsb0JBQUE7UUFBQVUsQ0FBQSxPQUFBcUIsRUFBQTtNQUFBO1FBQUFBLEVBQUEsR0FBQXJCLENBQUE7TUFBQTtNQUF6RCxNQUFBc0IsWUFBQSxHQUFxQkQsRUFBb0M7TUFFekQsTUFBQUUsU0FBQSxHQUFrQjVCLE9BQU8sQ0FBQTZCLHFCQUFzQixDQUFBQyxHQUFJLENBQUN2QixPQUFPLENBQUFLLEVBQUcsQ0FBQztNQUMvRCxNQUFBbUIsYUFBQSxHQUNFSCxTQUFTLEVBQUFJLElBQU0sS0FBSyxNQUE0QyxHQUFuQ0osU0FBUyxDQUFBSyxhQUEwQixHQUFoRUMsU0FBZ0U7TUFDbEUsTUFBQUMsWUFBQSxHQUFxQmpCLElBQUksQ0FBQWtCLFlBQXdCLEVBQUFDLFNBQWUsQ0FBZE4sYUFBYSxDQUFDO01BQ2hFLE1BQUFPLFVBQUEsR0FBbUJILFlBQVksRUFBQUksT0FBeUMsR0FBN0JKLFlBQVksQ0FBQUssSUFBaUIsR0FBckROLFNBQXFEO01BRXhFLE1BQUFPLFdBQUEsR0FBb0J2QixJQUFJLENBQUF3QixXQUFZLENBQUFMLFNBQVUsQ0FBQzlCLE9BQU8sQ0FBQU0sS0FBTSxDQUFDO01BQzdELE1BQUFBLEtBQUEsR0FBYzRCLFdBQVcsQ0FBQUYsT0FBdUMsR0FBNUJFLFdBQVcsQ0FBQUQsSUFBaUIsR0FBbEROLFNBQWtEO01BQ2hFLE1BQUFTLGNBQUEsR0FBdUJ6QixJQUFJLENBQUF5QixjQUFlLENBQUM5QixLQUFLLENBQUM7TUFDakQsTUFBQStCLGNBQUEsR0FBdUIvQixLQUFLLEdBQ3hCSyxJQUFJLENBQUEyQixvQkFBcUIsQ0FBQ2hDLEtBQUssRUFBRTtRQUFBTCxLQUFBO1FBQUFWLE9BQUEsRUFBa0I7TUFBSyxDQUNyRCxDQUFDLEdBRmUsSUFFZjtNQVdlLE1BQUFnRCxFQUFBLEdBQUFqRCxhQUE2QixJQUE3QjhCLFlBQTZCO01BQzlCLE1BQUFvQixFQUFBLElBQUN6QixVQUFVO01BQUEsSUFBQTBCLEVBQUE7TUFBQSxJQUFBM0MsQ0FBQSxTQUFBb0IsT0FBQSxJQUFBcEIsQ0FBQSxTQUFBeUMsRUFBQSxJQUFBekMsQ0FBQSxTQUFBMEMsRUFBQTtRQUYzQkMsRUFBQSxJQUFDLGFBQWEsQ0FDRyxhQUE2QixDQUE3QixDQUFBRixFQUE0QixDQUFDLENBQzlCLFlBQVcsQ0FBWCxDQUFBQyxFQUFVLENBQUMsQ0FDaEJ0QixPQUFPLENBQVBBLFFBQU0sQ0FBQyxHQUNoQjtRQUFBcEIsQ0FBQSxPQUFBb0IsT0FBQTtRQUFBcEIsQ0FBQSxPQUFBeUMsRUFBQTtRQUFBekMsQ0FBQSxPQUFBMEMsRUFBQTtRQUFBMUMsQ0FBQSxPQUFBMkMsRUFBQTtNQUFBO1FBQUFBLEVBQUEsR0FBQTNDLENBQUE7TUFBQTtNQVhOSyxFQUFBLElBQUMsR0FBRyxDQUNHLEdBQVUsQ0FBVixDQUFBSCxPQUFPLENBQUFLLEVBQUUsQ0FBQyxDQUNELGFBQVEsQ0FBUixRQUFRLENBQ1gsU0FBQyxDQUFELEdBQUMsQ0FDS0gsZUFBRSxDQUFGQSxHQUFDLENBQUMsQ0FFbkIsQ0FBQyxHQUFHLENBQWUsYUFBSyxDQUFMLEtBQUssQ0FDdEIsQ0FBQXVDLEVBSUMsQ0FDRCxDQUFDLElBQUksQ0FDSCxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUosS0FBRyxDQUFDLENBQUVMLGVBQWEsQ0FBRSxFQUExQixJQUFJLENBQ0osQ0FBQUMsY0FBaUQsSUFBL0IsQ0FBQyxJQUFJLENBQUMsQ0FBRUEsZUFBYSxDQUFFLENBQUMsRUFBdkIsSUFBSSxDQUF5QixDQUNuRCxFQUhDLElBQUksQ0FJSixDQUFBL0IsS0FBdUMsSUFBOUJLLElBQUksQ0FBQStCLGdCQUEwQixHQUFOcEMsS0FBSyxFQUN6QyxFQVhDLEdBQUcsQ0FZSCxDQUFBUyxVQUFzQixJQUF0QixDQUFlRyxPQUFtQyxJQUF4QmEsVUFBVSxLQUFLSixTQVF6QyxJQVBDLENBQUMsR0FBRyxDQUNELENBQUFoQixJQUFJLENBQUFnQyx1QkFJSCxHQUo4QlosVUFBVSxFQUFFLEVBQUUsRUFBRTtZQUFBeEMsT0FBQSxFQUNyQyxJQUFJO1lBQUFDLEtBQUE7WUFBQVM7VUFHZixDQUFDLEVBQ0gsRUFOQyxHQUFHLENBT04sQ0FDRixFQTNCQyxHQUFHLENBMkJFO0lBQUE7SUFBQUgsQ0FBQSxNQUFBSSxFQUFBO0lBQUFKLENBQUEsTUFBQUUsT0FBQSxDQUFBSyxFQUFBO0lBQUFQLENBQUEsTUFBQUUsT0FBQSxDQUFBTSxLQUFBO0lBQUFSLENBQUEsTUFBQUUsT0FBQSxDQUFBTyxJQUFBO0lBQUFULENBQUEsTUFBQVYsb0JBQUE7SUFBQVUsQ0FBQSxNQUFBTCxPQUFBO0lBQUFLLENBQUEsTUFBQVIsYUFBQTtJQUFBUSxDQUFBLE1BQUFHLEtBQUE7SUFBQUgsQ0FBQSxNQUFBTixLQUFBO0lBQUFNLENBQUEsTUFBQUssRUFBQTtJQUFBTCxDQUFBLE9BQUFNLEVBQUE7RUFBQTtJQUFBRCxFQUFBLEdBQUFMLENBQUE7SUFBQU0sRUFBQSxHQUFBTixDQUFBO0VBQUE7RUFBQSxJQUFBTSxFQUFBLEtBQUFJLE1BQUEsQ0FBQUMsR0FBQTtJQUFBLE9BQUFMLEVBQUE7RUFBQTtFQUFBLE9BM0JORCxFQTJCTTtBQUFBO0FBSVYsT0FBTyxTQUFTeUMsMEJBQTBCQSxDQUFDO0VBQ3pDekQsT0FBTztFQUNQQyxvQkFBb0I7RUFDcEJFLGFBQWE7RUFDYkMsT0FBTztFQUNQQyxLQUFLO0VBQ0xDLE9BQU87RUFDUEU7QUFDSyxDQUFOLEVBQUVULEtBQUssQ0FBQyxFQUFFM0IsS0FBSyxDQUFDc0YsU0FBUyxDQUFDO0VBQ3pCLE1BQU0zQyxFQUFFLEdBQUd0QixvQkFBb0IsQ0FBQyxDQUFDO0VBQ2pDLE1BQU07SUFDSmtFLFdBQVcsRUFBRUMsY0FBYztJQUMzQkMsU0FBUyxFQUFFQyxZQUFZO0lBQ3ZCQyxTQUFTLEVBQUVDLFlBQVk7SUFDdkJDLFNBQVM7SUFDVEMsaUJBQWlCO0lBQ2pCQyxlQUFlO0lBQ2ZDLGdCQUFnQjtJQUNoQkMsUUFBUSxFQUFFQztFQUNaLENBQUMsR0FBR3RFLE9BQU87RUFDWCxNQUFNLENBQUNjLEtBQUssQ0FBQyxHQUFHcEMsUUFBUSxDQUFDLENBQUM7RUFDMUIsTUFBTTZGLFVBQVUsR0FBR3RGLCtCQUErQixDQUFDZSxPQUFPLENBQUM7RUFDM0QsTUFBTXdFLFFBQVEsR0FBR0QsVUFBVSxDQUFDRSxJQUFJLENBQUN2RCxFQUFFLElBQUlaLE9BQU8sQ0FBQ3dCLGlCQUFpQixDQUFDSCxHQUFHLENBQUNULEVBQUUsQ0FBQyxDQUFDO0VBQ3pFLE1BQU13RCxZQUFZLEdBQ2hCUixpQkFBaUIsR0FBRyxDQUFDLElBQUlDLGVBQWUsR0FBRyxDQUFDLElBQUlDLGdCQUFnQixHQUFHLENBQUM7RUFDdEUsTUFBTU8sZ0JBQWdCLEdBQUd6RyxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQ3ZDMEIsZ0JBQWdCLENBQUMsQ0FBQ2dGLGtCQUFrQixDQUFDNUUsT0FBTyxDQUFDLEdBQzdDLEtBQUs7O0VBRVQ7RUFDQTtFQUNBO0VBQ0EsTUFBTTZFLGVBQWUsR0FBR3hHLE1BQU0sQ0FBQyxDQUFDLENBQUM7RUFDakMsTUFBTXlHLGlCQUFpQixHQUFHekcsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUNuQyxNQUFNMEcsZUFBZSxHQUFHMUcsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUNqQyxNQUFNMkcsY0FBYyxHQUFHM0csTUFBTSxDQUFDLENBQUMsQ0FBQztFQUNoQyxNQUFNNEcsZUFBZSxHQUFHNUcsTUFBTSxDQUFDLENBQUMsQ0FBQztFQUNqQ3dHLGVBQWUsQ0FBQ0ssT0FBTyxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FBQ1AsZUFBZSxDQUFDSyxPQUFPLEVBQUVwQixZQUFZLENBQUM7RUFDekVnQixpQkFBaUIsQ0FBQ0ksT0FBTyxHQUFHQyxJQUFJLENBQUNDLEdBQUcsQ0FDbENOLGlCQUFpQixDQUFDSSxPQUFPLEVBQ3pCdEIsY0FDRixDQUFDO0VBQ0RtQixlQUFlLENBQUNHLE9BQU8sR0FBR0MsSUFBSSxDQUFDQyxHQUFHLENBQUNMLGVBQWUsQ0FBQ0csT0FBTyxFQUFFbEIsWUFBWSxDQUFDO0VBQ3pFZ0IsY0FBYyxDQUFDRSxPQUFPLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUMvQkosY0FBYyxDQUFDRSxPQUFPLEVBQ3RCbEYsT0FBTyxDQUFDcUYsWUFBWSxJQUFJLENBQzFCLENBQUM7RUFDREosZUFBZSxDQUFDQyxPQUFPLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUNoQ0gsZUFBZSxDQUFDQyxPQUFPLEVBQ3ZCbEYsT0FBTyxDQUFDc0YsU0FBUyxJQUFJLENBQ3ZCLENBQUM7RUFDRCxNQUFNekIsU0FBUyxHQUFHZ0IsZUFBZSxDQUFDSyxPQUFPO0VBQ3pDLE1BQU12QixXQUFXLEdBQUdtQixpQkFBaUIsQ0FBQ0ksT0FBTztFQUM3QyxNQUFNbkIsU0FBUyxHQUFHZ0IsZUFBZSxDQUFDRyxPQUFPO0VBQ3pDLE1BQU1HLFlBQVksR0FBR0wsY0FBYyxDQUFDRSxPQUFPO0VBQzNDO0VBQ0E7RUFDQTtFQUNBLE1BQU1LLGNBQWMsR0FBR3ZGLE9BQU8sQ0FBQ3VGLGNBQWMsSUFBSSxDQUFDO0VBQ2xELE1BQU1ELFNBQVMsR0FBR2pHLHNCQUFzQixDQUFDLENBQUMsR0FDdEM4RixJQUFJLENBQUNDLEdBQUcsQ0FBQyxDQUFDLEVBQUVILGVBQWUsQ0FBQ0MsT0FBTyxHQUFHSyxjQUFjLENBQUMsR0FDckQsQ0FBQztFQUVMLE1BQU1DLGVBQWUsR0FDbkI3QixXQUFXLEdBQUcsQ0FBQyxJQUNmRSxTQUFTLEdBQUcsQ0FBQyxJQUNiRSxTQUFTLEdBQUcsQ0FBQyxJQUNiRSxTQUFTLEdBQUcsQ0FBQyxJQUNib0IsWUFBWSxHQUFHLENBQUMsSUFDaEJDLFNBQVMsR0FBRyxDQUFDLElBQ2JDLGNBQWMsR0FBRyxDQUFDO0VBRXBCLE1BQU1FLFNBQVMsR0FBR3pGLE9BQU8sQ0FBQzBGLGFBQWE7RUFDdkMsTUFBTUMsVUFBVSxHQUFHM0YsT0FBTyxDQUFDMkYsVUFBVTtFQUNyQyxJQUFJQyxZQUFZLEdBQUc1RixPQUFPLENBQUM2RixpQkFBaUI7RUFDNUMsSUFBSUQsWUFBWSxLQUFLcEQsU0FBUyxFQUFFO0lBQzlCLE1BQU1zRCxhQUFhLEdBQUdILFVBQVUsRUFBRUksRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3hDLE1BQU1DLFVBQVUsR0FDZEYsYUFBYSxLQUFLdEQsU0FBUyxHQUFHLElBQUlzRCxhQUFhLEdBQUcsR0FBR3RELFNBQVM7SUFDaEUsTUFBTXlELFFBQVEsR0FBR1IsU0FBUyxFQUFFTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbENILFlBQVksR0FDVkssUUFBUSxLQUFLekQsU0FBUyxHQUFHdEQsY0FBYyxDQUFDK0csUUFBUSxDQUFDLEdBQUdELFVBQVU7RUFDbEU7O0VBRUE7RUFDQTtFQUNBO0VBQ0EsSUFBSXhGLGFBQWEsRUFBRTtJQUNqQixLQUFLLE1BQU1VLElBQUUsSUFBSXFELFVBQVUsRUFBRTtNQUMzQixJQUFJLENBQUN0RSxvQkFBb0IsQ0FBQzBCLEdBQUcsQ0FBQ1QsSUFBRSxDQUFDLEVBQUU7TUFDbkMsTUFBTWdGLE1BQU0sR0FBRzVGLE9BQU8sQ0FBQzZGLDJCQUEyQixDQUFDL0QsR0FBRyxDQUFDbEIsSUFBRSxDQUFDLEVBQUU2RSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRWpELElBQUk7TUFDeEUsSUFBSW9ELE1BQU0sRUFBRTVELElBQUksS0FBSyxnQkFBZ0IsSUFBSTRELE1BQU0sQ0FBQ0UsS0FBSyxLQUFLLE9BQU8sRUFBRTtRQUNqRSxNQUFNakYsS0FBSyxHQUFHK0UsTUFBTSxDQUFDRyxTQUFTLElBQUk7VUFDaENDLE9BQU8sQ0FBQyxFQUFFLE1BQU07VUFDaEJDLE9BQU8sQ0FBQyxFQUFFLE1BQU07VUFDaEJDLFNBQVMsQ0FBQyxFQUFFLE1BQU07UUFDcEIsQ0FBQztRQUNEWixZQUFZLEdBQ1Z6RSxLQUFLLENBQUNxRixTQUFTLEtBQ2RyRixLQUFLLENBQUNvRixPQUFPLEdBQUcsSUFBSXBGLEtBQUssQ0FBQ29GLE9BQU8sR0FBRyxHQUFHL0QsU0FBUyxDQUFDLElBQ2xEckIsS0FBSyxDQUFDbUYsT0FBTyxJQUNiSixNQUFNLENBQUNPLFFBQVE7TUFDbkI7SUFDRjtFQUNGO0VBRUEsTUFBTUMsYUFBYSxHQUFHcEksaUJBQWlCLENBQUNzSCxZQUFZLEVBQUU5RixtQkFBbUIsQ0FBQzs7RUFFMUU7RUFDQSxJQUFJTSxPQUFPLEVBQUU7SUFDWCxNQUFNdUcsUUFBUSxFQUFFNUgsMEJBQTBCLEVBQUUsR0FBRyxFQUFFO0lBQ2pELEtBQUssTUFBTTZILEdBQUcsSUFBSXRDLGFBQWEsRUFBRTtNQUMvQixJQUFJc0MsR0FBRyxDQUFDdEUsSUFBSSxLQUFLLFdBQVcsRUFBRTtRQUM1QnFFLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDRCxHQUFHLENBQUM7TUFDcEIsQ0FBQyxNQUFNLElBQUlBLEdBQUcsQ0FBQ3RFLElBQUksS0FBSyxrQkFBa0IsRUFBRTtRQUMxQ3FFLFFBQVEsQ0FBQ0UsSUFBSSxDQUFDLEdBQUdELEdBQUcsQ0FBQ3ZDLFFBQVEsQ0FBQztNQUNoQztJQUNGO0lBRUEsT0FDRSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtBQUNqQyxRQUFRLENBQUNzQyxRQUFRLENBQUNHLEdBQUcsQ0FBQ0YsS0FBRyxJQUFJO1FBQ25CLE1BQU0vRixPQUFPLEdBQUcrRixLQUFHLENBQUM1RyxPQUFPLENBQUNhLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDdEMsSUFBSUEsT0FBTyxFQUFFeUIsSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLElBQUk7UUFDN0MsT0FDRSxDQUFDLGNBQWMsQ0FDYixHQUFHLENBQUMsQ0FBQ3pCLE9BQU8sQ0FBQ0ssRUFBRSxDQUFDLENBQ2hCLE9BQU8sQ0FBQyxDQUFDTCxPQUFPLENBQUMsQ0FDakIsS0FBSyxDQUFDLENBQUNSLEtBQUssQ0FBQyxDQUNiLE9BQU8sQ0FBQyxDQUFDQyxPQUFPLENBQUMsQ0FDakIsb0JBQW9CLENBQUMsQ0FBQ0wsb0JBQW9CLENBQUMsQ0FDM0MsYUFBYSxDQUFDLENBQUNFLGFBQWEsQ0FBQyxDQUM3QixLQUFLLENBQUMsQ0FBQ1csS0FBSyxDQUFDLEdBQ2I7TUFFTixDQUFDLENBQUM7QUFDVixRQUFRLENBQUNkLE9BQU8sQ0FBQytHLFNBQVMsSUFBSS9HLE9BQU8sQ0FBQytHLFNBQVMsQ0FBQ0MsTUFBTSxHQUFHLENBQUMsSUFDaEQ7QUFDVixZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVE7QUFDMUIsY0FBYyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUNoSCxPQUFPLENBQUNpSCxTQUFTLENBQUMsV0FBVyxDQUFDLEdBQUc7QUFDN0QsY0FBYyxDQUFDakgsT0FBTyxDQUFDaUgsU0FBUyxLQUFLLENBQUMsR0FBRyxNQUFNLEdBQUcsT0FBTyxDQUFDO0FBQzFELGNBQWMsQ0FBQzdILGtCQUFrQixDQUFDWSxPQUFPLENBQUNrSCxXQUFXLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDNUQsWUFBWSxFQUFFLElBQUk7QUFDbEIsWUFBWSxDQUFDbEgsT0FBTyxDQUFDK0csU0FBUyxDQUFDRCxHQUFHLENBQUMsQ0FBQ0ssSUFBSSxFQUFFQyxHQUFHLEtBQy9CLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVFBLEdBQUcsRUFBRSxDQUFDLENBQUMsUUFBUTtBQUNoRCxnQkFBZ0IsQ0FBQyxTQUFTO0FBQzFCLGdCQUFnQixDQUFDRCxJQUFJLENBQUNiLE9BQU8sQ0FBQyxFQUFFLENBQUNsSCxrQkFBa0IsQ0FBQytILElBQUksQ0FBQ0UsVUFBVSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzFFLGNBQWMsRUFBRSxJQUFJLENBQ1AsQ0FBQztBQUNkLFVBQVUsR0FDRDtBQUNULFFBQVEsQ0FBQ3JILE9BQU8sQ0FBQ3NILGdCQUFnQixFQUFFUixHQUFHLENBQUNTLENBQUMsSUFDOUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUNBLENBQUMsQ0FBQ0MsSUFBSSxDQUFDLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEUsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRO0FBQzFCLGNBQWMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDckosUUFBUSxDQUFDb0osQ0FBQyxDQUFDQyxJQUFJLENBQUM7QUFDakQsWUFBWSxFQUFFLElBQUk7QUFDbEIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsY0FBYyxDQUFDLElBQUk7QUFDbkIsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUNELENBQUMsQ0FBQzFHLE9BQU8sQ0FBQyxFQUFFLElBQUk7QUFDdkMsY0FBYyxFQUFFLElBQUk7QUFDcEIsWUFBWSxFQUFFLEdBQUc7QUFDakIsVUFBVSxFQUFFLEdBQUcsQ0FDTixDQUFDO0FBQ1YsTUFBTSxFQUFFLEdBQUcsQ0FBQztFQUVWOztFQUVBO0VBQ0E7O0VBRUE7RUFDQTtFQUNBLElBQUksQ0FBQzZELFlBQVksSUFBSSxDQUFDQyxnQkFBZ0IsSUFBSSxDQUFDYSxlQUFlLEVBQUU7SUFDMUQsT0FBTyxJQUFJO0VBQ2I7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQSxJQUFJaUMsbUJBQW1CLEdBQUcsRUFBRTtFQUM1QixJQUFJcEksc0JBQXNCLENBQUMsQ0FBQyxJQUFJbUIsYUFBYSxFQUFFO0lBQzdDLElBQUlrSCxPQUFPLEVBQUUsTUFBTSxHQUFHLFNBQVM7SUFDL0IsSUFBSUMsS0FBSyxHQUFHLENBQUM7SUFDYixLQUFLLE1BQU16RyxJQUFFLElBQUlxRCxVQUFVLEVBQUU7TUFDM0IsSUFBSSxDQUFDdEUsb0JBQW9CLENBQUMwQixHQUFHLENBQUNULElBQUUsQ0FBQyxFQUFFO01BQ25DLE1BQU00QixJQUFJLEdBQUd4QyxPQUFPLENBQUM2RiwyQkFBMkIsQ0FBQy9ELEdBQUcsQ0FBQ2xCLElBQUUsQ0FBQyxFQUFFNkUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUVqRCxJQUFJO01BQ3RFLElBQ0VBLElBQUksRUFBRVIsSUFBSSxLQUFLLGVBQWUsSUFDOUJRLElBQUksRUFBRVIsSUFBSSxLQUFLLHFCQUFxQixFQUNwQztRQUNBO01BQ0Y7TUFDQSxJQUFJb0YsT0FBTyxLQUFLbEYsU0FBUyxJQUFJTSxJQUFJLENBQUM4RSxrQkFBa0IsR0FBR0YsT0FBTyxFQUFFO1FBQzlEQSxPQUFPLEdBQUc1RSxJQUFJLENBQUM4RSxrQkFBa0I7UUFDakNELEtBQUssR0FBRzdFLElBQUksQ0FBQytFLFVBQVU7TUFDekI7SUFDRjtJQUNBLElBQUlILE9BQU8sS0FBS2xGLFNBQVMsSUFBSWtGLE9BQU8sSUFBSSxDQUFDLEVBQUU7TUFDekMsTUFBTUksSUFBSSxHQUFHM0ksY0FBYyxDQUFDdUksT0FBTyxHQUFHLElBQUksQ0FBQztNQUMzQ0QsbUJBQW1CLEdBQ2pCRSxLQUFLLEdBQUcsQ0FBQyxHQUNMLEtBQUtHLElBQUksTUFBTUgsS0FBSyxJQUFJQSxLQUFLLEtBQUssQ0FBQyxHQUFHLE1BQU0sR0FBRyxPQUFPLEdBQUcsR0FDekQsS0FBS0csSUFBSSxHQUFHO0lBQ3BCO0VBQ0Y7O0VBRUE7RUFDQTtFQUNBLE1BQU1DLFdBQVcsRUFBRTNKLEtBQUssQ0FBQ3NGLFNBQVMsRUFBRSxHQUFHLEVBQUU7O0VBRXpDO0VBQ0EsU0FBU3NFLFFBQVFBLENBQUNDLEdBQUcsRUFBRSxNQUFNLEVBQUVDLElBQUksRUFBRSxNQUFNLEVBQUVDLElBQUksRUFBRS9KLEtBQUssQ0FBQ3NGLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQztJQUN4RSxNQUFNMEUsT0FBTyxHQUFHTCxXQUFXLENBQUNmLE1BQU0sS0FBSyxDQUFDO0lBQ3hDLElBQUksQ0FBQ29CLE9BQU8sRUFBRUwsV0FBVyxDQUFDbEIsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFNBQVNvQixHQUFHLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwRUYsV0FBVyxDQUFDbEIsSUFBSSxDQUNkLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDb0IsR0FBRyxDQUFDO0FBQ3JCLFFBQVEsQ0FBQ0csT0FBTyxHQUFHRixJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQ0csV0FBVyxDQUFDLENBQUMsR0FBR0gsSUFBSSxDQUFDSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUdKLElBQUksQ0FBQyxDQUFDLENBQUNDLElBQUk7QUFDdkUsTUFBTSxFQUFFLElBQUksQ0FDUixDQUFDO0VBQ0g7RUFDQSxJQUFJOUksc0JBQXNCLENBQUMsQ0FBQyxJQUFJVyxPQUFPLENBQUN1SSxPQUFPLEVBQUV2QixNQUFNLEVBQUU7SUFDdkQsTUFBTXdCLE1BQU0sR0FBRztNQUNiQyxTQUFTLEVBQUUsV0FBVztNQUN0QkMsT0FBTyxFQUFFLGdCQUFnQjtNQUN6QixlQUFlLEVBQUU7SUFDbkIsQ0FBQztJQUNELEtBQUssTUFBTUMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUMsSUFBSUMsS0FBSyxFQUFFO01BQ3JFLE1BQU1DLElBQUksR0FBRzdJLE9BQU8sQ0FBQ3VJLE9BQU8sQ0FBQ08sTUFBTSxDQUFDQyxDQUFDLElBQUlBLENBQUMsQ0FBQ0osSUFBSSxLQUFLQSxJQUFJLENBQUMsQ0FBQzdCLEdBQUcsQ0FBQ2lDLEdBQUMsSUFBSUEsR0FBQyxDQUFDQyxHQUFHLENBQUM7TUFDekUsSUFBSUgsSUFBSSxDQUFDN0IsTUFBTSxFQUFFO1FBQ2ZnQixRQUFRLENBQUNXLElBQUksRUFBRUgsTUFBTSxDQUFDRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQ0UsSUFBSSxDQUFDSSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztNQUNuRTtJQUNGO0VBQ0Y7RUFDQSxJQUFJNUosc0JBQXNCLENBQUMsQ0FBQyxJQUFJVyxPQUFPLENBQUNrSixNQUFNLEVBQUVsQyxNQUFNLEVBQUU7SUFDdEQsTUFBTW1DLFFBQVEsR0FBR25LLElBQUksQ0FBQ2dCLE9BQU8sQ0FBQ2tKLE1BQU0sQ0FBQ3BDLEdBQUcsQ0FBQ3NDLENBQUMsSUFBSUEsQ0FBQyxDQUFDQyxNQUFNLENBQUMsQ0FBQztJQUN4RHJCLFFBQVEsQ0FBQyxNQUFNLEVBQUUsV0FBVyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDbUIsUUFBUSxDQUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztFQUN4RTtFQUNBLElBQUk1SixzQkFBc0IsQ0FBQyxDQUFDLElBQUlXLE9BQU8sQ0FBQ21KLFFBQVEsRUFBRW5DLE1BQU0sRUFBRTtJQUN4RCxNQUFNc0MsUUFBUSxHQUFHO01BQUVDLE1BQU0sRUFBRSxRQUFRO01BQUVDLE9BQU8sRUFBRTtJQUFlLENBQUM7SUFDOUQsS0FBSyxNQUFNQyxDQUFDLElBQUl6SixPQUFPLENBQUNtSixRQUFRLEVBQUU7TUFDaENuQixRQUFRLENBQ04sTUFBTXlCLENBQUMsQ0FBQ0MsTUFBTSxJQUFJRCxDQUFDLENBQUNFLEdBQUcsRUFBRSxFQUN6QkwsUUFBUSxDQUFDRyxDQUFDLENBQUNDLE1BQU0sQ0FBQyxFQUNsQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQ0QsQ0FBQyxDQUFDRSxHQUFHLENBQUMsRUFBRSxJQUFJLENBQzFCLENBQUM7SUFDSDtFQUNGO0VBQ0EsSUFBSXRLLHNCQUFzQixDQUFDLENBQUMsSUFBSVcsT0FBTyxDQUFDNEosR0FBRyxFQUFFNUMsTUFBTSxFQUFFO0lBQ25ELE1BQU02QyxLQUFLLEdBQUc7TUFDWkMsT0FBTyxFQUFFLFNBQVM7TUFDbEJDLE1BQU0sRUFBRSxRQUFRO01BQ2hCUixNQUFNLEVBQUUsUUFBUTtNQUNoQlMsU0FBUyxFQUFFLGNBQWM7TUFDekJDLE1BQU0sRUFBRSxRQUFRO01BQ2hCQyxLQUFLLEVBQUU7SUFDVCxDQUFDO0lBQ0QsS0FBSyxNQUFNQyxFQUFFLElBQUluSyxPQUFPLENBQUM0SixHQUFHLEVBQUU7TUFDNUI1QixRQUFRLENBQ04sTUFBTW1DLEVBQUUsQ0FBQ1QsTUFBTSxJQUFJUyxFQUFFLENBQUNDLE1BQU0sRUFBRSxFQUM5QlAsS0FBSyxDQUFDTSxFQUFFLENBQUNULE1BQU0sQ0FBQyxFQUNoQlMsRUFBRSxDQUFDRSxHQUFHLEdBQ0osQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUNGLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUNELEVBQUUsQ0FBQ0UsR0FBRyxDQUFDLENBQUMsSUFBSSxHQUFHLEdBRWhELENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUNGLEVBQUUsQ0FBQ0MsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUVwQyxDQUFDO0lBQ0g7RUFDRjtFQUVBLElBQUl6RyxXQUFXLEdBQUcsQ0FBQyxFQUFFO0lBQ25CLE1BQU15RSxTQUFPLEdBQUdMLFdBQVcsQ0FBQ2YsTUFBTSxLQUFLLENBQUM7SUFDeEMsTUFBTXNELFVBQVUsR0FBRzlKLGFBQWEsR0FDNUI0SCxTQUFPLEdBQ0wsZUFBZSxHQUNmLGVBQWUsR0FDakJBLFNBQU8sR0FDTCxjQUFjLEdBQ2QsY0FBYztJQUNwQixJQUFJLENBQUNBLFNBQU8sRUFBRTtNQUNaTCxXQUFXLENBQUNsQixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDakQ7SUFDQWtCLFdBQVcsQ0FBQ2xCLElBQUksQ0FDZCxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUTtBQUN4QixRQUFRLENBQUN5RCxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzNHLFdBQVcsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUc7QUFDeEQsUUFBUSxDQUFDQSxXQUFXLEtBQUssQ0FBQyxHQUFHLFNBQVMsR0FBRyxVQUFVO0FBQ25ELE1BQU0sRUFBRSxJQUFJLENBQ1IsQ0FBQztFQUNIO0VBRUEsSUFBSUUsU0FBUyxHQUFHLENBQUMsRUFBRTtJQUNqQixNQUFNdUUsU0FBTyxHQUFHTCxXQUFXLENBQUNmLE1BQU0sS0FBSyxDQUFDO0lBQ3hDLE1BQU11RCxRQUFRLEdBQUcvSixhQUFhLEdBQzFCNEgsU0FBTyxHQUNMLFNBQVMsR0FDVCxTQUFTLEdBQ1hBLFNBQU8sR0FDTCxNQUFNLEdBQ04sTUFBTTtJQUNaLElBQUksQ0FBQ0EsU0FBTyxFQUFFO01BQ1pMLFdBQVcsQ0FBQ2xCLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqRDtJQUNBa0IsV0FBVyxDQUFDbEIsSUFBSSxDQUNkLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNO0FBQ3RCLFFBQVEsQ0FBQzBELFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDMUcsU0FBUyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsR0FBRztBQUNwRCxRQUFRLENBQUNBLFNBQVMsS0FBSyxDQUFDLEdBQUcsTUFBTSxHQUFHLE9BQU87QUFDM0MsTUFBTSxFQUFFLElBQUksQ0FDUixDQUFDO0VBQ0g7RUFFQSxJQUFJRSxTQUFTLEdBQUcsQ0FBQyxFQUFFO0lBQ2pCLE1BQU1xRSxTQUFPLEdBQUdMLFdBQVcsQ0FBQ2YsTUFBTSxLQUFLLENBQUM7SUFDeEMsTUFBTXdELFFBQVEsR0FBR2hLLGFBQWEsR0FDMUI0SCxTQUFPLEdBQ0wsU0FBUyxHQUNULFNBQVMsR0FDWEEsU0FBTyxHQUNMLFFBQVEsR0FDUixRQUFRO0lBQ2QsSUFBSSxDQUFDQSxTQUFPLEVBQUU7TUFDWkwsV0FBVyxDQUFDbEIsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ2pEO0lBQ0FrQixXQUFXLENBQUNsQixJQUFJLENBQ2QsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU07QUFDdEIsUUFBUSxDQUFDMkQsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUN6RyxTQUFTLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHO0FBQ3BELFFBQVEsQ0FBQ0EsU0FBUyxLQUFLLENBQUMsR0FBRyxXQUFXLEdBQUcsYUFBYTtBQUN0RCxNQUFNLEVBQUUsSUFBSSxDQUNSLENBQUM7RUFDSDtFQUVBLElBQUlFLFNBQVMsR0FBRyxDQUFDLEVBQUU7SUFDakIsTUFBTXdHLFFBQVEsR0FBR2pLLGFBQWEsR0FBRyxVQUFVLEdBQUcsUUFBUTtJQUN0RCxJQUFJdUgsV0FBVyxDQUFDZixNQUFNLEdBQUcsQ0FBQyxFQUFFO01BQzFCZSxXQUFXLENBQUNsQixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEQ7SUFDQWtCLFdBQVcsQ0FBQ2xCLElBQUksQ0FDZCxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUN0QixRQUFRLENBQUM0RCxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQ3hHLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUc7QUFDcEQsUUFBUSxDQUFDQSxTQUFTLEtBQUssQ0FBQyxHQUFHLE1BQU0sR0FBRyxPQUFPO0FBQzNDLE1BQU0sRUFBRSxJQUFJLENBQ1IsQ0FBQztFQUNIO0VBRUEsSUFBSW9CLFlBQVksR0FBRyxDQUFDLEVBQUU7SUFDcEIsTUFBTXFGLFdBQVcsR0FDZjFLLE9BQU8sQ0FBQzJLLGNBQWMsRUFDbEI3RCxHQUFHLENBQUM4RCxDQUFDLElBQUlBLENBQUMsQ0FBQ0MsT0FBTyxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUN4QzVCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLO0lBQ3hCLE1BQU1iLFNBQU8sR0FBR0wsV0FBVyxDQUFDZixNQUFNLEtBQUssQ0FBQztJQUN4QyxNQUFNa0IsTUFBSSxHQUFHMUgsYUFBYSxHQUN0QjRILFNBQU8sR0FDTCxVQUFVLEdBQ1YsVUFBVSxHQUNaQSxTQUFPLEdBQ0wsU0FBUyxHQUNULFNBQVM7SUFDZixJQUFJLENBQUNBLFNBQU8sRUFBRTtNQUNaTCxXQUFXLENBQUNsQixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDbkQ7SUFDQWtCLFdBQVcsQ0FBQ2xCLElBQUksQ0FDZCxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSztBQUNyQixRQUFRLENBQUNxQixNQUFJLENBQUMsQ0FBQyxDQUFDd0MsV0FBVztBQUMzQixRQUFRLENBQUNyRixZQUFZLEdBQUcsQ0FBQyxJQUNmO0FBQ1YsWUFBWSxDQUFDLEdBQUc7QUFDaEIsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQ0EsWUFBWSxDQUFDLEVBQUUsSUFBSSxDQUFDO0FBQzVDLFVBQVUsR0FDRDtBQUNULE1BQU0sRUFBRSxJQUFJLENBQ1IsQ0FBQztFQUNIO0VBRUEsSUFBSWhHLHNCQUFzQixDQUFDLENBQUMsSUFBSWlHLFNBQVMsR0FBRyxDQUFDLEVBQUU7SUFDN0MsTUFBTThDLFNBQU8sR0FBR0wsV0FBVyxDQUFDZixNQUFNLEtBQUssQ0FBQztJQUN4QyxNQUFNa0IsTUFBSSxHQUFHMUgsYUFBYSxHQUN0QjRILFNBQU8sR0FDTCxTQUFTLEdBQ1QsU0FBUyxHQUNYQSxTQUFPLEdBQ0wsS0FBSyxHQUNMLEtBQUs7SUFDWCxJQUFJLENBQUNBLFNBQU8sRUFBRTtNQUNaTCxXQUFXLENBQUNsQixJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEQ7SUFDQWtCLFdBQVcsQ0FBQ2xCLElBQUksQ0FDZCxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTTtBQUN0QixRQUFRLENBQUNxQixNQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQzVDLFNBQVMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRztBQUNyRCxRQUFRLENBQUNBLFNBQVMsS0FBSyxDQUFDLEdBQUcsU0FBUyxHQUFHLFVBQVU7QUFDakQsTUFBTSxFQUFFLElBQUksQ0FDUixDQUFDO0VBQ0g7O0VBRUE7RUFDQSxNQUFNd0Ysa0JBQWtCLEdBQUcvQyxXQUFXLENBQUNmLE1BQU0sR0FBRyxDQUFDO0VBQ2pELE1BQU0rRCxRQUFRLEVBQUUzTSxLQUFLLENBQUNzRixTQUFTLEVBQUUsR0FBRyxFQUFFO0VBRXRDLElBQUlTLGVBQWUsR0FBRyxDQUFDLEVBQUU7SUFDdkIsTUFBTWlFLFNBQU8sR0FBRyxDQUFDMEMsa0JBQWtCLElBQUlDLFFBQVEsQ0FBQy9ELE1BQU0sS0FBSyxDQUFDO0lBQzVELE1BQU1rQixNQUFJLEdBQUcxSCxhQUFhLEdBQ3RCNEgsU0FBTyxHQUNMLFdBQVcsR0FDWCxXQUFXLEdBQ2JBLFNBQU8sR0FDTCxVQUFVLEdBQ1YsVUFBVTtJQUNoQixJQUFJLENBQUNBLFNBQU8sRUFBRTtNQUNaMkMsUUFBUSxDQUFDbEUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DO0lBQ0FrRSxRQUFRLENBQUNsRSxJQUFJLENBQ1gsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVU7QUFDMUIsUUFBUSxDQUFDcUIsTUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMvRCxlQUFlLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxHQUFHO0FBQ3RELFFBQVEsQ0FBQ0EsZUFBZSxLQUFLLENBQUMsR0FBRyxRQUFRLEdBQUcsVUFBVTtBQUN0RCxNQUFNLEVBQUUsSUFBSSxDQUNSLENBQUM7RUFDSDtFQUVBLElBQUlELGlCQUFpQixHQUFHLENBQUMsRUFBRTtJQUN6QixNQUFNa0UsU0FBTyxHQUFHLENBQUMwQyxrQkFBa0IsSUFBSUMsUUFBUSxDQUFDL0QsTUFBTSxLQUFLLENBQUM7SUFDNUQsTUFBTWtCLE1BQUksR0FBRzFILGFBQWEsR0FDdEI0SCxTQUFPLEdBQ0wsV0FBVyxHQUNYLFdBQVcsR0FDYkEsU0FBTyxHQUNMLFVBQVUsR0FDVixVQUFVO0lBQ2hCLElBQUksQ0FBQ0EsU0FBTyxFQUFFO01BQ1oyQyxRQUFRLENBQUNsRSxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDL0M7SUFDQWtFLFFBQVEsQ0FBQ2xFLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBR3FCLE1BQUksV0FBVyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUM7RUFDbkU7RUFFQSxJQUFJOUQsZ0JBQWdCLEdBQUcsQ0FBQyxFQUFFO0lBQ3hCLE1BQU1nRSxTQUFPLEdBQUcsQ0FBQzBDLGtCQUFrQixJQUFJQyxRQUFRLENBQUMvRCxNQUFNLEtBQUssQ0FBQztJQUM1RCxNQUFNa0IsTUFBSSxHQUFHMUgsYUFBYSxHQUN0QjRILFNBQU8sR0FDTCxTQUFTLEdBQ1QsU0FBUyxHQUNYQSxTQUFPLEdBQ0wsT0FBTyxHQUNQLE9BQU87SUFDYixJQUFJLENBQUNBLFNBQU8sRUFBRTtNQUNaMkMsUUFBUSxDQUFDbEUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQy9DO0lBQ0FrRSxRQUFRLENBQUNsRSxJQUFJLENBQ1gsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVc7QUFDM0IsUUFBUSxDQUFDcUIsTUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM5RCxnQkFBZ0IsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEdBQUc7QUFDdkQsUUFBUSxDQUFDQSxnQkFBZ0IsS0FBSyxDQUFDLEdBQUcsUUFBUSxHQUFHLFVBQVU7QUFDdkQsTUFBTSxFQUFFLElBQUksQ0FDUixDQUFDO0VBQ0g7RUFFQSxPQUNFLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsZUFBZSxDQUFDLENBQUNyRCxFQUFFLENBQUM7QUFDbEUsTUFBTSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsS0FBSztBQUM5QixRQUFRLENBQUNQLGFBQWEsR0FDWixDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDZ0UsUUFBUSxDQUFDLEdBQUcsR0FFL0QsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQ2xCO0FBQ1QsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDaEUsYUFBYSxDQUFDO0FBQ3ZDLFVBQVUsQ0FBQ3VILFdBQVc7QUFDdEIsVUFBVSxDQUFDZ0QsUUFBUTtBQUNuQixVQUFVLENBQUM3TSxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQ2YwQixnQkFBZ0IsQ0FBQyxDQUFDb0wsaUJBQWlCLENBQUM7VUFDbENoTCxPQUFPO1VBQ1BRLGFBQWE7VUFDYnlLLGlCQUFpQixFQUFFSCxrQkFBa0IsSUFBSUMsUUFBUSxDQUFDL0QsTUFBTSxHQUFHO1FBQzdELENBQUMsQ0FBQyxHQUNGLElBQUk7QUFDbEIsVUFBVSxDQUFDeEcsYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhO0FBQ3pFLFFBQVEsRUFBRSxJQUFJO0FBQ2QsTUFBTSxFQUFFLEdBQUc7QUFDWCxNQUFNLENBQUNBLGFBQWEsSUFBSWtHLGFBQWEsS0FBS2xFLFNBQVM7SUFDM0M7SUFDQTtJQUNBO0lBQ0EsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEtBQUs7QUFDaEMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdkMsWUFBWSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxJQUFJO0FBQzFDLFVBQVUsRUFBRSxHQUFHO0FBQ2YsVUFBVSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNsRCxZQUFZLENBQUNrRSxhQUFhLENBQUN3RSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUNwRSxHQUFHLENBQUMsQ0FBQ3FFLElBQUksRUFBRUMsQ0FBQyxFQUFFQyxHQUFHLEtBQzFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVFELENBQUMsRUFBRSxDQUFDLENBQUMsUUFBUTtBQUM5QyxnQkFBZ0IsQ0FBQ0QsSUFBSTtBQUNyQixnQkFBZ0IsQ0FBQ0MsQ0FBQyxLQUFLQyxHQUFHLENBQUNyRSxNQUFNLEdBQUcsQ0FBQyxJQUFJUyxtQkFBbUI7QUFDNUQsY0FBYyxFQUFFLElBQUksQ0FDUCxDQUFDO0FBQ2QsVUFBVSxFQUFFLEdBQUc7QUFDZixRQUFRLEVBQUUsR0FBRyxDQUNOO0FBQ1AsTUFBTSxDQUFDekgsT0FBTyxDQUFDa0gsV0FBVyxLQUFLMUUsU0FBUyxJQUFJeEMsT0FBTyxDQUFDa0gsV0FBVyxHQUFHLENBQUMsSUFDM0QsQ0FBQyxJQUFJLENBQUMsUUFBUTtBQUN0QixVQUFVLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQ2xILE9BQU8sQ0FBQ2lILFNBQVMsQ0FBQyxXQUFXLENBQUMsR0FBRztBQUN6RCxVQUFVLENBQUNqSCxPQUFPLENBQUNpSCxTQUFTLEtBQUssQ0FBQyxHQUFHLE1BQU0sR0FBRyxPQUFPLENBQUM7QUFDdEQsVUFBVSxDQUFDN0gsa0JBQWtCLENBQUNZLE9BQU8sQ0FBQ2tILFdBQVcsQ0FBQyxDQUFDO0FBQ25ELFFBQVEsRUFBRSxJQUFJLENBQ1A7QUFDUCxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBRVYiLCJpZ25vcmVMaXN0IjpbXX0=