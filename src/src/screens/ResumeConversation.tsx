import { c as _c } from "react/compiler-runtime";
import { feature } from 'bun:bundle';
import { dirname } from 'path';
import React from 'react';
import { useTerminalSize } from 'src/hooks/useTerminalSize.js';
import { getOriginalCwd, switchSession } from '../bootstrap/state.js';
import type { Command } from '../commands.js';
import { LogSelector } from '../components/LogSelector.js';
import { Spinner } from '../components/Spinner.js';
import { restoreCostStateForSession } from '../cost-tracker.js';
import { setClipboard } from '../ink/termio/osc.js';
import { Box, Text } from '../ink.js';
import { useKeybinding } from '../keybindings/useKeybinding.js';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from '../services/analytics/index.js';
import type { MCPServerConnection, ScopedMcpServerConfig } from '../services/mcp/types.js';
import { useAppState, useSetAppState } from '../state/AppState.js';
import type { Tool } from '../Tool.js';
import type { AgentColorName } from '../tools/AgentTool/agentColorManager.js';
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js';
import { asSessionId } from '../types/ids.js';
import type { LogOption } from '../types/logs.js';
import type { Message } from '../types/message.js';
import { agenticSessionSearch } from '../utils/agenticSessionSearch.js';
import { renameRecordingForSession } from '../utils/asciicast.js';
import { updateSessionName } from '../utils/concurrentSessions.js';
import { loadConversationForResume } from '../utils/conversationRecovery.js';
import { checkCrossProjectResume } from '../utils/crossProjectResume.js';
import type { FileHistorySnapshot } from '../utils/fileHistory.js';
import { logError } from '../utils/log.js';
import { createSystemMessage } from '../utils/messages.js';
import { computeStandaloneAgentContext, restoreAgentFromSession, restoreWorktreeForResume } from '../utils/sessionRestore.js';
import { adoptResumedSessionFile, enrichLogs, isCustomTitleEnabled, loadAllProjectsMessageLogsProgressive, loadSameRepoMessageLogsProgressive, recordContentReplacement, resetSessionFilePointer, restoreSessionMetadata, type SessionLogResult } from '../utils/sessionStorage.js';
import type { ThinkingConfig } from '../utils/thinking.js';
import type { ContentReplacementRecord } from '../utils/toolResultStorage.js';
import { REPL } from './REPL.js';
function parsePrIdentifier(value: string): number | null {
  const directNumber = parseInt(value, 10);
  if (!isNaN(directNumber) && directNumber > 0) {
    return directNumber;
  }
  const urlMatch = value.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
  if (urlMatch?.[1]) {
    return parseInt(urlMatch[1], 10);
  }
  return null;
}
type Props = {
  commands: Command[];
  worktreePaths: string[];
  initialTools: Tool[];
  mcpClients?: MCPServerConnection[];
  dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>;
  debug: boolean;
  mainThreadAgentDefinition?: AgentDefinition;
  autoConnectIdeFlag?: boolean;
  strictMcpConfig?: boolean;
  systemPrompt?: string;
  appendSystemPrompt?: string;
  initialSearchQuery?: string;
  disableSlashCommands?: boolean;
  forkSession?: boolean;
  taskListId?: string;
  filterByPr?: boolean | number | string;
  thinkingConfig: ThinkingConfig;
  onTurnComplete?: (messages: Message[]) => void | Promise<void>;
};
export function ResumeConversation({
  commands,
  worktreePaths,
  initialTools,
  mcpClients,
  dynamicMcpConfig,
  debug,
  mainThreadAgentDefinition,
  autoConnectIdeFlag,
  strictMcpConfig = false,
  systemPrompt,
  appendSystemPrompt,
  initialSearchQuery,
  disableSlashCommands = false,
  forkSession,
  taskListId,
  filterByPr,
  thinkingConfig,
  onTurnComplete
}: Props): React.ReactNode {
  const {
    rows
  } = useTerminalSize();
  const agentDefinitions = useAppState(s => s.agentDefinitions);
  const setAppState = useSetAppState();
  const [logs, setLogs] = React.useState<LogOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resuming, setResuming] = React.useState(false);
  const [showAllProjects, setShowAllProjects] = React.useState(false);
  const [resumeData, setResumeData] = React.useState<{
    messages: Message[];
    fileHistorySnapshots?: FileHistorySnapshot[];
    contentReplacements?: ContentReplacementRecord[];
    agentName?: string;
    agentColor?: AgentColorName;
    mainThreadAgentDefinition?: AgentDefinition;
  } | null>(null);
  const [crossProjectCommand, setCrossProjectCommand] = React.useState<string | null>(null);
  const sessionLogResultRef = React.useRef<SessionLogResult | null>(null);
  // Mirror of logs.length so loadMoreLogs can compute value indices outside
  // the setLogs updater (keeping it pure per React's contract).
  const logCountRef = React.useRef(0);
  const filteredLogs = React.useMemo(() => {
    let result = logs.filter(l => !l.isSidechain);
    if (filterByPr !== undefined) {
      if (filterByPr === true) {
        result = result.filter(l_0 => l_0.prNumber !== undefined);
      } else if (typeof filterByPr === 'number') {
        result = result.filter(l_1 => l_1.prNumber === filterByPr);
      } else if (typeof filterByPr === 'string') {
        const prNumber = parsePrIdentifier(filterByPr);
        if (prNumber !== null) {
          result = result.filter(l_2 => l_2.prNumber === prNumber);
        }
      }
    }
    return result;
  }, [logs, filterByPr]);
  const isResumeWithRenameEnabled = isCustomTitleEnabled();
  React.useEffect(() => {
    loadSameRepoMessageLogsProgressive(worktreePaths).then(result_0 => {
      sessionLogResultRef.current = result_0;
      logCountRef.current = result_0.logs.length;
      setLogs(result_0.logs);
      setLoading(false);
    }).catch(error => {
      logError(error);
      setLoading(false);
    });
  }, [worktreePaths]);
  const loadMoreLogs = React.useCallback((count: number) => {
    const ref = sessionLogResultRef.current;
    if (!ref || ref.nextIndex >= ref.allStatLogs.length) return;
    void enrichLogs(ref.allStatLogs, ref.nextIndex, count).then(result_1 => {
      ref.nextIndex = result_1.nextIndex;
      if (result_1.logs.length > 0) {
        // enrichLogs returns fresh unshared objects — safe to mutate in place.
        // Offset comes from logCountRef so the setLogs updater stays pure.
        const offset = logCountRef.current;
        result_1.logs.forEach((log, i) => {
          log.value = offset + i;
        });
        setLogs(prev => prev.concat(result_1.logs));
        logCountRef.current += result_1.logs.length;
      } else if (ref.nextIndex < ref.allStatLogs.length) {
        loadMoreLogs(count);
      }
    });
  }, []);
  const loadLogs = React.useCallback((allProjects: boolean) => {
    setLoading(true);
    const promise = allProjects ? loadAllProjectsMessageLogsProgressive() : loadSameRepoMessageLogsProgressive(worktreePaths);
    promise.then(result_2 => {
      sessionLogResultRef.current = result_2;
      logCountRef.current = result_2.logs.length;
      setLogs(result_2.logs);
    }).catch(error_0 => {
      logError(error_0);
    }).finally(() => {
      setLoading(false);
    });
  }, [worktreePaths]);
  const handleToggleAllProjects = React.useCallback(() => {
    const newValue = !showAllProjects;
    setShowAllProjects(newValue);
    loadLogs(newValue);
  }, [showAllProjects, loadLogs]);
  function onCancel() {
    // eslint-disable-next-line custom-rules/no-process-exit
    process.exit(1);
  }
  async function onSelect(log_0: LogOption) {
    setResuming(true);
    const resumeStart = performance.now();
    const crossProjectCheck = checkCrossProjectResume(log_0, showAllProjects, worktreePaths);
    if (crossProjectCheck.isCrossProject) {
      if (!crossProjectCheck.isSameRepoWorktree) {
        const raw = await setClipboard(crossProjectCheck.command);
        if (raw) process.stdout.write(raw);
        setCrossProjectCommand(crossProjectCheck.command);
        return;
      }
    }
    try {
      const result_3 = await loadConversationForResume(log_0, undefined);
      if (!result_3) {
        throw new Error('Failed to load conversation');
      }
      if (feature('COORDINATOR_MODE')) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const coordinatorModule = require('../coordinator/coordinatorMode.js') as typeof import('../coordinator/coordinatorMode.js');
        /* eslint-enable @typescript-eslint/no-require-imports */
        const warning = coordinatorModule.matchSessionMode(result_3.mode);
        if (warning) {
          /* eslint-disable @typescript-eslint/no-require-imports */
          const {
            getAgentDefinitionsWithOverrides,
            getActiveAgentsFromList
          } = require('../tools/AgentTool/loadAgentsDir.js') as typeof import('../tools/AgentTool/loadAgentsDir.js');
          /* eslint-enable @typescript-eslint/no-require-imports */
          getAgentDefinitionsWithOverrides.cache.clear?.();
          const freshAgentDefs = await getAgentDefinitionsWithOverrides(getOriginalCwd());
          setAppState(prev_0 => ({
            ...prev_0,
            agentDefinitions: {
              ...freshAgentDefs,
              allAgents: freshAgentDefs.allAgents,
              activeAgents: getActiveAgentsFromList(freshAgentDefs.allAgents)
            }
          }));
          result_3.messages.push(createSystemMessage(warning, 'warning'));
        }
      }
      if (result_3.sessionId && !forkSession) {
        switchSession(asSessionId(result_3.sessionId), log_0.fullPath ? dirname(log_0.fullPath) : null);
        await renameRecordingForSession();
        await resetSessionFilePointer();
        restoreCostStateForSession(result_3.sessionId);
      } else if (forkSession && result_3.contentReplacements?.length) {
        await recordContentReplacement(result_3.contentReplacements);
      }
      const {
        agentDefinition: resolvedAgentDef
      } = restoreAgentFromSession(result_3.agentSetting, mainThreadAgentDefinition, agentDefinitions);
      setAppState(prev_1 => ({
        ...prev_1,
        agent: resolvedAgentDef?.agentType
      }));
      if (feature('COORDINATOR_MODE')) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const {
          saveMode
        } = require('../utils/sessionStorage.js');
        const {
          isCoordinatorMode
        } = require('../coordinator/coordinatorMode.js') as typeof import('../coordinator/coordinatorMode.js');
        /* eslint-enable @typescript-eslint/no-require-imports */
        saveMode(isCoordinatorMode() ? 'coordinator' : 'normal');
      }
      const standaloneAgentContext = computeStandaloneAgentContext(result_3.agentName, result_3.agentColor);
      if (standaloneAgentContext) {
        setAppState(prev_2 => ({
          ...prev_2,
          standaloneAgentContext
        }));
      }
      void updateSessionName(result_3.agentName);
      restoreSessionMetadata(forkSession ? {
        ...result_3,
        worktreeSession: undefined
      } : result_3);
      if (!forkSession) {
        restoreWorktreeForResume(result_3.worktreeSession);
        if (result_3.sessionId) {
          adoptResumedSessionFile();
        }
      }
      if (feature('CONTEXT_COLLAPSE')) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        ;
        (require('../services/contextCollapse/persist.js') as typeof import('../services/contextCollapse/persist.js')).restoreFromEntries(result_3.contextCollapseCommits ?? [], result_3.contextCollapseSnapshot);
        /* eslint-enable @typescript-eslint/no-require-imports */
      }
      logEvent('tengu_session_resumed', {
        entrypoint: 'picker' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        success: true,
        resume_duration_ms: Math.round(performance.now() - resumeStart)
      });
      setLogs([]);
      setResumeData({
        messages: result_3.messages,
        fileHistorySnapshots: result_3.fileHistorySnapshots,
        contentReplacements: result_3.contentReplacements,
        agentName: result_3.agentName,
        agentColor: (result_3.agentColor === 'default' ? undefined : result_3.agentColor) as AgentColorName | undefined,
        mainThreadAgentDefinition: resolvedAgentDef
      });
    } catch (e) {
      logEvent('tengu_session_resumed', {
        entrypoint: 'picker' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        success: false
      });
      logError(e as Error);
      throw e;
    }
  }
  if (crossProjectCommand) {
    return <CrossProjectMessage command={crossProjectCommand} />;
  }
  if (resumeData) {
    return <REPL debug={debug} commands={commands} initialTools={initialTools} initialMessages={resumeData.messages} initialFileHistorySnapshots={resumeData.fileHistorySnapshots} initialContentReplacements={resumeData.contentReplacements} initialAgentName={resumeData.agentName} initialAgentColor={resumeData.agentColor} mcpClients={mcpClients} dynamicMcpConfig={dynamicMcpConfig} strictMcpConfig={strictMcpConfig} systemPrompt={systemPrompt} appendSystemPrompt={appendSystemPrompt} mainThreadAgentDefinition={resumeData.mainThreadAgentDefinition} autoConnectIdeFlag={autoConnectIdeFlag} disableSlashCommands={disableSlashCommands} taskListId={taskListId} thinkingConfig={thinkingConfig} onTurnComplete={onTurnComplete} />;
  }
  if (loading) {
    return <Box>
        <Spinner />
        <Text> Loading conversations…</Text>
      </Box>;
  }
  if (resuming) {
    return <Box>
        <Spinner />
        <Text> Resuming conversation…</Text>
      </Box>;
  }
  if (filteredLogs.length === 0) {
    return <NoConversationsMessage />;
  }
  return <LogSelector logs={filteredLogs} maxHeight={rows} onCancel={onCancel} onSelect={onSelect} onLogsChanged={isResumeWithRenameEnabled ? () => loadLogs(showAllProjects) : undefined} onLoadMore={loadMoreLogs} initialSearchQuery={initialSearchQuery} showAllProjects={showAllProjects} onToggleAllProjects={handleToggleAllProjects} onAgenticSearch={agenticSessionSearch} />;
}
function NoConversationsMessage() {
  const $ = _c(2);
  let t0;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t0 = {
      context: "Global"
    };
    $[0] = t0;
  } else {
    t0 = $[0];
  }
  useKeybinding("app:interrupt", _temp, t0);
  let t1;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = <Box flexDirection="column"><Text>No conversations found to resume.</Text><Text dimColor={true}>Press Ctrl+C to exit and start a new conversation.</Text></Box>;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  return t1;
}
function _temp() {
  process.exit(1);
}
function CrossProjectMessage(t0) {
  const $ = _c(8);
  const {
    command
  } = t0;
  let t1;
  if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
    t1 = [];
    $[0] = t1;
  } else {
    t1 = $[0];
  }
  React.useEffect(_temp3, t1);
  let t2;
  if ($[1] === Symbol.for("react.memo_cache_sentinel")) {
    t2 = <Text>This conversation is from a different directory.</Text>;
    $[1] = t2;
  } else {
    t2 = $[1];
  }
  let t3;
  if ($[2] === Symbol.for("react.memo_cache_sentinel")) {
    t3 = <Text>To resume, run:</Text>;
    $[2] = t3;
  } else {
    t3 = $[2];
  }
  let t4;
  if ($[3] !== command) {
    t4 = <Box flexDirection="column">{t3}<Text> {command}</Text></Box>;
    $[3] = command;
    $[4] = t4;
  } else {
    t4 = $[4];
  }
  let t5;
  if ($[5] === Symbol.for("react.memo_cache_sentinel")) {
    t5 = <Text dimColor={true}>(Command copied to clipboard)</Text>;
    $[5] = t5;
  } else {
    t5 = $[5];
  }
  let t6;
  if ($[6] !== t4) {
    t6 = <Box flexDirection="column" gap={1}>{t2}{t4}{t5}</Box>;
    $[6] = t4;
    $[7] = t6;
  } else {
    t6 = $[7];
  }
  return t6;
}
function _temp3() {
  const timeout = setTimeout(_temp2, 100);
  return () => clearTimeout(timeout);
}
function _temp2() {
  process.exit(0);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmZWF0dXJlIiwiZGlybmFtZSIsIlJlYWN0IiwidXNlVGVybWluYWxTaXplIiwiZ2V0T3JpZ2luYWxDd2QiLCJzd2l0Y2hTZXNzaW9uIiwiQ29tbWFuZCIsIkxvZ1NlbGVjdG9yIiwiU3Bpbm5lciIsInJlc3RvcmVDb3N0U3RhdGVGb3JTZXNzaW9uIiwic2V0Q2xpcGJvYXJkIiwiQm94IiwiVGV4dCIsInVzZUtleWJpbmRpbmciLCJBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTIiwibG9nRXZlbnQiLCJNQ1BTZXJ2ZXJDb25uZWN0aW9uIiwiU2NvcGVkTWNwU2VydmVyQ29uZmlnIiwidXNlQXBwU3RhdGUiLCJ1c2VTZXRBcHBTdGF0ZSIsIlRvb2wiLCJBZ2VudENvbG9yTmFtZSIsIkFnZW50RGVmaW5pdGlvbiIsImFzU2Vzc2lvbklkIiwiTG9nT3B0aW9uIiwiTWVzc2FnZSIsImFnZW50aWNTZXNzaW9uU2VhcmNoIiwicmVuYW1lUmVjb3JkaW5nRm9yU2Vzc2lvbiIsInVwZGF0ZVNlc3Npb25OYW1lIiwibG9hZENvbnZlcnNhdGlvbkZvclJlc3VtZSIsImNoZWNrQ3Jvc3NQcm9qZWN0UmVzdW1lIiwiRmlsZUhpc3RvcnlTbmFwc2hvdCIsImxvZ0Vycm9yIiwiY3JlYXRlU3lzdGVtTWVzc2FnZSIsImNvbXB1dGVTdGFuZGFsb25lQWdlbnRDb250ZXh0IiwicmVzdG9yZUFnZW50RnJvbVNlc3Npb24iLCJyZXN0b3JlV29ya3RyZWVGb3JSZXN1bWUiLCJhZG9wdFJlc3VtZWRTZXNzaW9uRmlsZSIsImVucmljaExvZ3MiLCJpc0N1c3RvbVRpdGxlRW5hYmxlZCIsImxvYWRBbGxQcm9qZWN0c01lc3NhZ2VMb2dzUHJvZ3Jlc3NpdmUiLCJsb2FkU2FtZVJlcG9NZXNzYWdlTG9nc1Byb2dyZXNzaXZlIiwicmVjb3JkQ29udGVudFJlcGxhY2VtZW50IiwicmVzZXRTZXNzaW9uRmlsZVBvaW50ZXIiLCJyZXN0b3JlU2Vzc2lvbk1ldGFkYXRhIiwiU2Vzc2lvbkxvZ1Jlc3VsdCIsIlRoaW5raW5nQ29uZmlnIiwiQ29udGVudFJlcGxhY2VtZW50UmVjb3JkIiwiUkVQTCIsInBhcnNlUHJJZGVudGlmaWVyIiwidmFsdWUiLCJkaXJlY3ROdW1iZXIiLCJwYXJzZUludCIsImlzTmFOIiwidXJsTWF0Y2giLCJtYXRjaCIsIlByb3BzIiwiY29tbWFuZHMiLCJ3b3JrdHJlZVBhdGhzIiwiaW5pdGlhbFRvb2xzIiwibWNwQ2xpZW50cyIsImR5bmFtaWNNY3BDb25maWciLCJSZWNvcmQiLCJkZWJ1ZyIsIm1haW5UaHJlYWRBZ2VudERlZmluaXRpb24iLCJhdXRvQ29ubmVjdElkZUZsYWciLCJzdHJpY3RNY3BDb25maWciLCJzeXN0ZW1Qcm9tcHQiLCJhcHBlbmRTeXN0ZW1Qcm9tcHQiLCJpbml0aWFsU2VhcmNoUXVlcnkiLCJkaXNhYmxlU2xhc2hDb21tYW5kcyIsImZvcmtTZXNzaW9uIiwidGFza0xpc3RJZCIsImZpbHRlckJ5UHIiLCJ0aGlua2luZ0NvbmZpZyIsIm9uVHVybkNvbXBsZXRlIiwibWVzc2FnZXMiLCJQcm9taXNlIiwiUmVzdW1lQ29udmVyc2F0aW9uIiwiUmVhY3ROb2RlIiwicm93cyIsImFnZW50RGVmaW5pdGlvbnMiLCJzIiwic2V0QXBwU3RhdGUiLCJsb2dzIiwic2V0TG9ncyIsInVzZVN0YXRlIiwibG9hZGluZyIsInNldExvYWRpbmciLCJyZXN1bWluZyIsInNldFJlc3VtaW5nIiwic2hvd0FsbFByb2plY3RzIiwic2V0U2hvd0FsbFByb2plY3RzIiwicmVzdW1lRGF0YSIsInNldFJlc3VtZURhdGEiLCJmaWxlSGlzdG9yeVNuYXBzaG90cyIsImNvbnRlbnRSZXBsYWNlbWVudHMiLCJhZ2VudE5hbWUiLCJhZ2VudENvbG9yIiwiY3Jvc3NQcm9qZWN0Q29tbWFuZCIsInNldENyb3NzUHJvamVjdENvbW1hbmQiLCJzZXNzaW9uTG9nUmVzdWx0UmVmIiwidXNlUmVmIiwibG9nQ291bnRSZWYiLCJmaWx0ZXJlZExvZ3MiLCJ1c2VNZW1vIiwicmVzdWx0IiwiZmlsdGVyIiwibCIsImlzU2lkZWNoYWluIiwidW5kZWZpbmVkIiwicHJOdW1iZXIiLCJpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkIiwidXNlRWZmZWN0IiwidGhlbiIsImN1cnJlbnQiLCJsZW5ndGgiLCJjYXRjaCIsImVycm9yIiwibG9hZE1vcmVMb2dzIiwidXNlQ2FsbGJhY2siLCJjb3VudCIsInJlZiIsIm5leHRJbmRleCIsImFsbFN0YXRMb2dzIiwib2Zmc2V0IiwiZm9yRWFjaCIsImxvZyIsImkiLCJwcmV2IiwiY29uY2F0IiwibG9hZExvZ3MiLCJhbGxQcm9qZWN0cyIsInByb21pc2UiLCJmaW5hbGx5IiwiaGFuZGxlVG9nZ2xlQWxsUHJvamVjdHMiLCJuZXdWYWx1ZSIsIm9uQ2FuY2VsIiwicHJvY2VzcyIsImV4aXQiLCJvblNlbGVjdCIsInJlc3VtZVN0YXJ0IiwicGVyZm9ybWFuY2UiLCJub3ciLCJjcm9zc1Byb2plY3RDaGVjayIsImlzQ3Jvc3NQcm9qZWN0IiwiaXNTYW1lUmVwb1dvcmt0cmVlIiwicmF3IiwiY29tbWFuZCIsInN0ZG91dCIsIndyaXRlIiwiRXJyb3IiLCJjb29yZGluYXRvck1vZHVsZSIsInJlcXVpcmUiLCJ3YXJuaW5nIiwibWF0Y2hTZXNzaW9uTW9kZSIsIm1vZGUiLCJnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyIsImdldEFjdGl2ZUFnZW50c0Zyb21MaXN0IiwiY2FjaGUiLCJjbGVhciIsImZyZXNoQWdlbnREZWZzIiwiYWxsQWdlbnRzIiwiYWN0aXZlQWdlbnRzIiwicHVzaCIsInNlc3Npb25JZCIsImZ1bGxQYXRoIiwiYWdlbnREZWZpbml0aW9uIiwicmVzb2x2ZWRBZ2VudERlZiIsImFnZW50U2V0dGluZyIsImFnZW50IiwiYWdlbnRUeXBlIiwic2F2ZU1vZGUiLCJpc0Nvb3JkaW5hdG9yTW9kZSIsInN0YW5kYWxvbmVBZ2VudENvbnRleHQiLCJ3b3JrdHJlZVNlc3Npb24iLCJyZXN0b3JlRnJvbUVudHJpZXMiLCJjb250ZXh0Q29sbGFwc2VDb21taXRzIiwiY29udGV4dENvbGxhcHNlU25hcHNob3QiLCJlbnRyeXBvaW50Iiwic3VjY2VzcyIsInJlc3VtZV9kdXJhdGlvbl9tcyIsIk1hdGgiLCJyb3VuZCIsImUiLCJOb0NvbnZlcnNhdGlvbnNNZXNzYWdlIiwiJCIsIl9jIiwidDAiLCJTeW1ib2wiLCJmb3IiLCJjb250ZXh0IiwiX3RlbXAiLCJ0MSIsIkNyb3NzUHJvamVjdE1lc3NhZ2UiLCJfdGVtcDMiLCJ0MiIsInQzIiwidDQiLCJ0NSIsInQ2IiwidGltZW91dCIsInNldFRpbWVvdXQiLCJfdGVtcDIiLCJjbGVhclRpbWVvdXQiXSwic291cmNlcyI6WyJSZXN1bWVDb252ZXJzYXRpb24udHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGZlYXR1cmUgfSBmcm9tICdidW46YnVuZGxlJ1xuaW1wb3J0IHsgZGlybmFtZSB9IGZyb20gJ3BhdGgnXG5pbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnXG5pbXBvcnQgeyB1c2VUZXJtaW5hbFNpemUgfSBmcm9tICdzcmMvaG9va3MvdXNlVGVybWluYWxTaXplLmpzJ1xuaW1wb3J0IHsgZ2V0T3JpZ2luYWxDd2QsIHN3aXRjaFNlc3Npb24gfSBmcm9tICcuLi9ib290c3RyYXAvc3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IENvbW1hbmQgfSBmcm9tICcuLi9jb21tYW5kcy5qcydcbmltcG9ydCB7IExvZ1NlbGVjdG9yIH0gZnJvbSAnLi4vY29tcG9uZW50cy9Mb2dTZWxlY3Rvci5qcydcbmltcG9ydCB7IFNwaW5uZXIgfSBmcm9tICcuLi9jb21wb25lbnRzL1NwaW5uZXIuanMnXG5pbXBvcnQgeyByZXN0b3JlQ29zdFN0YXRlRm9yU2Vzc2lvbiB9IGZyb20gJy4uL2Nvc3QtdHJhY2tlci5qcydcbmltcG9ydCB7IHNldENsaXBib2FyZCB9IGZyb20gJy4uL2luay90ZXJtaW8vb3NjLmpzJ1xuaW1wb3J0IHsgQm94LCBUZXh0IH0gZnJvbSAnLi4vaW5rLmpzJ1xuaW1wb3J0IHsgdXNlS2V5YmluZGluZyB9IGZyb20gJy4uL2tleWJpbmRpbmdzL3VzZUtleWJpbmRpbmcuanMnXG5pbXBvcnQge1xuICB0eXBlIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gIGxvZ0V2ZW50LFxufSBmcm9tICcuLi9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgdHlwZSB7XG4gIE1DUFNlcnZlckNvbm5lY3Rpb24sXG4gIFNjb3BlZE1jcFNlcnZlckNvbmZpZyxcbn0gZnJvbSAnLi4vc2VydmljZXMvbWNwL3R5cGVzLmpzJ1xuaW1wb3J0IHsgdXNlQXBwU3RhdGUsIHVzZVNldEFwcFN0YXRlIH0gZnJvbSAnLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IFRvb2wgfSBmcm9tICcuLi9Ub29sLmpzJ1xuaW1wb3J0IHR5cGUgeyBBZ2VudENvbG9yTmFtZSB9IGZyb20gJy4uL3Rvb2xzL0FnZW50VG9vbC9hZ2VudENvbG9yTWFuYWdlci5qcydcbmltcG9ydCB0eXBlIHsgQWdlbnREZWZpbml0aW9uIH0gZnJvbSAnLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnXG5pbXBvcnQgeyBhc1Nlc3Npb25JZCB9IGZyb20gJy4uL3R5cGVzL2lkcy5qcydcbmltcG9ydCB0eXBlIHsgTG9nT3B0aW9uIH0gZnJvbSAnLi4vdHlwZXMvbG9ncy5qcydcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSB9IGZyb20gJy4uL3R5cGVzL21lc3NhZ2UuanMnXG5pbXBvcnQgeyBhZ2VudGljU2Vzc2lvblNlYXJjaCB9IGZyb20gJy4uL3V0aWxzL2FnZW50aWNTZXNzaW9uU2VhcmNoLmpzJ1xuaW1wb3J0IHsgcmVuYW1lUmVjb3JkaW5nRm9yU2Vzc2lvbiB9IGZyb20gJy4uL3V0aWxzL2FzY2lpY2FzdC5qcydcbmltcG9ydCB7IHVwZGF0ZVNlc3Npb25OYW1lIH0gZnJvbSAnLi4vdXRpbHMvY29uY3VycmVudFNlc3Npb25zLmpzJ1xuaW1wb3J0IHsgbG9hZENvbnZlcnNhdGlvbkZvclJlc3VtZSB9IGZyb20gJy4uL3V0aWxzL2NvbnZlcnNhdGlvblJlY292ZXJ5LmpzJ1xuaW1wb3J0IHsgY2hlY2tDcm9zc1Byb2plY3RSZXN1bWUgfSBmcm9tICcuLi91dGlscy9jcm9zc1Byb2plY3RSZXN1bWUuanMnXG5pbXBvcnQgdHlwZSB7IEZpbGVIaXN0b3J5U25hcHNob3QgfSBmcm9tICcuLi91dGlscy9maWxlSGlzdG9yeS5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnLi4vdXRpbHMvbG9nLmpzJ1xuaW1wb3J0IHsgY3JlYXRlU3lzdGVtTWVzc2FnZSB9IGZyb20gJy4uL3V0aWxzL21lc3NhZ2VzLmpzJ1xuaW1wb3J0IHtcbiAgY29tcHV0ZVN0YW5kYWxvbmVBZ2VudENvbnRleHQsXG4gIHJlc3RvcmVBZ2VudEZyb21TZXNzaW9uLFxuICByZXN0b3JlV29ya3RyZWVGb3JSZXN1bWUsXG59IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25SZXN0b3JlLmpzJ1xuaW1wb3J0IHtcbiAgYWRvcHRSZXN1bWVkU2Vzc2lvbkZpbGUsXG4gIGVucmljaExvZ3MsXG4gIGlzQ3VzdG9tVGl0bGVFbmFibGVkLFxuICBsb2FkQWxsUHJvamVjdHNNZXNzYWdlTG9nc1Byb2dyZXNzaXZlLFxuICBsb2FkU2FtZVJlcG9NZXNzYWdlTG9nc1Byb2dyZXNzaXZlLFxuICByZWNvcmRDb250ZW50UmVwbGFjZW1lbnQsXG4gIHJlc2V0U2Vzc2lvbkZpbGVQb2ludGVyLFxuICByZXN0b3JlU2Vzc2lvbk1ldGFkYXRhLFxuICB0eXBlIFNlc3Npb25Mb2dSZXN1bHQsXG59IGZyb20gJy4uL3V0aWxzL3Nlc3Npb25TdG9yYWdlLmpzJ1xuaW1wb3J0IHR5cGUgeyBUaGlua2luZ0NvbmZpZyB9IGZyb20gJy4uL3V0aWxzL3RoaW5raW5nLmpzJ1xuaW1wb3J0IHR5cGUgeyBDb250ZW50UmVwbGFjZW1lbnRSZWNvcmQgfSBmcm9tICcuLi91dGlscy90b29sUmVzdWx0U3RvcmFnZS5qcydcbmltcG9ydCB7IFJFUEwgfSBmcm9tICcuL1JFUEwuanMnXG5cbmZ1bmN0aW9uIHBhcnNlUHJJZGVudGlmaWVyKHZhbHVlOiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgY29uc3QgZGlyZWN0TnVtYmVyID0gcGFyc2VJbnQodmFsdWUsIDEwKVxuICBpZiAoIWlzTmFOKGRpcmVjdE51bWJlcikgJiYgZGlyZWN0TnVtYmVyID4gMCkge1xuICAgIHJldHVybiBkaXJlY3ROdW1iZXJcbiAgfVxuICBjb25zdCB1cmxNYXRjaCA9IHZhbHVlLm1hdGNoKC9naXRodWJcXC5jb21cXC9bXi9dK1xcL1teL10rXFwvcHVsbFxcLyhcXGQrKS8pXG4gIGlmICh1cmxNYXRjaD8uWzFdKSB7XG4gICAgcmV0dXJuIHBhcnNlSW50KHVybE1hdGNoWzFdLCAxMClcbiAgfVxuICByZXR1cm4gbnVsbFxufVxuXG50eXBlIFByb3BzID0ge1xuICBjb21tYW5kczogQ29tbWFuZFtdXG4gIHdvcmt0cmVlUGF0aHM6IHN0cmluZ1tdXG4gIGluaXRpYWxUb29sczogVG9vbFtdXG4gIG1jcENsaWVudHM/OiBNQ1BTZXJ2ZXJDb25uZWN0aW9uW11cbiAgZHluYW1pY01jcENvbmZpZz86IFJlY29yZDxzdHJpbmcsIFNjb3BlZE1jcFNlcnZlckNvbmZpZz5cbiAgZGVidWc6IGJvb2xlYW5cbiAgbWFpblRocmVhZEFnZW50RGVmaW5pdGlvbj86IEFnZW50RGVmaW5pdGlvblxuICBhdXRvQ29ubmVjdElkZUZsYWc/OiBib29sZWFuXG4gIHN0cmljdE1jcENvbmZpZz86IGJvb2xlYW5cbiAgc3lzdGVtUHJvbXB0Pzogc3RyaW5nXG4gIGFwcGVuZFN5c3RlbVByb21wdD86IHN0cmluZ1xuICBpbml0aWFsU2VhcmNoUXVlcnk/OiBzdHJpbmdcbiAgZGlzYWJsZVNsYXNoQ29tbWFuZHM/OiBib29sZWFuXG4gIGZvcmtTZXNzaW9uPzogYm9vbGVhblxuICB0YXNrTGlzdElkPzogc3RyaW5nXG4gIGZpbHRlckJ5UHI/OiBib29sZWFuIHwgbnVtYmVyIHwgc3RyaW5nXG4gIHRoaW5raW5nQ29uZmlnOiBUaGlua2luZ0NvbmZpZ1xuICBvblR1cm5Db21wbGV0ZT86IChtZXNzYWdlczogTWVzc2FnZVtdKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPlxufVxuXG5leHBvcnQgZnVuY3Rpb24gUmVzdW1lQ29udmVyc2F0aW9uKHtcbiAgY29tbWFuZHMsXG4gIHdvcmt0cmVlUGF0aHMsXG4gIGluaXRpYWxUb29scyxcbiAgbWNwQ2xpZW50cyxcbiAgZHluYW1pY01jcENvbmZpZyxcbiAgZGVidWcsXG4gIG1haW5UaHJlYWRBZ2VudERlZmluaXRpb24sXG4gIGF1dG9Db25uZWN0SWRlRmxhZyxcbiAgc3RyaWN0TWNwQ29uZmlnID0gZmFsc2UsXG4gIHN5c3RlbVByb21wdCxcbiAgYXBwZW5kU3lzdGVtUHJvbXB0LFxuICBpbml0aWFsU2VhcmNoUXVlcnksXG4gIGRpc2FibGVTbGFzaENvbW1hbmRzID0gZmFsc2UsXG4gIGZvcmtTZXNzaW9uLFxuICB0YXNrTGlzdElkLFxuICBmaWx0ZXJCeVByLFxuICB0aGlua2luZ0NvbmZpZyxcbiAgb25UdXJuQ29tcGxldGUsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHsgcm93cyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgYWdlbnREZWZpbml0aW9ucyA9IHVzZUFwcFN0YXRlKHMgPT4gcy5hZ2VudERlZmluaXRpb25zKVxuICBjb25zdCBzZXRBcHBTdGF0ZSA9IHVzZVNldEFwcFN0YXRlKClcbiAgY29uc3QgW2xvZ3MsIHNldExvZ3NdID0gUmVhY3QudXNlU3RhdGU8TG9nT3B0aW9uW10+KFtdKVxuICBjb25zdCBbbG9hZGluZywgc2V0TG9hZGluZ10gPSBSZWFjdC51c2VTdGF0ZSh0cnVlKVxuICBjb25zdCBbcmVzdW1pbmcsIHNldFJlc3VtaW5nXSA9IFJlYWN0LnVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbc2hvd0FsbFByb2plY3RzLCBzZXRTaG93QWxsUHJvamVjdHNdID0gUmVhY3QudXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtyZXN1bWVEYXRhLCBzZXRSZXN1bWVEYXRhXSA9IFJlYWN0LnVzZVN0YXRlPHtcbiAgICBtZXNzYWdlczogTWVzc2FnZVtdXG4gICAgZmlsZUhpc3RvcnlTbmFwc2hvdHM/OiBGaWxlSGlzdG9yeVNuYXBzaG90W11cbiAgICBjb250ZW50UmVwbGFjZW1lbnRzPzogQ29udGVudFJlcGxhY2VtZW50UmVjb3JkW11cbiAgICBhZ2VudE5hbWU/OiBzdHJpbmdcbiAgICBhZ2VudENvbG9yPzogQWdlbnRDb2xvck5hbWVcbiAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uPzogQWdlbnREZWZpbml0aW9uXG4gIH0gfCBudWxsPihudWxsKVxuICBjb25zdCBbY3Jvc3NQcm9qZWN0Q29tbWFuZCwgc2V0Q3Jvc3NQcm9qZWN0Q29tbWFuZF0gPSBSZWFjdC51c2VTdGF0ZTxcbiAgICBzdHJpbmcgfCBudWxsXG4gID4obnVsbClcbiAgY29uc3Qgc2Vzc2lvbkxvZ1Jlc3VsdFJlZiA9IFJlYWN0LnVzZVJlZjxTZXNzaW9uTG9nUmVzdWx0IHwgbnVsbD4obnVsbClcbiAgLy8gTWlycm9yIG9mIGxvZ3MubGVuZ3RoIHNvIGxvYWRNb3JlTG9ncyBjYW4gY29tcHV0ZSB2YWx1ZSBpbmRpY2VzIG91dHNpZGVcbiAgLy8gdGhlIHNldExvZ3MgdXBkYXRlciAoa2VlcGluZyBpdCBwdXJlIHBlciBSZWFjdCdzIGNvbnRyYWN0KS5cbiAgY29uc3QgbG9nQ291bnRSZWYgPSBSZWFjdC51c2VSZWYoMClcblxuICBjb25zdCBmaWx0ZXJlZExvZ3MgPSBSZWFjdC51c2VNZW1vKCgpID0+IHtcbiAgICBsZXQgcmVzdWx0ID0gbG9ncy5maWx0ZXIobCA9PiAhbC5pc1NpZGVjaGFpbilcbiAgICBpZiAoZmlsdGVyQnlQciAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoZmlsdGVyQnlQciA9PT0gdHJ1ZSkge1xuICAgICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKGwgPT4gbC5wck51bWJlciAhPT0gdW5kZWZpbmVkKVxuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZmlsdGVyQnlQciA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgcmVzdWx0ID0gcmVzdWx0LmZpbHRlcihsID0+IGwucHJOdW1iZXIgPT09IGZpbHRlckJ5UHIpXG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBmaWx0ZXJCeVByID09PSAnc3RyaW5nJykge1xuICAgICAgICBjb25zdCBwck51bWJlciA9IHBhcnNlUHJJZGVudGlmaWVyKGZpbHRlckJ5UHIpXG4gICAgICAgIGlmIChwck51bWJlciAhPT0gbnVsbCkge1xuICAgICAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIobCA9PiBsLnByTnVtYmVyID09PSBwck51bWJlcilcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0XG4gIH0sIFtsb2dzLCBmaWx0ZXJCeVByXSlcbiAgY29uc3QgaXNSZXN1bWVXaXRoUmVuYW1lRW5hYmxlZCA9IGlzQ3VzdG9tVGl0bGVFbmFibGVkKClcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxvYWRTYW1lUmVwb01lc3NhZ2VMb2dzUHJvZ3Jlc3NpdmUod29ya3RyZWVQYXRocylcbiAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIHNlc3Npb25Mb2dSZXN1bHRSZWYuY3VycmVudCA9IHJlc3VsdFxuICAgICAgICBsb2dDb3VudFJlZi5jdXJyZW50ID0gcmVzdWx0LmxvZ3MubGVuZ3RoXG4gICAgICAgIHNldExvZ3MocmVzdWx0LmxvZ3MpXG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVycm9yID0+IHtcbiAgICAgICAgbG9nRXJyb3IoZXJyb3IpXG4gICAgICAgIHNldExvYWRpbmcoZmFsc2UpXG4gICAgICB9KVxuICB9LCBbd29ya3RyZWVQYXRoc10pXG5cbiAgY29uc3QgbG9hZE1vcmVMb2dzID0gUmVhY3QudXNlQ2FsbGJhY2soKGNvdW50OiBudW1iZXIpID0+IHtcbiAgICBjb25zdCByZWYgPSBzZXNzaW9uTG9nUmVzdWx0UmVmLmN1cnJlbnRcbiAgICBpZiAoIXJlZiB8fCByZWYubmV4dEluZGV4ID49IHJlZi5hbGxTdGF0TG9ncy5sZW5ndGgpIHJldHVyblxuXG4gICAgdm9pZCBlbnJpY2hMb2dzKHJlZi5hbGxTdGF0TG9ncywgcmVmLm5leHRJbmRleCwgY291bnQpLnRoZW4ocmVzdWx0ID0+IHtcbiAgICAgIHJlZi5uZXh0SW5kZXggPSByZXN1bHQubmV4dEluZGV4XG4gICAgICBpZiAocmVzdWx0LmxvZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAvLyBlbnJpY2hMb2dzIHJldHVybnMgZnJlc2ggdW5zaGFyZWQgb2JqZWN0cyDigJQgc2FmZSB0byBtdXRhdGUgaW4gcGxhY2UuXG4gICAgICAgIC8vIE9mZnNldCBjb21lcyBmcm9tIGxvZ0NvdW50UmVmIHNvIHRoZSBzZXRMb2dzIHVwZGF0ZXIgc3RheXMgcHVyZS5cbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gbG9nQ291bnRSZWYuY3VycmVudFxuICAgICAgICByZXN1bHQubG9ncy5mb3JFYWNoKChsb2csIGkpID0+IHtcbiAgICAgICAgICBsb2cudmFsdWUgPSBvZmZzZXQgKyBpXG4gICAgICAgIH0pXG4gICAgICAgIHNldExvZ3MocHJldiA9PiBwcmV2LmNvbmNhdChyZXN1bHQubG9ncykpXG4gICAgICAgIGxvZ0NvdW50UmVmLmN1cnJlbnQgKz0gcmVzdWx0LmxvZ3MubGVuZ3RoXG4gICAgICB9IGVsc2UgaWYgKHJlZi5uZXh0SW5kZXggPCByZWYuYWxsU3RhdExvZ3MubGVuZ3RoKSB7XG4gICAgICAgIGxvYWRNb3JlTG9ncyhjb3VudClcbiAgICAgIH1cbiAgICB9KVxuICB9LCBbXSlcblxuICBjb25zdCBsb2FkTG9ncyA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgIChhbGxQcm9qZWN0czogYm9vbGVhbikgPT4ge1xuICAgICAgc2V0TG9hZGluZyh0cnVlKVxuICAgICAgY29uc3QgcHJvbWlzZSA9IGFsbFByb2plY3RzXG4gICAgICAgID8gbG9hZEFsbFByb2plY3RzTWVzc2FnZUxvZ3NQcm9ncmVzc2l2ZSgpXG4gICAgICAgIDogbG9hZFNhbWVSZXBvTWVzc2FnZUxvZ3NQcm9ncmVzc2l2ZSh3b3JrdHJlZVBhdGhzKVxuICAgICAgcHJvbWlzZVxuICAgICAgICAudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICAgIHNlc3Npb25Mb2dSZXN1bHRSZWYuY3VycmVudCA9IHJlc3VsdFxuICAgICAgICAgIGxvZ0NvdW50UmVmLmN1cnJlbnQgPSByZXN1bHQubG9ncy5sZW5ndGhcbiAgICAgICAgICBzZXRMb2dzKHJlc3VsdC5sb2dzKVxuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIGxvZ0Vycm9yKGVycm9yKVxuICAgICAgICB9KVxuICAgICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgICAgc2V0TG9hZGluZyhmYWxzZSlcbiAgICAgICAgfSlcbiAgICB9LFxuICAgIFt3b3JrdHJlZVBhdGhzXSxcbiAgKVxuXG4gIGNvbnN0IGhhbmRsZVRvZ2dsZUFsbFByb2plY3RzID0gUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbHVlID0gIXNob3dBbGxQcm9qZWN0c1xuICAgIHNldFNob3dBbGxQcm9qZWN0cyhuZXdWYWx1ZSlcbiAgICBsb2FkTG9ncyhuZXdWYWx1ZSlcbiAgfSwgW3Nob3dBbGxQcm9qZWN0cywgbG9hZExvZ3NdKVxuXG4gIGZ1bmN0aW9uIG9uQ2FuY2VsKCkge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1leGl0XG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBvblNlbGVjdChsb2c6IExvZ09wdGlvbikge1xuICAgIHNldFJlc3VtaW5nKHRydWUpXG4gICAgY29uc3QgcmVzdW1lU3RhcnQgPSBwZXJmb3JtYW5jZS5ub3coKVxuXG4gICAgY29uc3QgY3Jvc3NQcm9qZWN0Q2hlY2sgPSBjaGVja0Nyb3NzUHJvamVjdFJlc3VtZShcbiAgICAgIGxvZyxcbiAgICAgIHNob3dBbGxQcm9qZWN0cyxcbiAgICAgIHdvcmt0cmVlUGF0aHMsXG4gICAgKVxuICAgIGlmIChjcm9zc1Byb2plY3RDaGVjay5pc0Nyb3NzUHJvamVjdCkge1xuICAgICAgaWYgKCFjcm9zc1Byb2plY3RDaGVjay5pc1NhbWVSZXBvV29ya3RyZWUpIHtcbiAgICAgICAgY29uc3QgcmF3ID0gYXdhaXQgc2V0Q2xpcGJvYXJkKGNyb3NzUHJvamVjdENoZWNrLmNvbW1hbmQpXG4gICAgICAgIGlmIChyYXcpIHByb2Nlc3Muc3Rkb3V0LndyaXRlKHJhdylcbiAgICAgICAgc2V0Q3Jvc3NQcm9qZWN0Q29tbWFuZChjcm9zc1Byb2plY3RDaGVjay5jb21tYW5kKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbG9hZENvbnZlcnNhdGlvbkZvclJlc3VtZShsb2csIHVuZGVmaW5lZClcbiAgICAgIGlmICghcmVzdWx0KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIGxvYWQgY29udmVyc2F0aW9uJylcbiAgICAgIH1cblxuICAgICAgaWYgKGZlYXR1cmUoJ0NPT1JESU5BVE9SX01PREUnKSkge1xuICAgICAgICAvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgIGNvbnN0IGNvb3JkaW5hdG9yTW9kdWxlID1cbiAgICAgICAgICByZXF1aXJlKCcuLi9jb29yZGluYXRvci9jb29yZGluYXRvck1vZGUuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi9jb29yZGluYXRvci9jb29yZGluYXRvck1vZGUuanMnKVxuICAgICAgICAvKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY29uc3Qgd2FybmluZyA9IGNvb3JkaW5hdG9yTW9kdWxlLm1hdGNoU2Vzc2lvbk1vZGUocmVzdWx0Lm1vZGUpXG4gICAgICAgIGlmICh3YXJuaW5nKSB7XG4gICAgICAgICAgLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICAgIGNvbnN0IHsgZ2V0QWdlbnREZWZpbml0aW9uc1dpdGhPdmVycmlkZXMsIGdldEFjdGl2ZUFnZW50c0Zyb21MaXN0IH0gPVxuICAgICAgICAgICAgcmVxdWlyZSgnLi4vdG9vbHMvQWdlbnRUb29sL2xvYWRBZ2VudHNEaXIuanMnKSBhcyB0eXBlb2YgaW1wb3J0KCcuLi90b29scy9BZ2VudFRvb2wvbG9hZEFnZW50c0Rpci5qcycpXG4gICAgICAgICAgLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tcmVxdWlyZS1pbXBvcnRzICovXG4gICAgICAgICAgZ2V0QWdlbnREZWZpbml0aW9uc1dpdGhPdmVycmlkZXMuY2FjaGUuY2xlYXI/LigpXG4gICAgICAgICAgY29uc3QgZnJlc2hBZ2VudERlZnMgPSBhd2FpdCBnZXRBZ2VudERlZmluaXRpb25zV2l0aE92ZXJyaWRlcyhcbiAgICAgICAgICAgIGdldE9yaWdpbmFsQ3dkKCksXG4gICAgICAgICAgKVxuICAgICAgICAgIHNldEFwcFN0YXRlKHByZXYgPT4gKHtcbiAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICBhZ2VudERlZmluaXRpb25zOiB7XG4gICAgICAgICAgICAgIC4uLmZyZXNoQWdlbnREZWZzLFxuICAgICAgICAgICAgICBhbGxBZ2VudHM6IGZyZXNoQWdlbnREZWZzLmFsbEFnZW50cyxcbiAgICAgICAgICAgICAgYWN0aXZlQWdlbnRzOiBnZXRBY3RpdmVBZ2VudHNGcm9tTGlzdChmcmVzaEFnZW50RGVmcy5hbGxBZ2VudHMpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KSlcbiAgICAgICAgICByZXN1bHQubWVzc2FnZXMucHVzaChjcmVhdGVTeXN0ZW1NZXNzYWdlKHdhcm5pbmcsICd3YXJuaW5nJykpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3VsdC5zZXNzaW9uSWQgJiYgIWZvcmtTZXNzaW9uKSB7XG4gICAgICAgIHN3aXRjaFNlc3Npb24oXG4gICAgICAgICAgYXNTZXNzaW9uSWQocmVzdWx0LnNlc3Npb25JZCksXG4gICAgICAgICAgbG9nLmZ1bGxQYXRoID8gZGlybmFtZShsb2cuZnVsbFBhdGgpIDogbnVsbCxcbiAgICAgICAgKVxuICAgICAgICBhd2FpdCByZW5hbWVSZWNvcmRpbmdGb3JTZXNzaW9uKClcbiAgICAgICAgYXdhaXQgcmVzZXRTZXNzaW9uRmlsZVBvaW50ZXIoKVxuICAgICAgICByZXN0b3JlQ29zdFN0YXRlRm9yU2Vzc2lvbihyZXN1bHQuc2Vzc2lvbklkKVxuICAgICAgfSBlbHNlIGlmIChmb3JrU2Vzc2lvbiAmJiByZXN1bHQuY29udGVudFJlcGxhY2VtZW50cz8ubGVuZ3RoKSB7XG4gICAgICAgIGF3YWl0IHJlY29yZENvbnRlbnRSZXBsYWNlbWVudChyZXN1bHQuY29udGVudFJlcGxhY2VtZW50cylcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBhZ2VudERlZmluaXRpb246IHJlc29sdmVkQWdlbnREZWYgfSA9IHJlc3RvcmVBZ2VudEZyb21TZXNzaW9uKFxuICAgICAgICByZXN1bHQuYWdlbnRTZXR0aW5nLFxuICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uLFxuICAgICAgICBhZ2VudERlZmluaXRpb25zLFxuICAgICAgKVxuICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBhZ2VudDogcmVzb2x2ZWRBZ2VudERlZj8uYWdlbnRUeXBlIH0pKVxuXG4gICAgICBpZiAoZmVhdHVyZSgnQ09PUkRJTkFUT1JfTU9ERScpKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgY29uc3QgeyBzYXZlTW9kZSB9ID0gcmVxdWlyZSgnLi4vdXRpbHMvc2Vzc2lvblN0b3JhZ2UuanMnKVxuICAgICAgICBjb25zdCB7IGlzQ29vcmRpbmF0b3JNb2RlIH0gPVxuICAgICAgICAgIHJlcXVpcmUoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL2Nvb3JkaW5hdG9yL2Nvb3JkaW5hdG9yTW9kZS5qcycpXG4gICAgICAgIC8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgICBzYXZlTW9kZShpc0Nvb3JkaW5hdG9yTW9kZSgpID8gJ2Nvb3JkaW5hdG9yJyA6ICdub3JtYWwnKVxuICAgICAgfVxuXG4gICAgICBjb25zdCBzdGFuZGFsb25lQWdlbnRDb250ZXh0ID0gY29tcHV0ZVN0YW5kYWxvbmVBZ2VudENvbnRleHQoXG4gICAgICAgIHJlc3VsdC5hZ2VudE5hbWUsXG4gICAgICAgIHJlc3VsdC5hZ2VudENvbG9yLFxuICAgICAgKVxuICAgICAgaWYgKHN0YW5kYWxvbmVBZ2VudENvbnRleHQpIHtcbiAgICAgICAgc2V0QXBwU3RhdGUocHJldiA9PiAoeyAuLi5wcmV2LCBzdGFuZGFsb25lQWdlbnRDb250ZXh0IH0pKVxuICAgICAgfVxuICAgICAgdm9pZCB1cGRhdGVTZXNzaW9uTmFtZShyZXN1bHQuYWdlbnROYW1lKVxuXG4gICAgICByZXN0b3JlU2Vzc2lvbk1ldGFkYXRhKFxuICAgICAgICBmb3JrU2Vzc2lvbiA/IHsgLi4ucmVzdWx0LCB3b3JrdHJlZVNlc3Npb246IHVuZGVmaW5lZCB9IDogcmVzdWx0LFxuICAgICAgKVxuXG4gICAgICBpZiAoIWZvcmtTZXNzaW9uKSB7XG4gICAgICAgIHJlc3RvcmVXb3JrdHJlZUZvclJlc3VtZShyZXN1bHQud29ya3RyZWVTZXNzaW9uKVxuICAgICAgICBpZiAocmVzdWx0LnNlc3Npb25JZCkge1xuICAgICAgICAgIGFkb3B0UmVzdW1lZFNlc3Npb25GaWxlKClcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoZmVhdHVyZSgnQ09OVEVYVF9DT0xMQVBTRScpKSB7XG4gICAgICAgIC8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uby1yZXF1aXJlLWltcG9ydHMgKi9cbiAgICAgICAgOyhcbiAgICAgICAgICByZXF1aXJlKCcuLi9zZXJ2aWNlcy9jb250ZXh0Q29sbGFwc2UvcGVyc2lzdC5qcycpIGFzIHR5cGVvZiBpbXBvcnQoJy4uL3NlcnZpY2VzL2NvbnRleHRDb2xsYXBzZS9wZXJzaXN0LmpzJylcbiAgICAgICAgKS5yZXN0b3JlRnJvbUVudHJpZXMoXG4gICAgICAgICAgcmVzdWx0LmNvbnRleHRDb2xsYXBzZUNvbW1pdHMgPz8gW10sXG4gICAgICAgICAgcmVzdWx0LmNvbnRleHRDb2xsYXBzZVNuYXBzaG90LFxuICAgICAgICApXG4gICAgICAgIC8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25vLXJlcXVpcmUtaW1wb3J0cyAqL1xuICAgICAgfVxuXG4gICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9yZXN1bWVkJywge1xuICAgICAgICBlbnRyeXBvaW50OlxuICAgICAgICAgICdwaWNrZXInIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgIHJlc3VtZV9kdXJhdGlvbl9tczogTWF0aC5yb3VuZChwZXJmb3JtYW5jZS5ub3coKSAtIHJlc3VtZVN0YXJ0KSxcbiAgICAgIH0pXG5cbiAgICAgIHNldExvZ3MoW10pXG4gICAgICBzZXRSZXN1bWVEYXRhKHtcbiAgICAgICAgbWVzc2FnZXM6IHJlc3VsdC5tZXNzYWdlcyxcbiAgICAgICAgZmlsZUhpc3RvcnlTbmFwc2hvdHM6IHJlc3VsdC5maWxlSGlzdG9yeVNuYXBzaG90cyxcbiAgICAgICAgY29udGVudFJlcGxhY2VtZW50czogcmVzdWx0LmNvbnRlbnRSZXBsYWNlbWVudHMsXG4gICAgICAgIGFnZW50TmFtZTogcmVzdWx0LmFnZW50TmFtZSxcbiAgICAgICAgYWdlbnRDb2xvcjogKHJlc3VsdC5hZ2VudENvbG9yID09PSAnZGVmYXVsdCdcbiAgICAgICAgICA/IHVuZGVmaW5lZFxuICAgICAgICAgIDogcmVzdWx0LmFnZW50Q29sb3IpIGFzIEFnZW50Q29sb3JOYW1lIHwgdW5kZWZpbmVkLFxuICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uOiByZXNvbHZlZEFnZW50RGVmLFxuICAgICAgfSlcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBsb2dFdmVudCgndGVuZ3Vfc2Vzc2lvbl9yZXN1bWVkJywge1xuICAgICAgICBlbnRyeXBvaW50OlxuICAgICAgICAgICdwaWNrZXInIGFzIEFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMsXG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgfSlcbiAgICAgIGxvZ0Vycm9yKGUgYXMgRXJyb3IpXG4gICAgICB0aHJvdyBlXG4gICAgfVxuICB9XG5cbiAgaWYgKGNyb3NzUHJvamVjdENvbW1hbmQpIHtcbiAgICByZXR1cm4gPENyb3NzUHJvamVjdE1lc3NhZ2UgY29tbWFuZD17Y3Jvc3NQcm9qZWN0Q29tbWFuZH0gLz5cbiAgfVxuXG4gIGlmIChyZXN1bWVEYXRhKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxSRVBMXG4gICAgICAgIGRlYnVnPXtkZWJ1Z31cbiAgICAgICAgY29tbWFuZHM9e2NvbW1hbmRzfVxuICAgICAgICBpbml0aWFsVG9vbHM9e2luaXRpYWxUb29sc31cbiAgICAgICAgaW5pdGlhbE1lc3NhZ2VzPXtyZXN1bWVEYXRhLm1lc3NhZ2VzfVxuICAgICAgICBpbml0aWFsRmlsZUhpc3RvcnlTbmFwc2hvdHM9e3Jlc3VtZURhdGEuZmlsZUhpc3RvcnlTbmFwc2hvdHN9XG4gICAgICAgIGluaXRpYWxDb250ZW50UmVwbGFjZW1lbnRzPXtyZXN1bWVEYXRhLmNvbnRlbnRSZXBsYWNlbWVudHN9XG4gICAgICAgIGluaXRpYWxBZ2VudE5hbWU9e3Jlc3VtZURhdGEuYWdlbnROYW1lfVxuICAgICAgICBpbml0aWFsQWdlbnRDb2xvcj17cmVzdW1lRGF0YS5hZ2VudENvbG9yfVxuICAgICAgICBtY3BDbGllbnRzPXttY3BDbGllbnRzfVxuICAgICAgICBkeW5hbWljTWNwQ29uZmlnPXtkeW5hbWljTWNwQ29uZmlnfVxuICAgICAgICBzdHJpY3RNY3BDb25maWc9e3N0cmljdE1jcENvbmZpZ31cbiAgICAgICAgc3lzdGVtUHJvbXB0PXtzeXN0ZW1Qcm9tcHR9XG4gICAgICAgIGFwcGVuZFN5c3RlbVByb21wdD17YXBwZW5kU3lzdGVtUHJvbXB0fVxuICAgICAgICBtYWluVGhyZWFkQWdlbnREZWZpbml0aW9uPXtyZXN1bWVEYXRhLm1haW5UaHJlYWRBZ2VudERlZmluaXRpb259XG4gICAgICAgIGF1dG9Db25uZWN0SWRlRmxhZz17YXV0b0Nvbm5lY3RJZGVGbGFnfVxuICAgICAgICBkaXNhYmxlU2xhc2hDb21tYW5kcz17ZGlzYWJsZVNsYXNoQ29tbWFuZHN9XG4gICAgICAgIHRhc2tMaXN0SWQ9e3Rhc2tMaXN0SWR9XG4gICAgICAgIHRoaW5raW5nQ29uZmlnPXt0aGlua2luZ0NvbmZpZ31cbiAgICAgICAgb25UdXJuQ29tcGxldGU9e29uVHVybkNvbXBsZXRlfVxuICAgICAgLz5cbiAgICApXG4gIH1cblxuICBpZiAobG9hZGluZykge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94PlxuICAgICAgICA8U3Bpbm5lciAvPlxuICAgICAgICA8VGV4dD4gTG9hZGluZyBjb252ZXJzYXRpb25z4oCmPC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgKVxuICB9XG5cbiAgaWYgKHJlc3VtaW5nKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3g+XG4gICAgICAgIDxTcGlubmVyIC8+XG4gICAgICAgIDxUZXh0PiBSZXN1bWluZyBjb252ZXJzYXRpb27igKY8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICBpZiAoZmlsdGVyZWRMb2dzLmxlbmd0aCA9PT0gMCkge1xuICAgIHJldHVybiA8Tm9Db252ZXJzYXRpb25zTWVzc2FnZSAvPlxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8TG9nU2VsZWN0b3JcbiAgICAgIGxvZ3M9e2ZpbHRlcmVkTG9nc31cbiAgICAgIG1heEhlaWdodD17cm93c31cbiAgICAgIG9uQ2FuY2VsPXtvbkNhbmNlbH1cbiAgICAgIG9uU2VsZWN0PXtvblNlbGVjdH1cbiAgICAgIG9uTG9nc0NoYW5nZWQ9e1xuICAgICAgICBpc1Jlc3VtZVdpdGhSZW5hbWVFbmFibGVkID8gKCkgPT4gbG9hZExvZ3Moc2hvd0FsbFByb2plY3RzKSA6IHVuZGVmaW5lZFxuICAgICAgfVxuICAgICAgb25Mb2FkTW9yZT17bG9hZE1vcmVMb2dzfVxuICAgICAgaW5pdGlhbFNlYXJjaFF1ZXJ5PXtpbml0aWFsU2VhcmNoUXVlcnl9XG4gICAgICBzaG93QWxsUHJvamVjdHM9e3Nob3dBbGxQcm9qZWN0c31cbiAgICAgIG9uVG9nZ2xlQWxsUHJvamVjdHM9e2hhbmRsZVRvZ2dsZUFsbFByb2plY3RzfVxuICAgICAgb25BZ2VudGljU2VhcmNoPXthZ2VudGljU2Vzc2lvblNlYXJjaH1cbiAgICAvPlxuICApXG59XG5cbmZ1bmN0aW9uIE5vQ29udmVyc2F0aW9uc01lc3NhZ2UoKTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgdXNlS2V5YmluZGluZyhcbiAgICAnYXBwOmludGVycnVwdCcsXG4gICAgKCkgPT4ge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGN1c3RvbS1ydWxlcy9uby1wcm9jZXNzLWV4aXRcbiAgICAgIHByb2Nlc3MuZXhpdCgxKVxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnR2xvYmFsJyB9LFxuICApXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxUZXh0Pk5vIGNvbnZlcnNhdGlvbnMgZm91bmQgdG8gcmVzdW1lLjwvVGV4dD5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPlByZXNzIEN0cmwrQyB0byBleGl0IGFuZCBzdGFydCBhIG5ldyBjb252ZXJzYXRpb24uPC9UZXh0PlxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIENyb3NzUHJvamVjdE1lc3NhZ2Uoe1xuICBjb21tYW5kLFxufToge1xuICBjb21tYW5kOiBzdHJpbmdcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjdXN0b20tcnVsZXMvbm8tcHJvY2Vzcy1leGl0XG4gICAgICBwcm9jZXNzLmV4aXQoMClcbiAgICB9LCAxMDApXG4gICAgcmV0dXJuICgpID0+IGNsZWFyVGltZW91dCh0aW1lb3V0KVxuICB9LCBbXSlcblxuICByZXR1cm4gKFxuICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGdhcD17MX0+XG4gICAgICA8VGV4dD5UaGlzIGNvbnZlcnNhdGlvbiBpcyBmcm9tIGEgZGlmZmVyZW50IGRpcmVjdG9yeS48L1RleHQ+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgPFRleHQ+VG8gcmVzdW1lLCBydW46PC9UZXh0PlxuICAgICAgICA8VGV4dD4ge2NvbW1hbmR9PC9UZXh0PlxuICAgICAgPC9Cb3g+XG4gICAgICA8VGV4dCBkaW1Db2xvcj4oQ29tbWFuZCBj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