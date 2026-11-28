import { c as _c } from "react/compiler-runtime";
// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import React, { useMemo } from 'react';
import { Ansi, Box, Text } from '../../ink.js';
import type { Attachment } from 'src/utils/attachments.js';
import type { NullRenderingAttachmentType } from './nullRenderingAttachments.js';
import { useAppState } from '../../state/AppState.js';
import { getDisplayPath } from 'src/utils/file.js';
import { formatFileSize } from 'src/utils/format.js';
import { MessageResponse } from '../MessageResponse.js';
import { basename, sep } from 'path';
import { UserTextMessage } from './UserTextMessage.js';
import { DiagnosticsDisplay } from '../DiagnosticsDisplay.js';
import { getContentText } from 'src/utils/messages.js';
import type { Theme } from 'src/utils/theme.js';
import { UserImageMessage } from './UserImageMessage.js';
import { toInkColor } from '../../utils/ink.js';
import { jsonParse } from '../../utils/slowOperations.js';
import { plural } from '../../utils/stringUtils.js';
import { isEnvTruthy } from '../../utils/envUtils.js';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js';
import { tryRenderPlanApprovalMessage, formatTeammateMessageContent } from './PlanApprovalMessage.js';
import { BLACK_CIRCLE } from '../../constants/figures.js';
import { TeammateMessageContent } from './UserTeammateMessage.js';
import { isShutdownApproved } from '../../utils/teammateMailbox.js';
import { CtrlOToExpand } from '../CtrlOToExpand.js';
import { FilePathLink } from '../FilePathLink.js';
import { feature } from 'bun:bundle';
import { useSelectedMessageBg } from '../messageActions.js';
type Props = {
  addMargin: boolean;
  attachment: Attachment;
  verbose: boolean;
  isTranscriptMode?: boolean;
};
export function AttachmentMessage({
  attachment,
  addMargin,
  verbose,
  isTranscriptMode
}: Props): React.ReactNode {
  const bg = useSelectedMessageBg();
  // Hoisted to mount-time — per-message component, re-renders on every scroll.
  const isDemoEnv = feature('EXPERIMENTAL_SKILL_SEARCH') ?
  // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
  useMemo(() => isEnvTruthy(process.env.IS_DEMO), []) : false;
  // Handle teammate_mailbox BEFORE switch
  if (isAgentSwarmsEnabled() && attachment.type === 'teammate_mailbox') {
    // Filter out idle notifications BEFORE counting - they are hidden in the UI
    // so showing them in the count would be confusing ("2 messages in mailbox:" with nothing shown)
    const visibleMessages = attachment.messages.filter(msg => {
      if (isShutdownApproved(msg.text)) {
        return false;
      }
      try {
        const parsed = jsonParse(msg.text);
        return parsed?.type !== 'idle_notification' && parsed?.type !== 'teammate_terminated';
      } catch {
        return true; // Non-JSON messages are visible
      }
    });
    if (visibleMessages.length === 0) {
      return null;
    }
    return <Box flexDirection="column">
        {visibleMessages.map((msg_0, idx) => {
        // Try to parse as JSON for task_assignment messages
        let parsedMsg: {
          type?: string;
          taskId?: string;
          subject?: string;
          assignedBy?: string;
        } | null = null;
        try {
          parsedMsg = jsonParse(msg_0.text);
        } catch {
          // Not JSON, treat as plain text
        }
        if (parsedMsg?.type === 'task_assignment') {
          return <Box key={idx} paddingLeft={2}>
                <Text>{BLACK_CIRCLE} </Text>
                <Text>Task assigned: </Text>
                <Text bold>#{parsedMsg.taskId}</Text>
                <Text> - {parsedMsg.subject}</Text>
                <Text dimColor> (from {parsedMsg.assignedBy || msg_0.from})</Text>
              </Box>;
        }

        // Note: idle_notification messages already filtered out above

        // Try to render as plan approval message (request or response)
        const planApprovalElement = tryRenderPlanApprovalMessage(msg_0.text, msg_0.from);
        if (planApprovalElement) {
          return <React.Fragment key={idx}>{planApprovalElement}</React.Fragment>;
        }

        // Plain text message - sender header with chevron, truncated content
        const inkColor = toInkColor(msg_0.color);
        const formattedContent = formatTeammateMessageContent(msg_0.text) ?? msg_0.text;
        return <TeammateMessageContent key={idx} displayName={msg_0.from} inkColor={inkColor} content={formattedContent} summary={msg_0.summary} isTranscriptMode={isTranscriptMode} />;
      })}
      </Box>;
  }

  // skill_discovery rendered here (not in the switch) so the 'skill_discovery'
  // string literal stays inside a feature()-guarded block. A case label can't
  // be conditionally eliminated; an if-body can.
  if (feature('EXPERIMENTAL_SKILL_SEARCH')) {
    if (attachment.type === 'skill_discovery') {
      if (attachment.skills.length === 0) return null;
      // Ant users get shortIds inline so they can /skill-feedback while the
      // turn is still fresh. External users (when this un-gates) just see
      // names — shortId is undefined outside ant builds anyway.
      const names = attachment.skills.map(s => s.shortId ? `${s.name} [${s.shortId}]` : s.name).join(', ');
      const firstId = attachment.skills[0]?.shortId;
      const hint = "external" === 'ant' && !isDemoEnv && firstId ? ` · /skill-feedback ${firstId} 1=wrong 2=noisy 3=good [comment]` : '';
      return <Line>
          <Text bold>{attachment.skills.length}</Text> relevant{' '}
          {plural(attachment.skills.length, 'skill')}: {names}
          {hint && <Text dimColor>{hint}</Text>}
        </Line>;
    }
  }

  // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- teammate_mailbox/skill_discovery handled before switch
  switch (attachment.type) {
    case 'directory':
      return <Line>
          Listed directory <Text bold>{attachment.displayPath + sep}</Text>
        </Line>;
    case 'file':
    case 'already_read_file':
      if (attachment.content.type === 'notebook') {
        return <Line>
            Read <Text bold>{attachment.displayPath}</Text> (
            {attachment.content.file.cells.length} cells)
          </Line>;
      }
      if (attachment.content.type === 'file_unchanged') {
        return <Line>
            Read <Text bold>{attachment.displayPath}</Text> (unchanged)
          </Line>;
      }
      return <Line>
          Read <Text bold>{attachment.displayPath}</Text> (
          {attachment.content.type === 'text' ? `${attachment.content.file.numLines}${attachment.truncated ? '+' : ''} lines` : formatFileSize(attachment.content.file.originalSize)}
          )
        </Line>;
    case 'compact_file_reference':
      return <Line>
          Referenced file <Text bold>{attachment.displayPath}</Text>
        </Line>;
    case 'pdf_reference':
      return <Line>
          Referenced PDF <Text bold>{attachment.displayPath}</Text> (
          {attachment.pageCount} pages)
        </Line>;
    case 'selected_lines_in_ide':
      return <Line>
          ⧉ Selected{' '}
          <Text bold>{attachment.lineEnd - attachment.lineStart + 1}</Text>{' '}
          lines from <Text bold>{attachment.displayPath}</Text> in{' '}
          {attachment.ideName}
        </Line>;
    case 'nested_memory':
      return <Line>
          Loaded <Text bold>{attachment.displayPath}</Text>
        </Line>;
    case 'relevant_memories':
      // Usually absorbed into a CollapsedReadSearchGroup (collapseReadSearch.ts)
      // so this only renders when the preceding tool was non-collapsible (Edit,
      // Write) and no group was open. Match CollapsedReadSearchContent's style:
      // 2-space gutter, dim text, count only — filenames/content in ctrl+o.
      return <Box flexDirection="column" marginTop={addMargin ? 1 : 0} backgroundColor={bg}>
          <Box flexDirection="row">
            <Box minWidth={2} />
            <Text dimColor>
              Recalled <Text bold>{attachment.memories.length}</Text>{' '}
              {attachment.memories.length === 1 ? 'memory' : 'memories'}
              {!isTranscriptMode && <>
                  {' '}
                  <CtrlOToExpand />
                </>}
            </Text>
          </Box>
          {(verbose || isTranscriptMode) && attachment.memories.map(m => <Box key={m.path} flexDirection="column">
                <MessageResponse>
                  <Text dimColor>
                    <FilePathLink filePath={m.path}>
                      {basename(m.path)}
                    </FilePathLink>
                  </Text>
                </MessageResponse>
                {isTranscriptMode && <Box paddingLeft={5}>
                    <Text>
                      <Ansi>{m.content}</Ansi>
                    </Text>
                  </Box>}
              </Box>)}
        </Box>;
    case 'dynamic_skill':
      {
        const skillCount = attachment.skillNames.length;
        return <Line>
          Loaded{' '}
          <Text bold>
            {skillCount} {plural(skillCount, 'skill')}
          </Text>{' '}
          from <Text bold>{attachment.displayPath}</Text>
        </Line>;
      }
    case 'skill_listing':
      {
        if (attachment.isInitial) {
          return null;
        }
        return <Line>
          <Text bold>{attachment.skillCount}</Text>{' '}
          {plural(attachment.skillCount, 'skill')} available
        </Line>;
      }
    case 'agent_listing_delta':
      {
        if (attachment.isInitial || attachment.addedTypes.length === 0) {
          return null;
        }
        const count = attachment.addedTypes.length;
        return <Line>
          <Text bold>{count}</Text> agent {plural(count, 'type')} available
        </Line>;
      }
    case 'queued_command':
      {
        const text = typeof attachment.prompt === 'string' ? attachment.prompt : getContentText(attachment.prompt) || '';
        const hasImages = attachment.imagePasteIds && attachment.imagePasteIds.length > 0;
        return <Box flexDirection="column">
          <UserTextMessage addMargin={addMargin} param={{
            text,
            type: 'text'
          }} verbose={verbose} isTranscriptMode={isTranscriptMode} />
          {hasImages && attachment.imagePasteIds?.map(id => <UserImageMessage key={id} imageId={id} />)}
        </Box>;
      }
    case 'plan_file_reference':
      return <Line>
          Plan file referenced ({getDisplayPath(attachment.planFilePath)})
        </Line>;
    case 'invoked_skills':
      {
        if (attachment.skills.length === 0) {
          return null;
        }
        const skillNames = attachment.skills.map(s_0 => s_0.name).join(', ');
        return <Line>Skills restored ({skillNames})</Line>;
      }
    case 'diagnostics':
      return <DiagnosticsDisplay attachment={attachment} verbose={verbose} />;
    case 'mcp_resource':
      return <Line>
          Read MCP resource <Text bold>{attachment.name}</Text> from{' '}
          {attachment.server}
        </Line>;
    case 'command_permissions':
      // The skill success message is rendered by SkillTool's renderToolResultMessage,
      // so we don't render anything here to avoid duplicate messages.
      return null;
    case 'async_hook_response':
      {
        // SessionStart hook completions are only shown in verbose mode
        if (attachment.hookEvent === 'SessionStart' && !verbose) {
          return null;
        }
        // Generally hide async hook completion messages unless in verbose mode
        if (!verbose && !isTranscriptMode) {
          return null;
        }
        return <Line>
          Async hook <Text bold>{attachment.hookEvent}</Text> completed
        </Line>;
      }
    case 'hook_blocking_error':
      {
        // Stop hooks are rendered as a summary in SystemStopHookSummaryMessage
        if (attachment.hookEvent === 'Stop' || attachment.hookEvent === 'SubagentStop') {
          return null;
        }
        // Show stderr to the user so they can understand why the hook blocked
        const stderr = attachment.blockingError.blockingError.trim();
        return <>
          <Line color="error">
            {attachment.hookName} hook returned blocking error
          </Line>
          {stderr ? <Line color="error">{stderr}</Line> : null}
        </>;
      }
    case 'hook_non_blocking_error':
      {
        // Stop hooks are rendered as a summary in SystemStopHookSummaryMessage
        if (attachment.hookEvent === 'Stop' || attachment.hookEvent === 'SubagentStop') {
          return null;
        }
        // Full hook output is logged to debug log via hookEvents.ts
        return <Line color="error">{attachment.hookName} hook error</Line>;
      }
    case 'hook_error_during_execution':
      // Stop hooks are rendered as a summary in SystemStopHookSummaryMessage
      if (attachment.hookEvent === 'Stop' || attachment.hookEvent === 'SubagentStop') {
        return null;
      }
      // Full hook output is logged to debug log via hookEvents.ts
      return <Line>{attachment.hookName} hook warning</Line>;
    case 'hook_success':
      // Full hook output is logged to debug log via hookEvents.ts
      return null;
    case 'hook_stopped_continuation':
      // Stop hooks are rendered as a summary in SystemStopHookSummaryMessage
      if (attachment.hookEvent === 'Stop' || attachment.hookEvent === 'SubagentStop') {
        return null;
      }
      return <Line color="warning">
          {attachment.hookName} hook stopped continuation: {attachment.message}
        </Line>;
    case 'hook_system_message':
      return <Line>
          {attachment.hookName} says: {attachment.content}
        </Line>;
    case 'hook_permission_decision':
      {
        const action = attachment.decision === 'allow' ? 'Allowed' : 'Denied';
        return <Line>
          {action} by <Text bold>{attachment.hookEvent}</Text> hook
        </Line>;
      }
    case 'task_status':
      return <TaskStatusMessage attachment={attachment} />;
    case 'teammate_shutdown_batch':
      return <Box flexDirection="row" width="100%" marginTop={1} backgroundColor={bg}>
          <Text dimColor>{BLACK_CIRCLE} </Text>
          <Text dimColor>
            {attachment.count} {plural(attachment.count, 'teammate')} shut down
            gracefully
          </Text>
        </Box>;
    default:
      // Exhaustiveness: every type reaching here must be in NULL_RENDERING_TYPES.
      // If TS errors, a new Attachment type was added without a case above AND
      // without an entry in NULL_RENDERING_TYPES — decide: render something (add
      // a case) or render nothing (add to the array). Messages.tsx pre-filters
      // these so this branch is defense-in-depth for other render paths.
      //
      // skill_discovery and teammate_mailbox are handled BEFORE the switch in
      // runtime-gated blocks (feature() / isAgentSwarmsEnabled()) that TS can't
      // narrow through — excluded here via type union (compile-time only, no emit).
      attachment.type satisfies NullRenderingAttachmentType | 'skill_discovery' | 'teammate_mailbox';
      return null;
  }
}
type TaskStatusAttachment = Extract<Attachment, {
  type: 'task_status';
}>;
function TaskStatusMessage(t0) {
  const $ = _c(4);
  const {
    attachment
  } = t0;
  if (false && attachment.status === "killed") {
    return null;
  }
  if (isAgentSwarmsEnabled() && attachment.taskType === "in_process_teammate") {
    let t1;
    if ($[0] !== attachment) {
      t1 = <TeammateTaskStatus attachment={attachment} />;
      $[0] = attachment;
      $[1] = t1;
    } else {
      t1 = $[1];
    }
    return t1;
  }
  let t1;
  if ($[2] !== attachment) {
    t1 = <GenericTaskStatus attachment={attachment} />;
    $[2] = attachment;
    $[3] = t1;
  } else {
    t1 = $[3];
  }
  return t1;
}
function GenericTaskStatus(t0) {
  const $ = _c(9);
  const {
    attachment
  } = t0;
  const bg = useSelectedMessageBg();
  const statusText = attachment.status === "completed" ? "completed in background" : attachment.status === "killed" ? "stopped" : attachment.status === "running" ? "still running in background" : attachment.status;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <Text dimColor={true}>{BLACK_CIRCLE} </Text>;
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  let t2;
  if ($[1] !== attachment.description) {
    t2 = <Text bold={true}>{attachment.description}</Text>;
    $[1] = attachment.description;
    $[2] = t2;
  } else {
    t2 = $[2];
  }
  let t3;
  if ($[3] !== statusText || $[4] !== t2) {
    t3 = <Text dimColor={true}>Task "{t2}" {statusText}</Text>;
    $[3] = statusText;
    $[4] = t2;
    $[5] = t3;
  } else {
    t3 = $[5];
  }
  let t4;
  if ($[6] !== bg || $[7] !== t3) {
    t4 = <Box flexDirection="row" width="100%" marginTop={1} backgroundColor={bg}>{t1}{t3}</Box>;
    $[6] = bg;
    $[7] = t3;
    $[8] = t4;
  } else {
    t4 = $[8];
  }
  return t4;
}
function TeammateTaskStatus(t0) {
  const $ = _c(16);
  const {
    attachment
  } = t0;
  const bg = useSelectedMessageBg();
  let t1;
  if ($[0] !== attachment.taskId) {
    t1 = s => s.tasks[attachment.taskId];
    $[0] = attachment.taskId;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const task = useAppState(t1);
  if (task?.type !== "in_process_teammate") {
    let t2;
    if ($[2] !== attachment) {
      t2 = <GenericTaskStatus attachment={attachment} />;
      $[2] = attachment;
      $[3] = t2;
    } else {
      t2 = $[3];
    }
    return t2;
  }
  let t2;
  if ($[4] !== task.identity.color) {
    t2 = toInkColor(task.identity.color);
    $[4] = task.identity.color;
    $[5] = t2;
  } else {
    t2 = $[5];
  }
  const agentColor = t2;
  const statusText = attachment.status === "completed" ? "shut down gracefully" : attachment.status;
  let t3;
  if ($[6] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text dimColor={true}>{BLACK_CIRCLE} </Text>;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  let t4;
  if ($[7] !== agentColor || $[8] !== task.identity.agentName) {
    t4 = <Text color={agentColor} bold={true} dimColor={false}>@{task.identity.agentName}</Text>;
    $[7] = agentColor;
    $[8] = task.identity.agentName;
    $[9] = t4;
  } else {
    t4 = $[9];
  }
  let t5;
  if ($[10] !== statusText || $[11] !== t4) {
    t5 = <Text dimColor={true}>Teammate{" "}{t4}{" "}{statusText}</Text>;
    $[10] = statusText;
    $[11] = t4;
    $[12] = t5;
  } else {
    t5 = $[12];
  }
  let t6;
  if ($[13] !== bg || $[14] !== t5) {
    t6 = <Box flexDirection="row" width="100%" marginTop={1} backgroundColor={bg}>{t3}{t5}</Box>;
    $[13] = bg;
    $[14] = t5;
    $[15] = t6;
  } else {
    t6 = $[15];
  }
  return t6;
}
// We allow setting dimColor to false here to help work around the dim-bold bug.
// https://github.com/chalk/chalk/issues/290
function Line(t0) {
  const $ = _c(7);
  const {
    dimColor: t1,
    children,
    color
  } = t0;
  const dimColor = t1 === undefined ? true : t1;
  const bg = useSelectedMessageBg();
  let t2;
  if ($[0] !== children || $[1] !== color || $[2] !== dimColor) {
    t2 = <MessageResponse><Text color={color} dimColor={dimColor} wrap="wrap">{children}</Text></MessageResponse>;
    $[0] = children;
    $[1] = color;
    $[2] = dimColor;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] !== bg || $[5] !== t2) {
    t3 = <Box backgroundColor={bg}>{t2}</Box>;
    $[4] = bg;
    $[5] = t2;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  return t3;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJSZWFjdCIsInVzZU1lbW8iLCJBbnNpIiwiQm94IiwiVGV4dCIsIkF0dGFjaG1lbnQiLCJOdWxsUmVuZGVyaW5nQXR0YWNobWVudFR5cGUiLCJ1c2VBcHBTdGF0ZSIsImdldERpc3BsYXlQYXRoIiwiZm9ybWF0RmlsZVNpemUiLCJNZXNzYWdlUmVzcG9uc2UiLCJiYXNlbmFtZSIsInNlcCIsIlVzZXJUZXh0TWVzc2FnZSIsIkRpYWdub3N0aWNzRGlzcGxheSIsImdldENvbnRlbnRUZXh0IiwiVGhlbWUiLCJVc2VySW1hZ2VNZXNzYWdlIiwidG9JbmtDb2xvciIsImpzb25QYXJzZSIsInBsdXJhbCIsImlzRW52VHJ1dGh5IiwiaXNBZ2VudFN3YXJtc0VuYWJsZWQiLCJ0cnlSZW5kZXJQbGFuQXBwcm92YWxNZXNzYWdlIiwiZm9ybWF0VGVhbW1hdGVNZXNzYWdlQ29udGVudCIsIkJMQUNLX0NJUkNMRSIsIlRlYW1tYXRlTWVzc2FnZUNvbnRlbnQiLCJpc1NodXRkb3duQXBwcm92ZWQiLCJDdHJsT1RvRXhwYW5kIiwiRmlsZVBhdGhMaW5rIiwiZmVhdHVyZSIsInVzZVNlbGVjdGVkTWVzc2FnZUJnIiwiUHJvcHMiLCJhZGRNYXJnaW4iLCJhdHRhY2htZW50IiwidmVyYm9zZSIsImlzVHJhbnNjcmlwdE1vZGUiLCJBdHRhY2htZW50TWVzc2FnZSIsIlJlYWN0Tm9kZSIsImJnIiwiaXNEZW1vRW52IiwicHJvY2VzcyIsImVudiIsIklTX0RFTU8iLCJ0eXBlIiwidmlzaWJsZU1lc3NhZ2VzIiwibWVzc2FnZXMiLCJmaWx0ZXIiLCJtc2ciLCJ0ZXh0IiwicGFyc2VkIiwibGVuZ3RoIiwibWFwIiwiaWR4IiwicGFyc2VkTXNnIiwidGFza0lkIiwic3ViamVjdCIsImFzc2lnbmVkQnkiLCJmcm9tIiwicGxhbkFwcHJvdmFsRWxlbWVudCIsImlua0NvbG9yIiwiY29sb3IiLCJmb3JtYXR0ZWRDb250ZW50Iiwic3VtbWFyeSIsInNraWxscyIsIm5hbWVzIiwicyIsInNob3J0SWQiLCJuYW1lIiwiam9pbiIsImZpcnN0SWQiLCJoaW50IiwiZGlzcGxheVBhdGgiLCJjb250ZW50IiwiZmlsZSIsImNlbGxzIiwibnVtTGluZXMiLCJ0cnVuY2F0ZWQiLCJvcmlnaW5hbFNpemUiLCJwYWdlQ291bnQiLCJsaW5lRW5kIiwibGluZVN0YXJ0IiwiaWRlTmFtZSIsIm1lbW9yaWVzIiwibSIsInBhdGgiLCJza2lsbENvdW50Iiwic2tpbGxOYW1lcyIsImlzSW5pdGlhbCIsImFkZGVkVHlwZXMiLCJjb3VudCIsInByb21wdCIsImhhc0ltYWdlcyIsImltYWdlUGFzdGVJZHMiLCJpZCIsInBsYW5GaWxlUGF0aCIsInNlcnZlciIsImhvb2tFdmVudCIsInN0ZGVyciIsImJsb2NraW5nRXJyb3IiLCJ0cmltIiwiaG9va05hbWUiLCJtZXNzYWdlIiwiYWN0aW9uIiwiZGVjaXNpb24iLCJUYXNrU3RhdHVzQXR0YWNobWVudCIsIkV4dHJhY3QiLCJUYXNrU3RhdHVzTWVzc2FnZSIsInQwIiwiJCIsIl9jIiwic3RhdHVzIiwidGFza1R5cGUiLCJ0MSIsIkdlbmVyaWNUYXNrU3RhdHVzIiwic3RhdHVzVGV4dCIsIlN5bWJvbCIsImZvciIsInQyIiwiZGVzY3JpcHRpb24iLCJ0MyIsInQ0IiwiVGVhbW1hdGVUYXNrU3RhdHVzIiwidGFza3MiLCJ0YXNrIiwiaWRlbnRpdHkiLCJhZ2VudENvbG9yIiwiYWdlbnROYW1lIiwidDUiLCJ0NiIsIkxpbmUiLCJkaW1Db2xvciIsImNoaWxkcmVuIiwidW5kZWZpbmVkIl0sInNvdXJjZXMiOlsiQXR0YWNobWVudE1lc3NhZ2UudHN4Il0sInNvdXJjZXNDb250ZW50IjpbIi8vIGJpb21lLWlnbm9yZS1hbGwgYXNzaXN0L3NvdXJjZS9vcmdhbml6ZUltcG9ydHM6IEFOVC1PTkxZIGltcG9ydCBtYXJrZXJzIG11c3Qgbm90IGJlIHJlb3JkZXJlZFxuaW1wb3J0IFJlYWN0LCB7IHVzZU1lbW8gfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IEFuc2ksIEJveCwgVGV4dCB9IGZyb20gJy4uLy4uL2luay5qcydcbmltcG9ydCB0eXBlIHsgQXR0YWNobWVudCB9IGZyb20gJ3NyYy91dGlscy9hdHRhY2htZW50cy5qcydcbmltcG9ydCB0eXBlIHsgTnVsbFJlbmRlcmluZ0F0dGFjaG1lbnRUeXBlIH0gZnJvbSAnLi9udWxsUmVuZGVyaW5nQXR0YWNobWVudHMuanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSB9IGZyb20gJy4uLy4uL3N0YXRlL0FwcFN0YXRlLmpzJ1xuaW1wb3J0IHsgZ2V0RGlzcGxheVBhdGggfSBmcm9tICdzcmMvdXRpbHMvZmlsZS5qcydcbmltcG9ydCB7IGZvcm1hdEZpbGVTaXplIH0gZnJvbSAnc3JjL3V0aWxzL2Zvcm1hdC5qcydcbmltcG9ydCB7IE1lc3NhZ2VSZXNwb25zZSB9IGZyb20gJy4uL01lc3NhZ2VSZXNwb25zZS5qcydcbmltcG9ydCB7IGJhc2VuYW1lLCBzZXAgfSBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgVXNlclRleHRNZXNzYWdlIH0gZnJvbSAnLi9Vc2VyVGV4dE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBEaWFnbm9zdGljc0Rpc3BsYXkgfSBmcm9tICcuLi9EaWFnbm9zdGljc0Rpc3BsYXkuanMnXG5pbXBvcnQgeyBnZXRDb250ZW50VGV4dCB9IGZyb20gJ3NyYy91dGlscy9tZXNzYWdlcy5qcydcbmltcG9ydCB0eXBlIHsgVGhlbWUgfSBmcm9tICdzcmMvdXRpbHMvdGhlbWUuanMnXG5pbXBvcnQgeyBVc2VySW1hZ2VNZXNzYWdlIH0gZnJvbSAnLi9Vc2VySW1hZ2VNZXNzYWdlLmpzJ1xuaW1wb3J0IHsgdG9JbmtDb2xvciB9IGZyb20gJy4uLy4uL3V0aWxzL2luay5qcydcbmltcG9ydCB7IGpzb25QYXJzZSB9IGZyb20gJy4uLy4uL3V0aWxzL3Nsb3dPcGVyYXRpb25zLmpzJ1xuaW1wb3J0IHsgcGx1cmFsIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3RyaW5nVXRpbHMuanMnXG5pbXBvcnQgeyBpc0VudlRydXRoeSB9IGZyb20gJy4uLy4uL3V0aWxzL2VudlV0aWxzLmpzJ1xuaW1wb3J0IHsgaXNBZ2VudFN3YXJtc0VuYWJsZWQgfSBmcm9tICcuLi8uLi91dGlscy9hZ2VudFN3YXJtc0VuYWJsZWQuanMnXG5pbXBvcnQge1xuICB0cnlSZW5kZXJQbGFuQXBwcm92YWxNZXNzYWdlLFxuICBmb3JtYXRUZWFtbWF0ZU1lc3NhZ2VDb250ZW50LFxufSBmcm9tICcuL1BsYW5BcHByb3ZhbE1lc3NhZ2UuanMnXG5pbXBvcnQgeyBCTEFDS19DSVJDTEUgfSBmcm9tICcuLi8uLi9jb25zdGFudHMvZmlndXJlcy5qcydcbmltcG9ydCB7IFRlYW1tYXRlTWVzc2FnZUNvbnRlbnQgfSBmcm9tICcuL1VzZXJUZWFtbWF0ZU1lc3NhZ2UuanMnXG5pbXBvcnQgeyBpc1NodXRkb3duQXBwcm92ZWQgfSBmcm9tICcuLi8uLi91dGlscy90ZWFtbWF0ZU1haWxib3guanMnXG5pbXBvcnQgeyBDdHJsT1RvRXhwYW5kIH0gZnJvbSAnLi4vQ3RybE9Ub0V4cGFuZC5qcydcbmltcG9ydCB7IEZpbGVQYXRoTGluayB9IGZyb20gJy4uL0ZpbGVQYXRoTGluay5qcydcbmltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHsgdXNlU2VsZWN0ZWRNZXNzYWdlQmcgfSBmcm9tICcuLi9tZXNzYWdlQWN0aW9ucy5qcydcblxudHlwZSBQcm9wcyA9IHtcbiAgYWRkTWFyZ2luOiBib29sZWFuXG4gIGF0dGFjaG1lbnQ6IEF0dGFjaG1lbnRcbiAgdmVyYm9zZTogYm9vbGVhblxuICBpc1RyYW5zY3JpcHRNb2RlPzogYm9vbGVhblxufVxuXG5leHBvcnQgZnVuY3Rpb24gQXR0YWNobWVudE1lc3NhZ2Uoe1xuICBhdHRhY2htZW50LFxuICBhZGRNYXJnaW4sXG4gIHZlcmJvc2UsXG4gIGlzVHJhbnNjcmlwdE1vZGUsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGJnID0gdXNlU2VsZWN0ZWRNZXNzYWdlQmcoKVxuICAvLyBIb2lzdGVkIHRvIG1vdW50LXRpbWUg4oCUIHBlci1tZXNzYWdlIGNvbXBvbmVudCwgcmUtcmVuZGVycyBvbiBldmVyeSBzY3JvbGwuXG4gIGNvbnN0IGlzRGVtb0VudiA9IGZlYXR1cmUoJ0VYUEVSSU1FTlRBTF9TS0lMTF9TRUFSQ0gnKVxuICAgID8gLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3MvdXNlSG9va0F0VG9wTGV2ZWw6IGZlYXR1cmUoKSBpcyBhIGNvbXBpbGUtdGltZSBjb25zdGFudFxuICAgICAgdXNlTWVtbygoKSA9PiBpc0VudlRydXRoeShwcm9jZXNzLmVudi5JU19ERU1PKSwgW10pXG4gICAgOiBmYWxzZVxuICAvLyBIYW5kbGUgdGVhbW1hdGVfbWFpbGJveCBCRUZPUkUgc3dpdGNoXG4gIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIGF0dGFjaG1lbnQudHlwZSA9PT0gJ3RlYW1tYXRlX21haWxib3gnKSB7XG4gICAgLy8gRmlsdGVyIG91dCBpZGxlIG5vdGlmaWNhdGlvbnMgQkVGT1JFIGNvdW50aW5nIC0gdGhleSBhcmUgaGlkZGVuIGluIHRoZSBVSVxuICAgIC8vIHNvIHNob3dpbmcgdGhlbSBpbiB0aGUgY291bnQgd291bGQgYmUgY29uZnVzaW5nIChcIjIgbWVzc2FnZXMgaW4gbWFpbGJveDpcIiB3aXRoIG5vdGhpbmcgc2hvd24pXG4gICAgY29uc3QgdmlzaWJsZU1lc3NhZ2VzID0gYXR0YWNobWVudC5tZXNzYWdlcy5maWx0ZXIobXNnID0+IHtcbiAgICAgIGlmIChpc1NodXRkb3duQXBwcm92ZWQobXNnLnRleHQpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGFyc2VkID0ganNvblBhcnNlKG1zZy50ZXh0KVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIHBhcnNlZD8udHlwZSAhPT0gJ2lkbGVfbm90aWZpY2F0aW9uJyAmJlxuICAgICAgICAgIHBhcnNlZD8udHlwZSAhPT0gJ3RlYW1tYXRlX3Rlcm1pbmF0ZWQnXG4gICAgICAgIClcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gdHJ1ZSAvLyBOb24tSlNPTiBtZXNzYWdlcyBhcmUgdmlzaWJsZVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBpZiAodmlzaWJsZU1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICB7dmlzaWJsZU1lc3NhZ2VzLm1hcCgobXNnLCBpZHgpID0+IHtcbiAgICAgICAgICAvLyBUcnkgdG8gcGFyc2UgYXMgSlNPTiBmb3IgdGFza19hc3NpZ25tZW50IG1lc3NhZ2VzXG4gICAgICAgICAgbGV0IHBhcnNlZE1zZzoge1xuICAgICAgICAgICAgdHlwZT86IHN0cmluZ1xuICAgICAgICAgICAgdGFza0lkPzogc3RyaW5nXG4gICAgICAgICAgICBzdWJqZWN0Pzogc3RyaW5nXG4gICAgICAgICAgICBhc3NpZ25lZEJ5Pzogc3RyaW5nXG4gICAgICAgICAgfSB8IG51bGwgPSBudWxsXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHBhcnNlZE1zZyA9IGpzb25QYXJzZShtc2cudGV4dClcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIC8vIE5vdCBKU09OLCB0cmVhdCBhcyBwbGFpbiB0ZXh0XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHBhcnNlZE1zZz8udHlwZSA9PT0gJ3Rhc2tfYXNzaWdubWVudCcpIHtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxCb3gga2V5PXtpZHh9IHBhZGRpbmdMZWZ0PXsyfT5cbiAgICAgICAgICAgICAgICA8VGV4dD57QkxBQ0tfQ0lSQ0xFfSA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPFRleHQ+VGFzayBhc3NpZ25lZDogPC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGJvbGQ+I3twYXJzZWRNc2cudGFza0lkfTwvVGV4dD5cbiAgICAgICAgICAgICAgICA8VGV4dD4gLSB7cGFyc2VkTXNnLnN1YmplY3R9PC9UZXh0PlxuICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPiAoZnJvbSB7cGFyc2VkTXNnLmFzc2lnbmVkQnkgfHwgbXNnLmZyb219KTwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gTm90ZTogaWRsZV9ub3RpZmljYXRpb24gbWVzc2FnZXMgYWxyZWFkeSBmaWx0ZXJlZCBvdXQgYWJvdmVcblxuICAgICAgICAgIC8vIFRyeSB0byByZW5kZXIgYXMgcGxhbiBhcHByb3ZhbCBtZXNzYWdlIChyZXF1ZXN0IG9yIHJlc3BvbnNlKVxuICAgICAgICAgIGNvbnN0IHBsYW5BcHByb3ZhbEVsZW1lbnQgPSB0cnlSZW5kZXJQbGFuQXBwcm92YWxNZXNzYWdlKFxuICAgICAgICAgICAgbXNnLnRleHQsXG4gICAgICAgICAgICBtc2cuZnJvbSxcbiAgICAgICAgICApXG4gICAgICAgICAgaWYgKHBsYW5BcHByb3ZhbEVsZW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxSZWFjdC5GcmFnbWVudCBrZXk9e2lkeH0+e3BsYW5BcHByb3ZhbEVsZW1lbnR9PC9SZWFjdC5GcmFnbWVudD5cbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBQbGFpbiB0ZXh0IG1lc3NhZ2UgLSBzZW5kZXIgaGVhZGVyIHdpdGggY2hldnJvbiwgdHJ1bmNhdGVkIGNvbnRlbnRcbiAgICAgICAgICBjb25zdCBpbmtDb2xvciA9IHRvSW5rQ29sb3IobXNnLmNvbG9yKVxuICAgICAgICAgIGNvbnN0IGZvcm1hdHRlZENvbnRlbnQgPVxuICAgICAgICAgICAgZm9ybWF0VGVhbW1hdGVNZXNzYWdlQ29udGVudChtc2cudGV4dCkgPz8gbXNnLnRleHRcbiAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPFRlYW1tYXRlTWVzc2FnZUNvbnRlbnRcbiAgICAgICAgICAgICAga2V5PXtpZHh9XG4gICAgICAgICAgICAgIGRpc3BsYXlOYW1lPXttc2cuZnJvbX1cbiAgICAgICAgICAgICAgaW5rQ29sb3I9e2lua0NvbG9yfVxuICAgICAgICAgICAgICBjb250ZW50PXtmb3JtYXR0ZWRDb250ZW50fVxuICAgICAgICAgICAgICBzdW1tYXJ5PXttc2cuc3VtbWFyeX1cbiAgICAgICAgICAgICAgaXNUcmFuc2NyaXB0TW9kZT17aXNUcmFuc2NyaXB0TW9kZX1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgKVxuICAgICAgICB9KX1cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIC8vIHNraWxsX2Rpc2NvdmVyeSByZW5kZXJlZCBoZXJlIChub3QgaW4gdGhlIHN3aXRjaCkgc28gdGhlICdza2lsbF9kaXNjb3ZlcnknXG4gIC8vIHN0cmluZyBsaXRlcmFsIHN0YXlzIGluc2lkZSBhIGZlYXR1cmUoKS1ndWFyZGVkIGJsb2NrLiBBIGNhc2UgbGFiZWwgY2FuJ3RcbiAgLy8gYmUgY29uZGl0aW9uYWxseSBlbGltaW5hdGVkOyBhbiBpZi1ib2R5IGNhbi5cbiAgaWYgKGZlYXR1cmUoJ0VYUEVSSU1FTlRBTF9TS0lMTF9TRUFSQ0gnKSkge1xuICAgIGlmIChhdHRhY2htZW50LnR5cGUgPT09ICdza2lsbF9kaXNjb3ZlcnknKSB7XG4gICAgICBpZiAoYXR0YWNobWVudC5za2lsbHMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbFxuICAgICAgLy8gQW50IHVzZXJzIGdldCBzaG9ydElkcyBpbmxpbmUgc28gdGhleSBjYW4gL3NraWxsLWZlZWRiYWNrIHdoaWxlIHRoZVxuICAgICAgLy8gdHVybiBpcyBzdGlsbCBmcmVzaC4gRXh0ZXJuYWwgdXNlcnMgKHdoZW4gdGhpcyB1bi1nYXRlcykganVzdCBzZWVcbiAgICAgIC8vIG5hbWVzIOKAlCBzaG9ydElkIGlzIHVuZGVmaW5lZCBvdXRzaWRlIGFudCBidWlsZHMgYW55d2F5LlxuICAgICAgY29uc3QgbmFtZXMgPSBhdHRhY2htZW50LnNraWxsc1xuICAgICAgICAubWFwKHMgPT4gKHMuc2hvcnRJZCA/IGAke3MubmFtZX0gWyR7cy5zaG9ydElkfV1gIDogcy5uYW1lKSlcbiAgICAgICAgLmpvaW4oJywgJylcbiAgICAgIGNvbnN0IGZpcnN0SWQgPSBhdHRhY2htZW50LnNraWxsc1swXT8uc2hvcnRJZFxuICAgICAgY29uc3QgaGludCA9XG4gICAgICAgIFwiZXh0ZXJuYWxcIiA9PT0gJ2FudCcgJiYgIWlzRGVtb0VudiAmJiBmaXJzdElkXG4gICAgICAgICAgPyBgIMK3IC9za2lsbC1mZWVkYmFjayAke2ZpcnN0SWR9IDE9d3JvbmcgMj1ub2lzeSAzPWdvb2QgW2NvbW1lbnRdYFxuICAgICAgICAgIDogJydcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIDxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuc2tpbGxzLmxlbmd0aH08L1RleHQ+IHJlbGV2YW50eycgJ31cbiAgICAgICAgICB7cGx1cmFsKGF0dGFjaG1lbnQuc2tpbGxzLmxlbmd0aCwgJ3NraWxsJyl9OiB7bmFtZXN9XG4gICAgICAgICAge2hpbnQgJiYgPFRleHQgZGltQ29sb3I+e2hpbnR9PC9UZXh0Pn1cbiAgICAgICAgPC9MaW5lPlxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvc3dpdGNoLWV4aGF1c3RpdmVuZXNzLWNoZWNrIC0tIHRlYW1tYXRlX21haWxib3gvc2tpbGxfZGlzY292ZXJ5IGhhbmRsZWQgYmVmb3JlIHN3aXRjaFxuICBzd2l0Y2ggKGF0dGFjaG1lbnQudHlwZSkge1xuICAgIGNhc2UgJ2RpcmVjdG9yeSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8TGluZT5cbiAgICAgICAgICBMaXN0ZWQgZGlyZWN0b3J5IDxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuZGlzcGxheVBhdGggKyBzZXB9PC9UZXh0PlxuICAgICAgICA8L0xpbmU+XG4gICAgICApXG4gICAgY2FzZSAnZmlsZSc6XG4gICAgY2FzZSAnYWxyZWFkeV9yZWFkX2ZpbGUnOlxuICAgICAgaWYgKGF0dGFjaG1lbnQuY29udGVudC50eXBlID09PSAnbm90ZWJvb2snKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPExpbmU+XG4gICAgICAgICAgICBSZWFkIDxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuZGlzcGxheVBhdGh9PC9UZXh0PiAoXG4gICAgICAgICAgICB7YXR0YWNobWVudC5jb250ZW50LmZpbGUuY2VsbHMubGVuZ3RofSBjZWxscylcbiAgICAgICAgICA8L0xpbmU+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGlmIChhdHRhY2htZW50LmNvbnRlbnQudHlwZSA9PT0gJ2ZpbGVfdW5jaGFuZ2VkJykge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxMaW5lPlxuICAgICAgICAgICAgUmVhZCA8VGV4dCBib2xkPnthdHRhY2htZW50LmRpc3BsYXlQYXRofTwvVGV4dD4gKHVuY2hhbmdlZClcbiAgICAgICAgICA8L0xpbmU+XG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIFJlYWQgPFRleHQgYm9sZD57YXR0YWNobWVudC5kaXNwbGF5UGF0aH08L1RleHQ+IChcbiAgICAgICAgICB7YXR0YWNobWVudC5jb250ZW50LnR5cGUgPT09ICd0ZXh0J1xuICAgICAgICAgICAgPyBgJHthdHRhY2htZW50LmNvbnRlbnQuZmlsZS5udW1MaW5lc30ke2F0dGFjaG1lbnQudHJ1bmNhdGVkID8gJysnIDogJyd9IGxpbmVzYFxuICAgICAgICAgICAgOiBmb3JtYXRGaWxlU2l6ZShhdHRhY2htZW50LmNvbnRlbnQuZmlsZS5vcmlnaW5hbFNpemUpfVxuICAgICAgICAgIClcbiAgICAgICAgPC9MaW5lPlxuICAgICAgKVxuICAgIGNhc2UgJ2NvbXBhY3RfZmlsZV9yZWZlcmVuY2UnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPExpbmU+XG4gICAgICAgICAgUmVmZXJlbmNlZCBmaWxlIDxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuZGlzcGxheVBhdGh9PC9UZXh0PlxuICAgICAgICA8L0xpbmU+XG4gICAgICApXG4gICAgY2FzZSAncGRmX3JlZmVyZW5jZSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8TGluZT5cbiAgICAgICAgICBSZWZlcmVuY2VkIFBERiA8VGV4dCBib2xkPnthdHRhY2htZW50LmRpc3BsYXlQYXRofTwvVGV4dD4gKFxuICAgICAgICAgIHthdHRhY2htZW50LnBhZ2VDb3VudH0gcGFnZXMpXG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICBjYXNlICdzZWxlY3RlZF9saW5lc19pbl9pZGUnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPExpbmU+XG4gICAgICAgICAg4qeJIFNlbGVjdGVkeycgJ31cbiAgICAgICAgICA8VGV4dCBib2xkPnthdHRhY2htZW50LmxpbmVFbmQgLSBhdHRhY2htZW50LmxpbmVTdGFydCArIDF9PC9UZXh0PnsnICd9XG4gICAgICAgICAgbGluZXMgZnJvbSA8VGV4dCBib2xkPnthdHRhY2htZW50LmRpc3BsYXlQYXRofTwvVGV4dD4gaW57JyAnfVxuICAgICAgICAgIHthdHRhY2htZW50LmlkZU5hbWV9XG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICBjYXNlICduZXN0ZWRfbWVtb3J5JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIExvYWRlZCA8VGV4dCBib2xkPnthdHRhY2htZW50LmRpc3BsYXlQYXRofTwvVGV4dD5cbiAgICAgICAgPC9MaW5lPlxuICAgICAgKVxuICAgIGNhc2UgJ3JlbGV2YW50X21lbW9yaWVzJzpcbiAgICAgIC8vIFVzdWFsbHkgYWJzb3JiZWQgaW50byBhIENvbGxhcHNlZFJlYWRTZWFyY2hHcm91cCAoY29sbGFwc2VSZWFkU2VhcmNoLnRzKVxuICAgICAgLy8gc28gdGhpcyBvbmx5IHJlbmRlcnMgd2hlbiB0aGUgcHJlY2VkaW5nIHRvb2wgd2FzIG5vbi1jb2xsYXBzaWJsZSAoRWRpdCxcbiAgICAgIC8vIFdyaXRlKSBhbmQgbm8gZ3JvdXAgd2FzIG9wZW4uIE1hdGNoIENvbGxhcHNlZFJlYWRTZWFyY2hDb250ZW50J3Mgc3R5bGU6XG4gICAgICAvLyAyLXNwYWNlIGd1dHRlciwgZGltIHRleHQsIGNvdW50IG9ubHkg4oCUIGZpbGVuYW1lcy9jb250ZW50IGluIGN0cmwrby5cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwiY29sdW1uXCJcbiAgICAgICAgICBtYXJnaW5Ub3A9e2FkZE1hcmdpbiA/IDEgOiAwfVxuICAgICAgICAgIGJhY2tncm91bmRDb2xvcj17Ymd9XG4gICAgICAgID5cbiAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgICAgIDxCb3ggbWluV2lkdGg9ezJ9IC8+XG4gICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgUmVjYWxsZWQgPFRleHQgYm9sZD57YXR0YWNobWVudC5tZW1vcmllcy5sZW5ndGh9PC9UZXh0PnsnICd9XG4gICAgICAgICAgICAgIHthdHRhY2htZW50Lm1lbW9yaWVzLmxlbmd0aCA9PT0gMSA/ICdtZW1vcnknIDogJ21lbW9yaWVzJ31cbiAgICAgICAgICAgICAgeyFpc1RyYW5zY3JpcHRNb2RlICYmIChcbiAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgeycgJ31cbiAgICAgICAgICAgICAgICAgIDxDdHJsT1RvRXhwYW5kIC8+XG4gICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgeyh2ZXJib3NlIHx8IGlzVHJhbnNjcmlwdE1vZGUpICYmXG4gICAgICAgICAgICBhdHRhY2htZW50Lm1lbW9yaWVzLm1hcChtID0+IChcbiAgICAgICAgICAgICAgPEJveCBrZXk9e20ucGF0aH0gZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgIDxNZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj5cbiAgICAgICAgICAgICAgICAgICAgPEZpbGVQYXRoTGluayBmaWxlUGF0aD17bS5wYXRofT5cbiAgICAgICAgICAgICAgICAgICAgICB7YmFzZW5hbWUobS5wYXRoKX1cbiAgICAgICAgICAgICAgICAgICAgPC9GaWxlUGF0aExpbms+XG4gICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgPC9NZXNzYWdlUmVzcG9uc2U+XG4gICAgICAgICAgICAgICAge2lzVHJhbnNjcmlwdE1vZGUgJiYgKFxuICAgICAgICAgICAgICAgICAgPEJveCBwYWRkaW5nTGVmdD17NX0+XG4gICAgICAgICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgICAgICAgIDxBbnNpPnttLmNvbnRlbnR9PC9BbnNpPlxuICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICkpfVxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICBjYXNlICdkeW5hbWljX3NraWxsJzoge1xuICAgICAgY29uc3Qgc2tpbGxDb3VudCA9IGF0dGFjaG1lbnQuc2tpbGxOYW1lcy5sZW5ndGhcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIExvYWRlZHsnICd9XG4gICAgICAgICAgPFRleHQgYm9sZD5cbiAgICAgICAgICAgIHtza2lsbENvdW50fSB7cGx1cmFsKHNraWxsQ291bnQsICdza2lsbCcpfVxuICAgICAgICAgIDwvVGV4dD57JyAnfVxuICAgICAgICAgIGZyb20gPFRleHQgYm9sZD57YXR0YWNobWVudC5kaXNwbGF5UGF0aH08L1RleHQ+XG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAnc2tpbGxfbGlzdGluZyc6IHtcbiAgICAgIGlmIChhdHRhY2htZW50LmlzSW5pdGlhbCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPExpbmU+XG4gICAgICAgICAgPFRleHQgYm9sZD57YXR0YWNobWVudC5za2lsbENvdW50fTwvVGV4dD57JyAnfVxuICAgICAgICAgIHtwbHVyYWwoYXR0YWNobWVudC5za2lsbENvdW50LCAnc2tpbGwnKX0gYXZhaWxhYmxlXG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAnYWdlbnRfbGlzdGluZ19kZWx0YSc6IHtcbiAgICAgIGlmIChhdHRhY2htZW50LmlzSW5pdGlhbCB8fCBhdHRhY2htZW50LmFkZGVkVHlwZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICBjb25zdCBjb3VudCA9IGF0dGFjaG1lbnQuYWRkZWRUeXBlcy5sZW5ndGhcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIDxUZXh0IGJvbGQ+e2NvdW50fTwvVGV4dD4gYWdlbnQge3BsdXJhbChjb3VudCwgJ3R5cGUnKX0gYXZhaWxhYmxlXG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAncXVldWVkX2NvbW1hbmQnOiB7XG4gICAgICBjb25zdCB0ZXh0ID1cbiAgICAgICAgdHlwZW9mIGF0dGFjaG1lbnQucHJvbXB0ID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gYXR0YWNobWVudC5wcm9tcHRcbiAgICAgICAgICA6IGdldENvbnRlbnRUZXh0KGF0dGFjaG1lbnQucHJvbXB0KSB8fCAnJ1xuICAgICAgY29uc3QgaGFzSW1hZ2VzID1cbiAgICAgICAgYXR0YWNobWVudC5pbWFnZVBhc3RlSWRzICYmIGF0dGFjaG1lbnQuaW1hZ2VQYXN0ZUlkcy5sZW5ndGggPiAwXG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICA8VXNlclRleHRNZXNzYWdlXG4gICAgICAgICAgICBhZGRNYXJnaW49e2FkZE1hcmdpbn1cbiAgICAgICAgICAgIHBhcmFtPXt7IHRleHQsIHR5cGU6ICd0ZXh0JyB9fVxuICAgICAgICAgICAgdmVyYm9zZT17dmVyYm9zZX1cbiAgICAgICAgICAgIGlzVHJhbnNjcmlwdE1vZGU9e2lzVHJhbnNjcmlwdE1vZGV9XG4gICAgICAgICAgLz5cbiAgICAgICAgICB7aGFzSW1hZ2VzICYmXG4gICAgICAgICAgICBhdHRhY2htZW50LmltYWdlUGFzdGVJZHM/Lm1hcChpZCA9PiAoXG4gICAgICAgICAgICAgIDxVc2VySW1hZ2VNZXNzYWdlIGtleT17aWR9IGltYWdlSWQ9e2lkfSAvPlxuICAgICAgICAgICAgKSl9XG4gICAgICAgIDwvQm94PlxuICAgICAgKVxuICAgIH1cbiAgICBjYXNlICdwbGFuX2ZpbGVfcmVmZXJlbmNlJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lPlxuICAgICAgICAgIFBsYW4gZmlsZSByZWZlcmVuY2VkICh7Z2V0RGlzcGxheVBhdGgoYXR0YWNobWVudC5wbGFuRmlsZVBhdGgpfSlcbiAgICAgICAgPC9MaW5lPlxuICAgICAgKVxuICAgIGNhc2UgJ2ludm9rZWRfc2tpbGxzJzoge1xuICAgICAgaWYgKGF0dGFjaG1lbnQuc2tpbGxzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgfVxuICAgICAgY29uc3Qgc2tpbGxOYW1lcyA9IGF0dGFjaG1lbnQuc2tpbGxzLm1hcChzID0+IHMubmFtZSkuam9pbignLCAnKVxuICAgICAgcmV0dXJuIDxMaW5lPlNraWxscyByZXN0b3JlZCAoe3NraWxsTmFtZXN9KTwvTGluZT5cbiAgICB9XG4gICAgY2FzZSAnZGlhZ25vc3RpY3MnOlxuICAgICAgcmV0dXJuIDxEaWFnbm9zdGljc0Rpc3BsYXkgYXR0YWNobWVudD17YXR0YWNobWVudH0gdmVyYm9zZT17dmVyYm9zZX0gLz5cbiAgICBjYXNlICdtY3BfcmVzb3VyY2UnOlxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPExpbmU+XG4gICAgICAgICAgUmVhZCBNQ1AgcmVzb3VyY2UgPFRleHQgYm9sZD57YXR0YWNobWVudC5uYW1lfTwvVGV4dD4gZnJvbXsnICd9XG4gICAgICAgICAge2F0dGFjaG1lbnQuc2VydmVyfVxuICAgICAgICA8L0xpbmU+XG4gICAgICApXG4gICAgY2FzZSAnY29tbWFuZF9wZXJtaXNzaW9ucyc6XG4gICAgICAvLyBUaGUgc2tpbGwgc3VjY2VzcyBtZXNzYWdlIGlzIHJlbmRlcmVkIGJ5IFNraWxsVG9vbCdzIHJlbmRlclRvb2xSZXN1bHRNZXNzYWdlLFxuICAgICAgLy8gc28gd2UgZG9uJ3QgcmVuZGVyIGFueXRoaW5nIGhlcmUgdG8gYXZvaWQgZHVwbGljYXRlIG1lc3NhZ2VzLlxuICAgICAgcmV0dXJuIG51bGxcbiAgICBjYXNlICdhc3luY19ob29rX3Jlc3BvbnNlJzoge1xuICAgICAgLy8gU2Vzc2lvblN0YXJ0IGhvb2sgY29tcGxldGlvbnMgYXJlIG9ubHkgc2hvd24gaW4gdmVyYm9zZSBtb2RlXG4gICAgICBpZiAoYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTZXNzaW9uU3RhcnQnICYmICF2ZXJib3NlKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICAvLyBHZW5lcmFsbHkgaGlkZSBhc3luYyBob29rIGNvbXBsZXRpb24gbWVzc2FnZXMgdW5sZXNzIGluIHZlcmJvc2UgbW9kZVxuICAgICAgaWYgKCF2ZXJib3NlICYmICFpc1RyYW5zY3JpcHRNb2RlKSB7XG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8TGluZT5cbiAgICAgICAgICBBc3luYyBob29rIDxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuaG9va0V2ZW50fTwvVGV4dD4gY29tcGxldGVkXG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAnaG9va19ibG9ja2luZ19lcnJvcic6IHtcbiAgICAgIC8vIFN0b3AgaG9va3MgYXJlIHJlbmRlcmVkIGFzIGEgc3VtbWFyeSBpbiBTeXN0ZW1TdG9wSG9va1N1bW1hcnlNZXNzYWdlXG4gICAgICBpZiAoXG4gICAgICAgIGF0dGFjaG1lbnQuaG9va0V2ZW50ID09PSAnU3RvcCcgfHxcbiAgICAgICAgYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTdWJhZ2VudFN0b3AnXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIC8vIFNob3cgc3RkZXJyIHRvIHRoZSB1c2VyIHNvIHRoZXkgY2FuIHVuZGVyc3RhbmQgd2h5IHRoZSBob29rIGJsb2NrZWRcbiAgICAgIGNvbnN0IHN0ZGVyciA9IGF0dGFjaG1lbnQuYmxvY2tpbmdFcnJvci5ibG9ja2luZ0Vycm9yLnRyaW0oKVxuICAgICAgcmV0dXJuIChcbiAgICAgICAgPD5cbiAgICAgICAgICA8TGluZSBjb2xvcj1cImVycm9yXCI+XG4gICAgICAgICAgICB7YXR0YWNobWVudC5ob29rTmFtZX0gaG9vayByZXR1cm5lZCBibG9ja2luZyBlcnJvclxuICAgICAgICAgIDwvTGluZT5cbiAgICAgICAgICB7c3RkZXJyID8gPExpbmUgY29sb3I9XCJlcnJvclwiPntzdGRlcnJ9PC9MaW5lPiA6IG51bGx9XG4gICAgICAgIDwvPlxuICAgICAgKVxuICAgIH1cbiAgICBjYXNlICdob29rX25vbl9ibG9ja2luZ19lcnJvcic6IHtcbiAgICAgIC8vIFN0b3AgaG9va3MgYXJlIHJlbmRlcmVkIGFzIGEgc3VtbWFyeSBpbiBTeXN0ZW1TdG9wSG9va1N1bW1hcnlNZXNzYWdlXG4gICAgICBpZiAoXG4gICAgICAgIGF0dGFjaG1lbnQuaG9va0V2ZW50ID09PSAnU3RvcCcgfHxcbiAgICAgICAgYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTdWJhZ2VudFN0b3AnXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIC8vIEZ1bGwgaG9vayBvdXRwdXQgaXMgbG9nZ2VkIHRvIGRlYnVnIGxvZyB2aWEgaG9va0V2ZW50cy50c1xuICAgICAgcmV0dXJuIDxMaW5lIGNvbG9yPVwiZXJyb3JcIj57YXR0YWNobWVudC5ob29rTmFtZX0gaG9vayBlcnJvcjwvTGluZT5cbiAgICB9XG4gICAgY2FzZSAnaG9va19lcnJvcl9kdXJpbmdfZXhlY3V0aW9uJzpcbiAgICAgIC8vIFN0b3AgaG9va3MgYXJlIHJlbmRlcmVkIGFzIGEgc3VtbWFyeSBpbiBTeXN0ZW1TdG9wSG9va1N1bW1hcnlNZXNzYWdlXG4gICAgICBpZiAoXG4gICAgICAgIGF0dGFjaG1lbnQuaG9va0V2ZW50ID09PSAnU3RvcCcgfHxcbiAgICAgICAgYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTdWJhZ2VudFN0b3AnXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIC8vIEZ1bGwgaG9vayBvdXRwdXQgaXMgbG9nZ2VkIHRvIGRlYnVnIGxvZyB2aWEgaG9va0V2ZW50cy50c1xuICAgICAgcmV0dXJuIDxMaW5lPnthdHRhY2htZW50Lmhvb2tOYW1lfSBob29rIHdhcm5pbmc8L0xpbmU+XG4gICAgY2FzZSAnaG9va19zdWNjZXNzJzpcbiAgICAgIC8vIEZ1bGwgaG9vayBvdXRwdXQgaXMgbG9nZ2VkIHRvIGRlYnVnIGxvZyB2aWEgaG9va0V2ZW50cy50c1xuICAgICAgcmV0dXJuIG51bGxcbiAgICBjYXNlICdob29rX3N0b3BwZWRfY29udGludWF0aW9uJzpcbiAgICAgIC8vIFN0b3AgaG9va3MgYXJlIHJlbmRlcmVkIGFzIGEgc3VtbWFyeSBpbiBTeXN0ZW1TdG9wSG9va1N1bW1hcnlNZXNzYWdlXG4gICAgICBpZiAoXG4gICAgICAgIGF0dGFjaG1lbnQuaG9va0V2ZW50ID09PSAnU3RvcCcgfHxcbiAgICAgICAgYXR0YWNobWVudC5ob29rRXZlbnQgPT09ICdTdWJhZ2VudFN0b3AnXG4gICAgICApIHtcbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICAgIH1cbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxMaW5lIGNvbG9yPVwid2FybmluZ1wiPlxuICAgICAgICAgIHthdHRhY2htZW50Lmhvb2tOYW1lfSBob29rIHN0b3BwZWQgY29udGludWF0aW9uOiB7YXR0YWNobWVudC5tZXNzYWdlfVxuICAgICAgICA8L0xpbmU+XG4gICAgICApXG4gICAgY2FzZSAnaG9va19zeXN0ZW1fbWVzc2FnZSc6XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8TGluZT5cbiAgICAgICAgICB7YXR0YWNobWVudC5ob29rTmFtZX0gc2F5czoge2F0dGFjaG1lbnQuY29udGVudH1cbiAgICAgICAgPC9MaW5lPlxuICAgICAgKVxuICAgIGNhc2UgJ2hvb2tfcGVybWlzc2lvbl9kZWNpc2lvbic6IHtcbiAgICAgIGNvbnN0IGFjdGlvbiA9IGF0dGFjaG1lbnQuZGVjaXNpb24gPT09ICdhbGxvdycgPyAnQWxsb3dlZCcgOiAnRGVuaWVkJ1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgPExpbmU+XG4gICAgICAgICAge2FjdGlvbn0gYnkgPFRleHQgYm9sZD57YXR0YWNobWVudC5ob29rRXZlbnR9PC9UZXh0PiBob29rXG4gICAgICAgIDwvTGluZT5cbiAgICAgIClcbiAgICB9XG4gICAgY2FzZSAndGFza19zdGF0dXMnOlxuICAgICAgcmV0dXJuIDxUYXNrU3RhdHVzTWVzc2FnZSBhdHRhY2htZW50PXthdHRhY2htZW50fSAvPlxuICAgIGNhc2UgJ3RlYW1tYXRlX3NodXRkb3duX2JhdGNoJzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIDxCb3hcbiAgICAgICAgICBmbGV4RGlyZWN0aW9uPVwicm93XCJcbiAgICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgICAgIG1hcmdpblRvcD17MX1cbiAgICAgICAgICBiYWNrZ3JvdW5kQ29sb3I9e2JnfVxuICAgICAgICA+XG4gICAgICAgICAgPFRleHQgZGltQ29sb3I+e0JMQUNLX0NJUkNMRX0gPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICAgICAge2F0dGFjaG1lbnQuY291bnR9IHtwbHVyYWwoYXR0YWNobWVudC5jb3VudCwgJ3RlYW1tYXRlJyl9IHNodXQgZG93blxuICAgICAgICAgICAgZ3JhY2VmdWxseVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICApXG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIEV4aGF1c3RpdmVuZXNzOiBldmVyeSB0eXBlIHJlYWNoaW5nIGhlcmUgbXVzdCBiZSBpbiBOVUxMX1JFTkRFUklOR19UWVBFUy5cbiAgICAgIC8vIElmIFRTIGVycm9ycywgYSBuZXcgQXR0YWNobWVudCB0eXBlIHdhcyBhZGRlZCB3aXRob3V0IGEgY2FzZSBhYm92ZSBBTkRcbiAgICAgIC8vIHdpdGhvdXQgYW4gZW50cnkgaW4gTlVMTF9SRU5ERVJJTkdfVFlQRVMg4oCUIGRlY2lkZTogcmVuZGVyIHNvbWV0aGluZyAoYWRkXG4gICAgICAvLyBhIGNhc2UpIG9yIHJlbmRlciBub3RoaW5nIChhZGQgdG8gdGhlIGFycmF5KS4gTWVzc2FnZXMudHN4IHByZS1maWx0ZXJzXG4gICAgICAvLyB0aGVzZSBzbyB0aGlzIGJyYW5jaCBpcyBkZWZlbnNlLWluLWRlcHRoIGZvciBvdGhlciByZW5kZXIgcGF0aHMuXG4gICAgICAvL1xuICAgICAgLy8gc2tpbGxfZGlzY292ZXJ5IGFuZCB0ZWFtbWF0ZV9tYWlsYm94IGFyZSBoYW5kbGVkIEJFRk9SRSB0aGUgc3dpdGNoIGluXG4gICAgICAvLyBydW50aW1lLWdhdGVkIGJsb2NrcyAoZmVhdHVyZSgpIC8gaXNBZ2VudFN3YXJtc0VuYWJsZWQoKSkgdGhhdCBUUyBjYW4ndFxuICAgICAgLy8gbmFycm93IHRocm91Z2gg4oCUIGV4Y2x1ZGVkIGhlcmUgdmlhIHR5cGUgdW5pb24gKGNvbXBpbGUtdGltZSBvbmx5LCBubyBlbWl0KS5cbiAgICAgIGF0dGFjaG1lbnQudHlwZSBzYXRpc2ZpZXNcbiAgICAgICAgfCBOdWxsUmVuZGVyaW5nQXR0YWNobWVudFR5cGVcbiAgICAgICAgfCAnc2tpbGxfZGlzY292ZXJ5J1xuICAgICAgICB8ICd0ZWFtbWF0ZV9tYWlsYm94J1xuICAgICAgcmV0dXJuIG51bGxcbiAgfVxufVxuXG50eXBlIFRhc2tTdGF0dXNBdHRhY2htZW50ID0gRXh0cmFjdDxBdHRhY2htZW50LCB7IHR5cGU6ICd0YXNrX3N0YXR1cycgfT5cblxuZnVuY3Rpb24gVGFza1N0YXR1c01lc3NhZ2Uoe1xuICBhdHRhY2htZW50LFxufToge1xuICBhdHRhY2htZW50OiBUYXNrU3RhdHVzQXR0YWNobWVudFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIC8vIEZvciBhbnRzLCBraWxsZWQgdGFzayBzdGF0dXMgaXMgc2hvd24gaW4gdGhlIENvb3JkaW5hdG9yVGFza1BhbmVsLlxuICAvLyBEb24ndCByZW5kZXIgaXQgYWdhaW4gaW4gdGhlIGNoYXQuXG4gIGlmIChcImV4dGVybmFsXCIgPT09ICdhbnQnICYmIGF0dGFjaG1lbnQuc3RhdHVzID09PSAna2lsbGVkJykge1xuICAgIHJldHVybiBudWxsXG4gIH1cblxuICAvLyBPbmx5IGFjY2VzcyB0ZWFtbWF0ZS1zcGVjaWZpYyBjb2RlIHdoZW4gc3dhcm1zIGFyZSBlbmFibGVkLlxuICAvLyBUZWFtbWF0ZVRhc2tTdGF0dXMgc3Vic2NyaWJlcyB0byBBcHBTdGF0ZTsgYnkgZ2F0aW5nIHRoZSBtb3VudCB3ZVxuICAvLyBhdm9pZCBhZGRpbmcgYSBzdG9yZSBsaXN0ZW5lciBmb3IgZXZlcnkgbm9uLXRlYW1tYXRlIGF0dGFjaG1lbnQuXG4gIGlmIChpc0FnZW50U3dhcm1zRW5hYmxlZCgpICYmIGF0dGFjaG1lbnQudGFza1R5cGUgPT09ICdpbl9wcm9jZXNzX3RlYW1tYXRlJykge1xuICAgIHJldHVybiA8VGVhbW1hdGVUYXNrU3RhdHVzIGF0dGFjaG1lbnQ9e2F0dGFjaG1lbnR9IC8+XG4gIH1cblxuICByZXR1cm4gPEdlbmVyaWNUYXNrU3RhdHVzIGF0dGFjaG1lbnQ9e2F0dGFjaG1lbnR9IC8+XG59XG5cbmZ1bmN0aW9uIEdlbmVyaWNUYXNrU3RhdHVzKHtcbiAgYXR0YWNobWVudCxcbn06IHtcbiAgYXR0YWNobWVudDogVGFza1N0YXR1c0F0dGFjaG1lbnRcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBjb25zdCBiZyA9IHVzZVNlbGVjdGVkTWVzc2FnZUJnKClcbiAgY29uc3Qgc3RhdHVzVGV4dCA9XG4gICAgYXR0YWNobWVudC5zdGF0dXMgPT09ICdjb21wbGV0ZWQnXG4gICAgICA/ICdjb21wbGV0ZWQgaW4gYmFja2dyb3VuZCdcbiAgICAgIDogYXR0YWNobWVudC5zdGF0dXMgPT09ICdraWxsZWQnXG4gICAgICAgID8gJ3N0b3BwZWQnXG4gICAgICAgIDogYXR0YWNobWVudC5zdGF0dXMgPT09ICdydW5uaW5nJ1xuICAgICAgICAgID8gJ3N0aWxsIHJ1bm5pbmcgaW4gYmFja2dyb3VuZCdcbiAgICAgICAgICA6IGF0dGFjaG1lbnQuc3RhdHVzXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgd2lkdGg9XCIxMDAlXCIgbWFyZ2luVG9wPXsxfSBiYWNrZ3JvdW5kQ29sb3I9e2JnfT5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPntCTEFDS19DSVJDTEV9IDwvVGV4dD5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICBUYXNrICZxdW90OzxUZXh0IGJvbGQ+e2F0dGFjaG1lbnQuZGVzY3JpcHRpb259PC9UZXh0PiZxdW90OyB7c3RhdHVzVGV4dH1cbiAgICAgIDwvVGV4dD5cbiAgICA8L0JveD5cbiAgKVxufVxuXG5mdW5jdGlvbiBUZWFtbWF0ZVRhc2tTdGF0dXMoe1xuICBhdHRhY2htZW50LFxufToge1xuICBhdHRhY2htZW50OiBUYXNrU3RhdHVzQXR0YWNobWVudFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGJnID0gdXNlU2VsZWN0ZWRNZXNzYWdlQmcoKVxuICAvLyBOYXJyb3cgc2VsZWN0b3I6IG9ubHkgcmUtcmVuZGVyIHdoZW4gdGhpcyBzcGVjaWZpYyB0YXNrIGNoYW5nZXMuXG4gIGNvbnN0IHRhc2sgPSB1c2VBcHBTdGF0ZShzID0+IHMudGFza3NbYXR0YWNobWVudC50YXNrSWRdKVxuICBpZiAodGFzaz8udHlwZSAhPT0gJ2luX3Byb2Nlc3NfdGVhbW1hdGUnKSB7XG4gICAgLy8gRmFsbCB0aHJvdWdoIHRvIGdlbmVyaWMgcmVuZGVyaW5nICh0YXNrIG5vdCB5ZXQgaW4gc3RvcmUsIG9yIHdyb25nIHR5cGUpXG4gICAgcmV0dXJuIDxHZW5lcmljVGFza1N0YXR1cyBhdHRhY2htZW50PXthdHRhY2htZW50fSAvPlxuICB9XG4gIGNvbnN0IGFnZW50Q29sb3IgPSB0b0lua0NvbG9yKHRhc2suaWRlbnRpdHkuY29sb3IpXG4gIGNvbnN0IHN0YXR1c1RleHQgPVxuICAgIGF0dGFjaG1lbnQuc3RhdHVzID09PSAnY29tcGxldGVkJ1xuICAgICAgPyAnc2h1dCBkb3duIGdyYWNlZnVsbHknXG4gICAgICA6IGF0dGFjaG1lbnQuc3RhdHVzXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgd2lkdGg9XCIxMDAlXCIgbWFyZ2luVG9wPXsxfSBiYWNrZ3JvdW5kQ29sb3I9e2JnfT5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPntCTEFDS19DSVJDTEV9IDwvVGV4dD5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICBUZWFtbWF0ZXsnICd9XG4gICAgICAgIDxUZXh0IGNvbG9yPXthZ2VudENvbG9yfSBib2xkIGRpbUNvbG9yPXtmYWxzZX0+XG4gICAgICAgICAgQHt0YXNrLmlkZW50aXR5LmFnZW50TmFtZX1cbiAgICAgICAgPC9UZXh0PnsnICd9XG4gICAgICAgIHtzdGF0dXNUZXh0fVxuICAgICAgPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG4vLyBXZSBhbGxvdyBzZXR0aW5nIGRpbUNvbG9yIHRvIGZhbHNlIGhlcmUgdG8gaGVscCB3b3JrIGFyb3VuZCB0aGUgZGltLWJvbGQgYnVnLlxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2NoYWxrL2NoYWxrL2lzc3Vlcy8yOTBcbmZ1bmN0aW9uIExpbmUoe1xuICBkaW1Db2xvciA9IHRydWUsXG4gIGNoaWxkcmVuLFxuICBjb2xvcixcbn06IHtcbiAgZGltQ29sb3I/OiBib29sZWFuXG4gIGNoaWxkcmVuOiBSZWFjdC5SZWFjdE5vZGVcbiAgY29sb3I/OiBrZXlvZiBUaGVtZVxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGJnID0gdXNlU2VsZWN0ZWRNZXNzYWdlQmcoKVxuICByZXR1cm4gKFxuICAgIDxCb3ggYmFja2dyb3VuZENvbG9yPXtiZ30+XG4gICAgICA8TWVzc2FnZVJlc3BvbnNlPlxuICAgICAgICA8VGV4dCBjb2xvcj17Y29sb3J9IGRpbUNvbG9yPXtkaW1Db2xvcn0gd3JhcD1cIndyYXBcIj5cbiAgICAgICAgICB7Y2hpbGRyZW59XG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvTWVzc2FnZVJlc3BvbnNlPlxuICAgIDwvQm94PlxuICApXG59XG4iXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBLE9BQU9BLEtBQUssSUFBSUMsT0FBTyxRQUFRLE9BQU87QUFDdEMsU0FBU0MsSUFBSSxFQUFFQyxHQUFHLEVBQUVDLElBQUksUUFBUSxjQUFjO0FBQzlDLGNBQWNDLFVBQVUsUUFBUSwwQkFBMEI7QUFDMUQsY0FBY0MsMkJBQTJCLFFBQVEsK0JBQStCO0FBQ2hGLFNBQVNDLFdBQVcsUUFBUSx5QkFBeUI7QUFDckQsU0FBU0MsY0FBYyxRQUFR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