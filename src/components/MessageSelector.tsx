import { c as _c } from "react/compiler-runtime";
import type { ContentBlockParam, TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs';
import { randomUUID, type UUID } from 'crypto';
import figures from 'figures';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS, logEvent } from 'src/services/analytics/index.js';
import { useAppState } from 'src/state/AppState.js';
import { type DiffStats, fileHistoryCanRestore, fileHistoryEnabled, fileHistoryGetDiffStats } from 'src/utils/fileHistory.js';
import { logError } from 'src/utils/log.js';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings.js';
import { Box, Text } from '../ink.js';
import { useKeybinding, useKeybindings } from '../keybindings/useKeybinding.js';
import type { Message, PartialCompactDirection, UserMessage } from '../types/message.js';
import { stripDisplayTags } from '../utils/displayTags.js';
import { createUserMessage, extractTag, isEmptyMessageText, isSyntheticMessage, isToolUseResultMessage } from '../utils/messages.js';
import { type OptionWithDescription, Select } from './CustomSelect/select.js';
import { Spinner } from './Spinner.js';
function isTextBlock(block: ContentBlockParam): block is TextBlockParam {
  return block.type === 'text';
}
import * as path from 'path';
import { useTerminalSize } from 'src/hooks/useTerminalSize.js';
import type { FileEditOutput } from 'src/tools/FileEditTool/types.js';
import type { Output as FileWriteToolOutput } from 'src/tools/FileWriteTool/FileWriteTool.js';
import { BASH_STDERR_TAG, BASH_STDOUT_TAG, COMMAND_MESSAGE_TAG, LOCAL_COMMAND_STDERR_TAG, LOCAL_COMMAND_STDOUT_TAG, TASK_NOTIFICATION_TAG, TEAMMATE_MESSAGE_TAG, TICK_TAG } from '../constants/xml.js';
import { count } from '../utils/array.js';
import { formatRelativeTimeAgo, truncate } from '../utils/format.js';
import type { Theme } from '../utils/theme.js';
import { Divider } from './design-system/Divider.js';
type RestoreOption = 'both' | 'conversation' | 'code' | 'summarize' | 'summarize_up_to' | 'nevermind';
function isSummarizeOption(option: RestoreOption | null): option is 'summarize' | 'summarize_up_to' {
  return option === 'summarize' || option === 'summarize_up_to';
}
type Props = {
  messages: Message[];
  onPreRestore: () => void;
  onRestoreMessage: (message: UserMessage) => Promise<void>;
  onRestoreCode: (message: UserMessage) => Promise<void>;
  onSummarize: (message: UserMessage, feedback?: string, direction?: PartialCompactDirection) => Promise<void>;
  onClose: () => void;
  /** Skip pick-list, land on confirm. Caller ran skip-check first. Esc closes fully (no back-to-list). */
  preselectedMessage?: UserMessage;
};
const MAX_VISIBLE_MESSAGES = 7;
export function MessageSelector({
  messages,
  onPreRestore,
  onRestoreMessage,
  onRestoreCode,
  onSummarize,
  onClose,
  preselectedMessage
}: Props): React.ReactNode {
  const fileHistory = useAppState(s => s.fileHistory);
  const [error, setError] = useState<string | undefined>(undefined);
  const isFileHistoryEnabled = fileHistoryEnabled();

  // Add current prompt as a virtual message
  const currentUUID = useMemo(randomUUID, []);
  const messageOptions = useMemo(() => [...messages.filter(selectableUserMessagesFilter), {
    ...createUserMessage({
      content: ''
    }),
    uuid: currentUUID
  } as UserMessage], [messages, currentUUID]);
  const [selectedIndex, setSelectedIndex] = useState(messageOptions.length - 1);

  // Orient the selected message as the middle of the visible options
  const firstVisibleIndex = Math.max(0, Math.min(selectedIndex - Math.floor(MAX_VISIBLE_MESSAGES / 2), messageOptions.length - MAX_VISIBLE_MESSAGES));
  const hasMessagesToSelect = messageOptions.length > 1;
  const [messageToRestore, setMessageToRestore] = useState<UserMessage | undefined>(preselectedMessage);
  const [diffStatsForRestore, setDiffStatsForRestore] = useState<DiffStats | undefined>(undefined);
  useEffect(() => {
    if (!preselectedMessage || !isFileHistoryEnabled) return;
    let cancelled = false;
    void fileHistoryGetDiffStats(fileHistory, preselectedMessage.uuid).then(stats => {
      if (!cancelled) setDiffStatsForRestore(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [preselectedMessage, isFileHistoryEnabled, fileHistory]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoringOption, setRestoringOption] = useState<RestoreOption | null>(null);
  const [selectedRestoreOption, setSelectedRestoreOption] = useState<RestoreOption>('both');
  // Per-option feedback state; Select's internal inputValues Map persists
  // per-option text independently, so sharing one variable would desync.
  const [summarizeFromFeedback, setSummarizeFromFeedback] = useState('');
  const [summarizeUpToFeedback, setSummarizeUpToFeedback] = useState('');

  // Generate options with summarize as input type for inline context
  function getRestoreOptions(canRestoreCode: boolean): OptionWithDescription<RestoreOption>[] {
    const baseOptions: OptionWithDescription<RestoreOption>[] = canRestoreCode ? [{
      value: 'both',
      label: 'Restore code and conversation'
    }, {
      value: 'conversation',
      label: 'Restore conversation'
    }, {
      value: 'code',
      label: 'Restore code'
    }] : [{
      value: 'conversation',
      label: 'Restore conversation'
    }];
    const summarizeInputProps = {
      type: 'input' as const,
      placeholder: 'add context (optional)',
      initialValue: '',
      allowEmptySubmitToCancel: true,
      showLabelWithValue: true,
      labelValueSeparator: ': '
    };
    baseOptions.push({
      value: 'summarize',
      label: 'Summarize from here',
      ...summarizeInputProps,
      onChange: setSummarizeFromFeedback
    });
    if ("external" === 'ant') {
      baseOptions.push({
        value: 'summarize_up_to',
        label: 'Summarize up to here',
        ...summarizeInputProps,
        onChange: setSummarizeUpToFeedback
      });
    }
    baseOptions.push({
      value: 'nevermind',
      label: 'Never mind'
    });
    return baseOptions;
  }

  // Log when selector is opened
  useEffect(() => {
    logEvent('tengu_message_selector_opened', {});
  }, []);

  // Helper to restore conversation without confirmation
  async function restoreConversationDirectly(message: UserMessage) {
    onPreRestore();
    setIsRestoring(true);
    try {
      await onRestoreMessage(message);
      setIsRestoring(false);
      onClose();
    } catch (error_0) {
      logError(error_0 as Error);
      setIsRestoring(false);
      setError(`Failed to restore the conversation:\n${error_0}`);
    }
  }
  async function handleSelect(message_0: UserMessage) {
    const index = messages.indexOf(message_0);
    const indexFromEnd = messages.length - 1 - index;
    logEvent('tengu_message_selector_selected', {
      index_from_end: indexFromEnd,
      message_type: message_0.type as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      is_current_prompt: false
    });

    // Do nothing if the message is not found
    if (!messages.includes(message_0)) {
      onClose();
      return;
    }
    if (!isFileHistoryEnabled) {
      await restoreConversationDirectly(message_0);
      return;
    }
    const diffStats = await fileHistoryGetDiffStats(fileHistory, message_0.uuid);
    setMessageToRestore(message_0);
    setDiffStatsForRestore(diffStats);
  }
  async function onSelectRestoreOption(option: RestoreOption) {
    logEvent('tengu_message_selector_restore_option_selected', {
      option: option as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
    });
    if (!messageToRestore) {
      setError('Message not found.');
      return;
    }
    if (option === 'nevermind') {
      if (preselectedMessage) onClose();else setMessageToRestore(undefined);
      return;
    }
    if (isSummarizeOption(option)) {
      onPreRestore();
      setIsRestoring(true);
      setRestoringOption(option);
      setError(undefined);
      try {
        const direction = option === 'summarize_up_to' ? 'up_to' : 'from';
        const feedback = (direction === 'up_to' ? summarizeUpToFeedback : summarizeFromFeedback).trim() || undefined;
        await onSummarize(messageToRestore, feedback, direction);
        setIsRestoring(false);
        setRestoringOption(null);
        setMessageToRestore(undefined);
        onClose();
      } catch (error_1) {
        logError(error_1 as Error);
        setIsRestoring(false);
        setRestoringOption(null);
        setMessageToRestore(undefined);
        setError(`Failed to summarize:\n${error_1}`);
      }
      return;
    }
    onPreRestore();
    setIsRestoring(true);
    setError(undefined);
    let codeError: Error | null = null;
    let conversationError: Error | null = null;
    if (option === 'code' || option === 'both') {
      try {
        await onRestoreCode(messageToRestore);
      } catch (error_2) {
        codeError = error_2 as Error;
        logError(codeError);
      }
    }
    if (option === 'conversation' || option === 'both') {
      try {
        await onRestoreMessage(messageToRestore);
      } catch (error_3) {
        conversationError = error_3 as Error;
        logError(conversationError);
      }
    }
    setIsRestoring(false);
    setMessageToRestore(undefined);

    // Handle errors
    if (conversationError && codeError) {
      setError(`Failed to restore the conversation and code:\n${conversationError}\n${codeError}`);
    } else if (conversationError) {
      setError(`Failed to restore the conversation:\n${conversationError}`);
    } else if (codeError) {
      setError(`Failed to restore the code:\n${codeError}`);
    } else {
      // Success - close the selector
      onClose();
    }
  }
  const exitState = useExitOnCtrlCDWithKeybindings();
  const handleEscape = useCallback(() => {
    if (messageToRestore && !preselectedMessage) {
      // Go back to message list instead of closing entirely
      setMessageToRestore(undefined);
      return;
    }
    logEvent('tengu_message_selector_cancelled', {});
    onClose();
  }, [onClose, messageToRestore, preselectedMessage]);
  const moveUp = useCallback(() => setSelectedIndex(prev => Math.max(0, prev - 1)), []);
  const moveDown = useCallback(() => setSelectedIndex(prev_0 => Math.min(messageOptions.length - 1, prev_0 + 1)), [messageOptions.length]);
  const jumpToTop = useCallback(() => setSelectedIndex(0), []);
  const jumpToBottom = useCallback(() => setSelectedIndex(messageOptions.length - 1), [messageOptions.length]);
  const handleSelectCurrent = useCallback(() => {
    const selected = messageOptions[selectedIndex];
    if (selected) {
      void handleSelect(selected);
    }
  }, [messageOptions, selectedIndex, handleSelect]);

  // Escape to close - uses Confirmation context where escape is bound
  useKeybinding('confirm:no', handleEscape, {
    context: 'Confirmation',
    isActive: !messageToRestore
  });

  // Message selector navigation keybindings
  useKeybindings({
    'messageSelector:up': moveUp,
    'messageSelector:down': moveDown,
    'messageSelector:top': jumpToTop,
    'messageSelector:bottom': jumpToBottom,
    'messageSelector:select': handleSelectCurrent
  }, {
    context: 'MessageSelector',
    isActive: !isRestoring && !error && !messageToRestore && hasMessagesToSelect
  });
  const [fileHistoryMetadata, setFileHistoryMetadata] = useState<Record<number, DiffStats>>({});
  useEffect(() => {
    async function loadFileHistoryMetadata() {
      if (!isFileHistoryEnabled) {
        return;
      }
      // Load file snapshot metadata
      void Promise.all(messageOptions.map(async (userMessage, itemIndex) => {
        if (userMessage.uuid !== currentUUID) {
          const canRestore = fileHistoryCanRestore(fileHistory, userMessage.uuid);
          const nextUserMessage = messageOptions.at(itemIndex + 1);
          const diffStats_0 = canRestore ? computeDiffStatsBetweenMessages(messages, userMessage.uuid, nextUserMessage?.uuid !== currentUUID ? nextUserMessage?.uuid : undefined) : undefined;
          if (diffStats_0 !== undefined) {
            setFileHistoryMetadata(prev_1 => ({
              ...prev_1,
              [itemIndex]: diffStats_0
            }));
          } else {
            setFileHistoryMetadata(prev_2 => ({
              ...prev_2,
              [itemIndex]: undefined
            }));
          }
        }
      }));
    }
    void loadFileHistoryMetadata();
  }, [messageOptions, messages, currentUUID, fileHistory, isFileHistoryEnabled]);
  const canRestoreCode_0 = isFileHistoryEnabled && diffStatsForRestore?.filesChanged && diffStatsForRestore.filesChanged.length > 0;
  const showPickList = !error && !messageToRestore && !preselectedMessage && hasMessagesToSelect;
  return <Box flexDirection="column" width="100%">
      <Divider color="suggestion" />
      <Box flexDirection="column" marginX={1} gap={1}>
        <Text bold color="suggestion">
          Rewind
        </Text>

        {error && <>
            <Text color="error">Error: {error}</Text>
          </>}
        {!hasMessagesToSelect && <>
            <Text>Nothing to rewind to yet.</Text>
          </>}
        {!error && messageToRestore && hasMessagesToSelect && <>
            <Text>
              Confirm you want to restore{' '}
              {!diffStatsForRestore && 'the conversation '}to the point before
              you sent this message:
            </Text>
            <Box flexDirection="column" paddingLeft={1} borderStyle="single" borderRight={false} borderTop={false} borderBottom={false} borderLeft={true} borderLeftDimColor>
              <UserMessageOption userMessage={messageToRestore} color="text" isCurrent={false} />
              <Text dimColor>
                ({formatRelativeTimeAgo(new Date(messageToRestore.timestamp))})
              </Text>
            </Box>
            <RestoreOptionDescription selectedRestoreOption={selectedRestoreOption} canRestoreCode={!!canRestoreCode_0} diffStatsForRestore={diffStatsForRestore} />
            {isRestoring && isSummarizeOption(restoringOption) ? <Box flexDirection="row" gap={1}>
                <Spinner />
                <Text>Summarizing…</Text>
              </Box> : <Select isDisabled={isRestoring} options={getRestoreOptions(!!canRestoreCode_0)} defaultFocusValue={canRestoreCode_0 ? 'both' : 'conversation'} onFocus={value => setSelectedRestoreOption(value as RestoreOption)} onChange={value_0 => onSelectRestoreOption(value_0 as RestoreOption)} onCancel={() => preselectedMessage ? onClose() : setMessageToRestore(undefined)} />}
            {canRestoreCode_0 && <Box marginBottom={1}>
                <Text dimColor>
                  {figures.warning} Rewinding does not affect files edited
                  manually or via bash.
                </Text>
              </Box>}
          </>}
        {showPickList && <>
            {isFileHistoryEnabled ? <Text>
                Restore the code and/or conversation to the point before…
              </Text> : <Text>
                Restore and fork the conversation to the point before…
              </Text>}
            <Box width="100%" flexDirection="column">
              {messageOptions.slice(firstVisibleIndex, firstVisibleIndex + MAX_VISIBLE_MESSAGES).map((msg, visibleOptionIndex) => {
            const optionIndex = firstVisibleIndex + visibleOptionIndex;
            const isSelected = optionIndex === selectedIndex;
            const isCurrent = msg.uuid === currentUUID;
            const metadataLoaded = optionIndex in fileHistoryMetadata;
            const metadata = fileHistoryMetadata[optionIndex];
            const numFilesChanged = metadata?.filesChanged && metadata.filesChanged.length;
            return <Box key={msg.uuid} height={isFileHistoryEnabled ? 3 : 2} overflow="hidden" width="100%" flexDirection="row">
                      <Box width={2} minWidth={2}>
                        {isSelected ? <Text color="permission" bold>
                            {figures.pointer}{' '}
                          </Text> : <Text>{'  '}</Text>}
                      </Box>
                      <Box flexDirection="column">
                        <Box flexShrink={1} height={1} overflow="hidden">
                          <UserMessageOption userMessage={msg} color={isSelected ? 'suggestion' : undefined} isCurrent={isCurrent} paddingRight={10} />
                        </Box>
                        {isFileHistoryEnabled && metadataLoaded && <Box height={1} flexDirection="row">
                            {metadata ? <>
                                <Text dimColor={!isSelected} color="inactive">
                                  {numFilesChanged ? <>
                                      {numFilesChanged === 1 && metadata.filesChanged![0] ? `${path.basename(metadata.filesChanged![0])} ` : `${numFilesChanged} files changed `}
                                      <DiffStatsText diffStats={metadata} />
                                    </> : <>No code changes</>}
                                </Text>
                              </> : <Text dimColor color="warning">
                                {figures.warning} No code restore
                              </Text>}
                          </Box>}
                      </Box>
                    </Box>;
          })}
            </Box>
          </>}
        {!messageToRestore && <Text dimColor italic>
            {exitState.pending ? <>Press {exitState.keyName} again to exit</> : <>
                {!error && hasMessagesToSelect && 'Enter to continue · '}Esc to
                exit
              </>}
          </Text>}
      </Box>
    </Box>;
}
function getRestoreOptionConversationText(option: RestoreOption): string {
  switch (option) {
    case 'summarize':
      return 'Messages after this point will be summarized.';
    case 'summarize_up_to':
      return 'Preceding messages will be summarized. This and subsequent messages will remain unchanged — you will stay at the end of the conversation.';
    case 'both':
    case 'conversation':
      return 'The conversation will be forked.';
    case 'code':
    case 'nevermind':
      return 'The conversation will be unchanged.';
  }
}
function RestoreOptionDescription(t0) {
  const $ = _c(11);
  const {
    selectedRestoreOption,
    canRestoreCode,
    diffStatsForRestore
  } = t0;
  const showCodeRestore = canRestoreCode && (selectedRestoreOption === "both" || selectedRestoreOption === "code");
  let t1;
  if ($[0] !== selectedRestoreOption) {
    t1 = getRestoreOptionConversationText(selectedRestoreOption);
    $[0] = selectedRestoreOption;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] !== t1) {
    t2 = <Text dimColor={true}>{t1}</Text>;
    $[2] = t1;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] !== diffStatsForRestore || $[5] !== selectedRestoreOption || $[6] !== showCodeRestore) {
    t3 = !isSummarizeOption(selectedRestoreOption) && (showCodeRestore ? <RestoreCodeConfirmation diffStatsForRestore={diffStatsForRestore} /> : <Text dimColor={true}>The code will be unchanged.</Text>);
    $[4] = diffStatsForRestore;
    $[5] = selectedRestoreOption;
    $[6] = showCodeRestore;
    $[7] = t3;
  } else {
    t3 = $[7];
  }
  let t4;
  if ($[8] !== t2 || $[9] !== t3) {
    t4 = <Box flexDirection="column">{t2}{t3}</Box>;
    $[8] = t2;
    $[9] = t3;
    $[10] = t4;
  } else {
    t4 = $[10];
  }
  return t4;
}
function RestoreCodeConfirmation(t0) {
  const $ = _c(14);
  const {
    diffStatsForRestore
  } = t0;
  if (diffStatsForRestore === undefined) {
    return;
  }
  if (!diffStatsForRestore.filesChanged || !diffStatsForRestore.filesChanged[0]) {
    let t1;
    if ($[0] === Symbol.for("react.memo_cache_sentinel")) {
      t1 = <Text dimColor={true}>The code has not changed (nothing will be restored).</Text>;
      $[0] = t1;
    } else {
      t1 = $[0];
    }
    return t1;
  }
  const numFilesChanged = diffStatsForRestore.filesChanged.length;
  let fileLabel;
  if (numFilesChanged === 1) {
    let t1;
    if ($[1] !== diffStatsForRestore.filesChanged[0]) {
      t1 = path.basename(diffStatsForRestore.filesChanged[0] || "");
      $[1] = diffStatsForRestore.filesChanged[0];
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    fileLabel = t1;
  } else {
    if (numFilesChanged === 2) {
      let t1;
      if ($[3] !== diffStatsForRestore.filesChanged[0]) {
        t1 = path.basename(diffStatsForRestore.filesChanged[0] || "");
        $[3] = diffStatsForRestore.filesChanged[0];
        $[4] = t1;
      } else {
        t1 = $[4];
      }
      const file1 = t1;
      let t2;
      if ($[5] !== diffStatsForRestore.filesChanged[1]) {
        t2 = path.basename(diffStatsForRestore.filesChanged[1] || "");
        $[5] = diffStatsForRestore.filesChanged[1];
        $[6] = t2;
      } else {
        t2 = $[6];
      }
      const file2 = t2;
      fileLabel = `${file1} and ${file2}`;
    } else {
      let t1;
      if ($[7] !== diffStatsForRestore.filesChanged[0]) {
        t1 = path.basename(diffStatsForRestore.filesChanged[0] || "");
        $[7] = diffStatsForRestore.filesChanged[0];
        $[8] = t1;
      } else {
        t1 = $[8];
      }
      const file1_0 = t1;
      fileLabel = `${file1_0} and ${diffStatsForRestore.filesChanged.length - 1} other files`;
    }
  }
  let t1;
  if ($[9] !== diffStatsForRestore) {
    t1 = <DiffStatsText diffStats={diffStatsForRestore} />;
    $[9] = diffStatsForRestore;
    $[10] = t1;
  } else {
    t1 = $[10];
  }
  let t2;
  if ($[11] !== fileLabel || $[12] !== t1) {
    t2 = <><Text dimColor={true}>The code will be restored{" "}{t1} in {fileLabel}.</Text></>;
    $[11] = fileLabel;
    $[12] = t1;
    $[13] = t2;
  } else {
    t2 = $[13];
  }
  return t2;
}
function DiffStatsText(t0) {
  const $ = _c(7);
  const {
    diffStats
  } = t0;
  if (!diffStats || !diffStats.filesChanged) {
    return;
  }
  let t1;
  if ($[0] !== diffStats.insertions) {
    t1 = <Text color="diffAddedWord">+{diffStats.insertions} </Text>;
    $[0] = diffStats.insertions;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  let t2;
  if ($[2] !== diffStats.deletions) {
    t2 = <Text color="diffRemovedWord">-{diffStats.deletions}</Text>;
    $[2] = diffStats.deletions;
    $[3] = t2;
  } else {
    t2 = $[3];
  }
  let t3;
  if ($[4] !== t1 || $[5] !== t2) {
    t3 = <>{t1}{t2}</>;
    $[4] = t1;
    $[5] = t2;
    $[6] = t3;
  } else {
    t3 = $[6];
  }
  return t3;
}
function UserMessageOption(t0) {
  const $ = _c(31);
  const {
    userMessage,
    color,
    dimColor,
    isCurrent,
    paddingRight
  } = t0;
  const {
    columns
  } = useTerminalSize();
  if (isCurrent) {
    let t1;
    if ($[0] !== color || $[1] !== dimColor) {
      t1 = <Box width="100%"><Text italic={true} color={color} dimColor={dimColor}>(current)</Text></Box>;
      $[0] = color;
      $[1] = dimColor;
      $[2] = t1;
    } else {
      t1 = $[2];
    }
    return t1;
  }
  const content = userMessage.message.content;
  const lastBlock = typeof content === "string" ? null : content[content.length - 1];
  let T0;
  let T1;
  let t1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  if ($[3] !== color || $[4] !== columns || $[5] !== content || $[6] !== dimColor || $[7] !== lastBlock || $[8] !== paddingRight) {
    t6 = Symbol.for("react.early_return_sentinel");
    bb0: {
      const rawMessageText = typeof content === "string" ? content.trim() : lastBlock && isTextBlock(lastBlock) ? lastBlock.text.trim() : "(no prompt)";
      const messageText = stripDisplayTags(rawMessageText);
      if (isEmptyMessageText(messageText)) {
        let t7;
        if ($[17] !== color || $[18] !== dimColor) {
          t7 = <Box flexDirection="row" width="100%"><Text italic={true} color={color} dimColor={dimColor}>((empty message))</Text></Box>;
          $[17] = color;
          $[18] = dimColor;
          $[19] = t7;
        } else {
          t7 = $[19];
        }
        t6 = t7;
        break bb0;
      }
      if (messageText.includes("<bash-input>")) {
        const input = extractTag(messageText, "bash-input");
        if (input) {
          let t7;
          if ($[20] === Symbol.for("react.memo_cache_sentinel")) {
            t7 = <Text color="bashBorder">!</Text>;
            $[20] = t7;
          } else {
            t7 = $[20];
          }
          t6 = <Box flexDirection="row" width="100%">{t7}<Text color={color} dimColor={dimColor}>{" "}{input}</Text></Box>;
          break bb0;
        }
      }
      if (messageText.includes(`<${COMMAND_MESSAGE_TAG}>`)) {
        const commandMessage = extractTag(messageText, COMMAND_MESSAGE_TAG);
        const args = extractTag(messageText, "command-args");
        const isSkillFormat = extractTag(messageText, "skill-format") === "true";
        if (commandMessage) {
          if (isSkillFormat) {
            t6 = <Box flexDirection="row" width="100%"><Text color={color} dimColor={dimColor}>Skill({commandMessage})</Text></Box>;
            break bb0;
          } else {
            t6 = <Box flexDirection="row" width="100%"><Text color={color} dimColor={dimColor}>/{commandMessage} {args}</Text></Box>;
            break bb0;
          }
        }
      }
      T1 = Box;
      t4 = "row";
      t5 = "100%";
      T0 = Text;
      t1 = color;
      t2 = dimColor;
      t3 = paddingRight ? truncate(messageText, columns - paddingRight, true) : messageText.slice(0, 500).split("\n").slice(0, 4).join("\n");
    }
    $[3] = color;
    $[4] = columns;
    $[5] = content;
    $[6] = dimColor;
    $[7] = lastBlock;
    $[8] = paddingRight;
    $[9] = T0;
    $[10] = T1;
    $[11] = t1;
    $[12] = t2;
    $[13] = t3;
    $[14] = t4;
    $[15] = t5;
    $[16] = t6;
  } else {
    T0 = $[9];
    T1 = $[10];
    t1 = $[11];
    t2 = $[12];
    t3 = $[13];
    t4 = $[14];
    t5 = $[15];
    t6 = $[16];
  }
  if (t6 !== Symbol.for("react.early_return_sentinel")) {
    return t6;
  }
  let t7;
  if ($[21] !== T0 || $[22] !== t1 || $[23] !== t2 || $[24] !== t3) {
    t7 = <T0 color={t1} dimColor={t2}>{t3}</T0>;
    $[21] = T0;
    $[22] = t1;
    $[23] = t2;
    $[24] = t3;
    $[25] = t7;
  } else {
    t7 = $[25];
  }
  let t8;
  if ($[26] !== T1 || $[27] !== t4 || $[28] !== t5 || $[29] !== t7) {
    t8 = <T1 flexDirection={t4} width={t5}>{t7}</T1>;
    $[26] = T1;
    $[27] = t4;
    $[28] = t5;
    $[29] = t7;
    $[30] = t8;
  } else {
    t8 = $[30];
  }
  return t8;
}

/**
 * Computes the diff stats for all the file edits in-between two messages.
 */
function computeDiffStatsBetweenMessages(messages: Message[], fromMessageId: UUID, toMessageId: UUID | undefined): DiffStats | undefined {
  const startIndex = messages.findIndex(msg => msg.uuid === fromMessageId);
  if (startIndex === -1) {
    return undefined;
  }
  let endIndex = toMessageId ? messages.findIndex(msg => msg.uuid === toMessageId) : messages.length;
  if (endIndex === -1) {
    endIndex = messages.length;
  }
  const filesChanged: string[] = [];
  let insertions = 0;
  let deletions = 0;
  for (let i = startIndex + 1; i < endIndex; i++) {
    const msg = messages[i];
    if (!msg || !isToolUseResultMessage(msg)) {
      continue;
    }
    const result = msg.toolUseResult as FileEditOutput | FileWriteToolOutput;
    if (!result || !result.filePath || !result.structuredPatch) {
      continue;
    }
    if (!filesChanged.includes(result.filePath)) {
      filesChanged.push(result.filePath);
    }
    try {
      if ('type' in result && result.type === 'create') {
        insertions += result.content.split(/\r?\n/).length;
      } else {
        for (const hunk of result.structuredPatch) {
          const additions = count(hunk.lines, line => line.startsWith('+'));
          const removals = count(hunk.lines, line => line.startsWith('-'));
          insertions += additions;
          deletions += removals;
        }
      }
    } catch {
      continue;
    }
  }
  return {
    filesChanged,
    insertions,
    deletions
  };
}
export function selectableUserMessagesFilter(message: Message): message is UserMessage {
  if (message.type !== 'user') {
    return false;
  }
  if (Array.isArray(message.message.content) && message.message.content[0]?.type === 'tool_result') {
    return false;
  }
  if (isSyntheticMessage(message)) {
    return false;
  }
  if (message.isMeta) {
    return false;
  }
  if (message.isCompactSummary || message.isVisibleInTranscriptOnly) {
    return false;
  }
  const content = message.message.content;
  const lastBlock = typeof content === 'string' ? null : content[content.length - 1];
  const messageText = typeof content === 'string' ? content.trim() : lastBlock && isTextBlock(lastBlock) ? lastBlock.text.trim() : '';

  // Filter out non-user-authored messages (command outputs, task notifications, ticks).
  if (messageText.indexOf(`<${LOCAL_COMMAND_STDOUT_TAG}>`) !== -1 || messageText.indexOf(`<${LOCAL_COMMAND_STDERR_TAG}>`) !== -1 || messageText.indexOf(`<${BASH_STDOUT_TAG}>`) !== -1 || messageText.indexOf(`<${BASH_STDERR_TAG}>`) !== -1 || messageText.indexOf(`<${TASK_NOTIFICATION_TAG}>`) !== -1 || messageText.indexOf(`<${TICK_TAG}>`) !== -1 || messageText.indexOf(`<${TEAMMATE_MESSAGE_TAG}`) !== -1) {
    return false;
  }
  return true;
}

/**
 * Checks if all messages after the given index are synthetic (interruptions, cancels, etc.)
 * or non-meaningful content. Returns true if there's nothing meaningful to confirm -
 * for example, if the user hit enter then immediately cancelled.
 */
export function messagesAfterAreOnlySynthetic(messages: Message[], fromIndex: number): boolean {
  for (let i = fromIndex + 1; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue;

    // Skip known non-meaningful message types
    if (isSyntheticMessage(msg)) continue;
    if (isToolUseResultMessage(msg)) continue;
    if (msg.type === 'progress') continue;
    if (msg.type === 'system') continue;
    if (msg.type === 'attachment') continue;
    if (msg.type === 'user' && msg.isMeta) continue;

    // Assistant with actual content = meaningful
    if (msg.type === 'assistant') {
      const content = msg.message.content;
      if (Array.isArray(content)) {
        const hasMeaningfulContent = content.some(block => block.type === 'text' && block.text.trim() || block.type === 'tool_use');
        if (hasMeaningfulContent) return false;
      }
      continue;
    }

    // User messages that aren't synthetic or meta = meaningful
    if (msg.type === 'user') {
      return false;
    }

    // Other types (e.g., tombstone) are non-meaningful, continue
  }
  return true;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJDb250ZW50QmxvY2tQYXJhbSIsIlRleHRCbG9ja1BhcmFtIiwicmFuZG9tVVVJRCIsIlVVSUQiLCJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZUVmZmVjdCIsInVzZU1lbW8iLCJ1c2VTdGF0ZSIsIkFuYWx5dGljc01ldGFkYXRhX0lfVkVSSUZJRURfVEhJU19JU19OT1RfQ09ERV9PUl9GSUxFUEFUSFMiLCJsb2dFdmVudCIsInVzZUFwcFN0YXRlIiwiRGlmZlN0YXRzIiwiZmlsZUhpc3RvcnlDYW5SZXN0b3JlIiwiZmlsZUhpc3RvcnlFbmFibGVkIiwiZmlsZUhpc3RvcnlHZXREaWZmU3RhdHMiLCJsb2dFcnJvciIsInVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncyIsIkJveCIsIlRleHQiLCJ1c2VLZXliaW5kaW5nIiwidXNlS2V5YmluZGluZ3MiLCJNZXNzYWdlIiwiUGFydGlhbENvbXBhY3REaXJlY3Rpb24iLCJVc2VyTWVzc2FnZSIsInN0cmlwRGlzcGxheVRhZ3MiLCJjcmVhdGVVc2VyTWVzc2FnZSIsImV4dHJhY3RUYWciLCJpc0VtcHR5TWVzc2FnZVRleHQiLCJpc1N5bnRoZXRpY01lc3NhZ2UiLCJpc1Rvb2xVc2VSZXN1bHRNZXNzYWdlIiwiT3B0aW9uV2l0aERlc2NyaXB0aW9uIiwiU2VsZWN0IiwiU3Bpbm5lciIsImlzVGV4dEJsb2NrIiwiYmxvY2siLCJ0eXBlIiwicGF0aCIsInVzZVRlcm1pbmFsU2l6ZSIsIkZpbGVFZGl0T3V0cHV0IiwiT3V0cHV0IiwiRmlsZVdyaXRlVG9vbE91dHB1dCIsIkJBU0hfU1RERVJSX1RBRyIsIkJBU0hfU1RET1VUX1RBRyIsIkNPTU1BTkRfTUVTU0FHRV9UQUciLCJMT0NBTF9DT01NQU5EX1NUREVSUl9UQUciLCJMT0NBTF9DT01NQU5EX1NURE9VVF9UQUciLCJUQVNLX05PVElGSUNBVElPTl9UQUciLCJURUFNTUFURV9NRVNTQUdFX1RBRyIsIlRJQ0tfVEFHIiwiY291bnQiLCJmb3JtYXRSZWxhdGl2ZVRpbWVBZ28iLCJ0cnVuY2F0ZSIsIlRoZW1lIiwiRGl2aWRlciIsIlJlc3RvcmVPcHRpb24iLCJpc1N1bW1hcml6ZU9wdGlvbiIsIm9wdGlvbiIsIlByb3BzIiwibWVzc2FnZXMiLCJvblByZVJlc3RvcmUiLCJvblJlc3RvcmVNZXNzYWdlIiwibWVzc2FnZSIsIlByb21pc2UiLCJvblJlc3RvcmVDb2RlIiwib25TdW1tYXJpemUiLCJmZWVkYmFjayIsImRpcmVjdGlvbiIsIm9uQ2xvc2UiLCJwcmVzZWxlY3RlZE1lc3NhZ2UiLCJNQVhfVklTSUJMRV9NRVNTQUdFUyIsIk1lc3NhZ2VTZWxlY3RvciIsIlJlYWN0Tm9kZSIsImZpbGVIaXN0b3J5IiwicyIsImVycm9yIiwic2V0RXJyb3IiLCJ1bmRlZmluZWQiLCJpc0ZpbGVIaXN0b3J5RW5hYmxlZCIsImN1cnJlbnRVVUlEIiwibWVzc2FnZU9wdGlvbnMiLCJmaWx0ZXIiLCJzZWxlY3RhYmxlVXNlck1lc3NhZ2VzRmlsdGVyIiwiY29udGVudCIsInV1aWQiLCJzZWxlY3RlZEluZGV4Iiwic2V0U2VsZWN0ZWRJbmRleCIsImxlbmd0aCIsImZpcnN0VmlzaWJsZUluZGV4IiwiTWF0aCIsIm1heCIsIm1pbiIsImZsb29yIiwiaGFzTWVzc2FnZXNUb1NlbGVjdCIsIm1lc3NhZ2VUb1Jlc3RvcmUiLCJzZXRNZXNzYWdlVG9SZXN0b3JlIiwiZGlmZlN0YXRzRm9yUmVzdG9yZSIsInNldERpZmZTdGF0c0ZvclJlc3RvcmUiLCJjYW5jZWxsZWQiLCJ0aGVuIiwic3RhdHMiLCJpc1Jlc3RvcmluZyIsInNldElzUmVzdG9yaW5nIiwicmVzdG9yaW5nT3B0aW9uIiwic2V0UmVzdG9yaW5nT3B0aW9uIiwic2VsZWN0ZWRSZXN0b3JlT3B0aW9uIiwic2V0U2VsZWN0ZWRSZXN0b3JlT3B0aW9uIiwic3VtbWFyaXplRnJvbUZlZWRiYWNrIiwic2V0U3VtbWFyaXplRnJvbUZlZWRiYWNrIiwic3VtbWFyaXplVXBUb0ZlZWRiYWNrIiwic2V0U3VtbWFyaXplVXBUb0ZlZWRiYWNrIiwiZ2V0UmVzdG9yZU9wdGlvbnMiLCJjYW5SZXN0b3JlQ29kZSIsImJhc2VPcHRpb25zIiwidmFsdWUiLCJsYWJlbCIsInN1bW1hcml6ZUlucHV0UHJvcHMiLCJjb25zdCIsInBsYWNlaG9sZGVyIiwiaW5pdGlhbFZhbHVlIiwiYWxsb3dFbXB0eVN1Ym1pdFRvQ2FuY2VsIiwic2hvd0xhYmVsV2l0aFZhbHVlIiwibGFiZWxWYWx1ZVNlcGFyYXRvciIsInB1c2giLCJvbkNoYW5nZSIsInJlc3RvcmVDb252ZXJzYXRpb25EaXJlY3RseSIsIkVycm9yIiwiaGFuZGxlU2VsZWN0IiwiaW5kZXgiLCJpbmRleE9mIiwiaW5kZXhGcm9tRW5kIiwiaW5kZXhfZnJvbV9lbmQiLCJtZXNzYWdlX3R5cGUiLCJpc19jdXJyZW50X3Byb21wdCIsImluY2x1ZGVzIiwiZGlmZlN0YXRzIiwib25TZWxlY3RSZXN0b3JlT3B0aW9uIiwidHJpbSIsImNvZGVFcnJvciIsImNvbnZlcnNhdGlvbkVycm9yIiwiZXhpdFN0YXRlIiwiaGFuZGxlRXNjYXBlIiwibW92ZVVwIiwicHJldiIsIm1vdmVEb3duIiwianVtcFRvVG9wIiwianVtcFRvQm90dG9tIiwiaGFuZGxlU2VsZWN0Q3VycmVudCIsInNlbGVjdGVkIiwiY29udGV4dCIsImlzQWN0aXZlIiwiZmlsZUhpc3RvcnlNZXRhZGF0YSIsInNldEZpbGVIaXN0b3J5TWV0YWRhdGEiLCJSZWNvcmQiLCJsb2FkRmlsZUhpc3RvcnlNZXRhZGF0YSIsImFsbCIsIm1hcCIsInVzZXJNZXNzYWdlIiwiaXRlbUluZGV4IiwiY2FuUmVzdG9yZSIsIm5leHRVc2VyTWVzc2FnZSIsImF0IiwiY29tcHV0ZURpZmZTdGF0c0JldHdlZW5NZXNzYWdlcyIsImZpbGVzQ2hhbmdlZCIsInNob3dQaWNrTGlzdCIsIkRhdGUiLCJ0aW1lc3RhbXAiLCJ3YXJuaW5nIiwic2xpY2UiLCJtc2ciLCJ2aXNpYmxlT3B0aW9uSW5kZXgiLCJvcHRpb25JbmRleCIsImlzU2VsZWN0ZWQiLCJpc0N1cnJlbnQiLCJtZXRhZGF0YUxvYWRlZCIsIm1ldGFkYXRhIiwibnVtRmlsZXNDaGFuZ2VkIiwicG9pbnRlciIsImJhc2VuYW1lIiwicGVuZGluZyIsImtleU5hbWUiLCJnZXRSZXN0b3JlT3B0aW9uQ29udmVyc2F0aW9uVGV4dCIsIlJlc3RvcmVPcHRpb25EZXNjcmlwdGlvbiIsInQwIiwiJCIsIl9jIiwic2hvd0NvZGVSZXN0b3JlIiwidDEiLCJ0MiIsInQzIiwidDQiLCJSZXN0b3JlQ29kZUNvbmZpcm1hdGlvbiIsIlN5bWJvbCIsImZvciIsImZpbGVMYWJlbCIsImZpbGUxIiwiZmlsZTIiLCJmaWxlMV8wIiwiRGlmZlN0YXRzVGV4dCIsImluc2VydGlvbnMiLCJkZWxldGlvbnMiLCJVc2VyTWVzc2FnZU9wdGlvbiIsImNvbG9yIiwiZGltQ29sb3IiLCJwYWRkaW5nUmlnaHQiLCJjb2x1bW5zIiwibGFzdEJsb2NrIiwiVDAiLCJUMSIsInQ1IiwidDYiLCJiYjAiLCJyYXdNZXNzYWdlVGV4dCIsInRleHQiLCJtZXNzYWdlVGV4dCIsInQ3IiwiaW5wdXQiLCJjb21tYW5kTWVzc2FnZSIsImFyZ3MiLCJpc1NraWxsRm9ybWF0Iiwic3BsaXQiLCJqb2luIiwidDgiLCJmcm9tTWVzc2FnZUlkIiwidG9NZXNzYWdlSWQiLCJzdGFydEluZGV4IiwiZmluZEluZGV4IiwiZW5kSW5kZXgiLCJpIiwicmVzdWx0IiwidG9vbFVzZVJlc3VsdCIsImZpbGVQYXRoIiwic3RydWN0dXJlZFBhdGNoIiwiaHVuayIsImFkZGl0aW9ucyIsImxpbmVzIiwibGluZSIsInN0YXJ0c1dpdGgiLCJyZW1vdmFscyIsIkFycmF5IiwiaXNBcnJheSIsImlzTWV0YSIsImlzQ29tcGFjdFN1bW1hcnkiLCJpc1Zpc2libGVJblRyYW5zY3JpcHRPbmx5IiwibWVzc2FnZXNBZnRlckFyZU9ubHlTeW50aGV0aWMiLCJmcm9tSW5kZXgiLCJoYXNNZWFuaW5nZnVsQ29udGVudCIsInNvbWUiXSwic291cmNlcyI6WyJNZXNzYWdlU2VsZWN0b3IudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0eXBlIHtcbiAgQ29udGVudEJsb2NrUGFyYW0sXG4gIFRleHRCbG9ja1BhcmFtLFxufSBmcm9tICdAYW50aHJvcGljLWFpL3Nkay9yZXNvdXJjZXMvaW5kZXgubWpzJ1xuaW1wb3J0IHsgcmFuZG9tVVVJRCwgdHlwZSBVVUlEIH0gZnJvbSAnY3J5cHRvJ1xuaW1wb3J0IGZpZ3VyZXMgZnJvbSAnZmlndXJlcydcbmltcG9ydCAqIGFzIFJlYWN0IGZyb20gJ3JlYWN0J1xuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7XG4gIHR5cGUgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgbG9nRXZlbnQsXG59IGZyb20gJ3NyYy9zZXJ2aWNlcy9hbmFseXRpY3MvaW5kZXguanMnXG5pbXBvcnQgeyB1c2VBcHBTdGF0ZSB9IGZyb20gJ3NyYy9zdGF0ZS9BcHBTdGF0ZS5qcydcbmltcG9ydCB7XG4gIHR5cGUgRGlmZlN0YXRzLFxuICBmaWxlSGlzdG9yeUNhblJlc3RvcmUsXG4gIGZpbGVIaXN0b3J5RW5hYmxlZCxcbiAgZmlsZUhpc3RvcnlHZXREaWZmU3RhdHMsXG59IGZyb20gJ3NyYy91dGlscy9maWxlSGlzdG9yeS5qcydcbmltcG9ydCB7IGxvZ0Vycm9yIH0gZnJvbSAnc3JjL3V0aWxzL2xvZy5qcydcbmltcG9ydCB7IHVzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncyB9IGZyb20gJy4uL2hvb2tzL3VzZUV4aXRPbkN0cmxDRFdpdGhLZXliaW5kaW5ncy5qcydcbmltcG9ydCB7IEJveCwgVGV4dCB9IGZyb20gJy4uL2luay5qcydcbmltcG9ydCB7IHVzZUtleWJpbmRpbmcsIHVzZUtleWJpbmRpbmdzIH0gZnJvbSAnLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB0eXBlIHtcbiAgTWVzc2FnZSxcbiAgUGFydGlhbENvbXBhY3REaXJlY3Rpb24sXG4gIFVzZXJNZXNzYWdlLFxufSBmcm9tICcuLi90eXBlcy9tZXNzYWdlLmpzJ1xuaW1wb3J0IHsgc3RyaXBEaXNwbGF5VGFncyB9IGZyb20gJy4uL3V0aWxzL2Rpc3BsYXlUYWdzLmpzJ1xuaW1wb3J0IHtcbiAgY3JlYXRlVXNlck1lc3NhZ2UsXG4gIGV4dHJhY3RUYWcsXG4gIGlzRW1wdHlNZXNzYWdlVGV4dCxcbiAgaXNTeW50aGV0aWNNZXNzYWdlLFxuICBpc1Rvb2xVc2VSZXN1bHRNZXNzYWdlLFxufSBmcm9tICcuLi91dGlscy9tZXNzYWdlcy5qcydcbmltcG9ydCB7IHR5cGUgT3B0aW9uV2l0aERlc2NyaXB0aW9uLCBTZWxlY3QgfSBmcm9tICcuL0N1c3RvbVNlbGVjdC9zZWxlY3QuanMnXG5pbXBvcnQgeyBTcGlubmVyIH0gZnJvbSAnLi9TcGlubmVyLmpzJ1xuXG5mdW5jdGlvbiBpc1RleHRCbG9jayhibG9jazogQ29udGVudEJsb2NrUGFyYW0pOiBibG9jayBpcyBUZXh0QmxvY2tQYXJhbSB7XG4gIHJldHVybiBibG9jay50eXBlID09PSAndGV4dCdcbn1cblxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJ1xuaW1wb3J0IHsgdXNlVGVybWluYWxTaXplIH0gZnJvbSAnc3JjL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB0eXBlIHsgRmlsZUVkaXRPdXRwdXQgfSBmcm9tICdzcmMvdG9vbHMvRmlsZUVkaXRUb29sL3R5cGVzLmpzJ1xuaW1wb3J0IHR5cGUgeyBPdXRwdXQgYXMgRmlsZVdyaXRlVG9vbE91dHB1dCB9IGZyb20gJ3NyYy90b29scy9GaWxlV3JpdGVUb29sL0ZpbGVXcml0ZVRvb2wuanMnXG5pbXBvcnQge1xuICBCQVNIX1NUREVSUl9UQUcsXG4gIEJBU0hfU1RET1VUX1RBRyxcbiAgQ09NTUFORF9NRVNTQUdFX1RBRyxcbiAgTE9DQUxfQ09NTUFORF9TVERFUlJfVEFHLFxuICBMT0NBTF9DT01NQU5EX1NURE9VVF9UQUcsXG4gIFRBU0tfTk9USUZJQ0FUSU9OX1RBRyxcbiAgVEVBTU1BVEVfTUVTU0FHRV9UQUcsXG4gIFRJQ0tfVEFHLFxufSBmcm9tICcuLi9jb25zdGFudHMveG1sLmpzJ1xuaW1wb3J0IHsgY291bnQgfSBmcm9tICcuLi91dGlscy9hcnJheS5qcydcbmltcG9ydCB7IGZvcm1hdFJlbGF0aXZlVGltZUFnbywgdHJ1bmNhdGUgfSBmcm9tICcuLi91dGlscy9mb3JtYXQuanMnXG5pbXBvcnQgdHlwZSB7IFRoZW1lIH0gZnJvbSAnLi4vdXRpbHMvdGhlbWUuanMnXG5pbXBvcnQgeyBEaXZpZGVyIH0gZnJvbSAnLi9kZXNpZ24tc3lzdGVtL0RpdmlkZXIuanMnXG5cbnR5cGUgUmVzdG9yZU9wdGlvbiA9XG4gIHwgJ2JvdGgnXG4gIHwgJ2NvbnZlcnNhdGlvbidcbiAgfCAnY29kZSdcbiAgfCAnc3VtbWFyaXplJ1xuICB8ICdzdW1tYXJpemVfdXBfdG8nXG4gIHwgJ25ldmVybWluZCdcblxuZnVuY3Rpb24gaXNTdW1tYXJpemVPcHRpb24oXG4gIG9wdGlvbjogUmVzdG9yZU9wdGlvbiB8IG51bGwsXG4pOiBvcHRpb24gaXMgJ3N1bW1hcml6ZScgfCAnc3VtbWFyaXplX3VwX3RvJyB7XG4gIHJldHVybiBvcHRpb24gPT09ICdzdW1tYXJpemUnIHx8IG9wdGlvbiA9PT0gJ3N1bW1hcml6ZV91cF90bydcbn1cblxudHlwZSBQcm9wcyA9IHtcbiAgbWVzc2FnZXM6IE1lc3NhZ2VbXVxuICBvblByZVJlc3RvcmU6ICgpID0+IHZvaWRcbiAgb25SZXN0b3JlTWVzc2FnZTogKG1lc3NhZ2U6IFVzZXJNZXNzYWdlKSA9PiBQcm9taXNlPHZvaWQ+XG4gIG9uUmVzdG9yZUNvZGU6IChtZXNzYWdlOiBVc2VyTWVzc2FnZSkgPT4gUHJvbWlzZTx2b2lkPlxuICBvblN1bW1hcml6ZTogKFxuICAgIG1lc3NhZ2U6IFVzZXJNZXNzYWdlLFxuICAgIGZlZWRiYWNrPzogc3RyaW5nLFxuICAgIGRpcmVjdGlvbj86IFBhcnRpYWxDb21wYWN0RGlyZWN0aW9uLFxuICApID0+IFByb21pc2U8dm9pZD5cbiAgb25DbG9zZTogKCkgPT4gdm9pZFxuICAvKiogU2tpcCBwaWNrLWxpc3QsIGxhbmQgb24gY29uZmlybS4gQ2FsbGVyIHJhbiBza2lwLWNoZWNrIGZpcnN0LiBFc2MgY2xvc2VzIGZ1bGx5IChubyBiYWNrLXRvLWxpc3QpLiAqL1xuICBwcmVzZWxlY3RlZE1lc3NhZ2U/OiBVc2VyTWVzc2FnZVxufVxuXG5jb25zdCBNQVhfVklTSUJMRV9NRVNTQUdFUyA9IDdcblxuZXhwb3J0IGZ1bmN0aW9uIE1lc3NhZ2VTZWxlY3Rvcih7XG4gIG1lc3NhZ2VzLFxuICBvblByZVJlc3RvcmUsXG4gIG9uUmVzdG9yZU1lc3NhZ2UsXG4gIG9uUmVzdG9yZUNvZGUsXG4gIG9uU3VtbWFyaXplLFxuICBvbkNsb3NlLFxuICBwcmVzZWxlY3RlZE1lc3NhZ2UsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGZpbGVIaXN0b3J5ID0gdXNlQXBwU3RhdGUocyA9PiBzLmZpbGVIaXN0b3J5KVxuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlPHN0cmluZyB8IHVuZGVmaW5lZD4odW5kZWZpbmVkKVxuICBjb25zdCBpc0ZpbGVIaXN0b3J5RW5hYmxlZCA9IGZpbGVIaXN0b3J5RW5hYmxlZCgpXG5cbiAgLy8gQWRkIGN1cnJlbnQgcHJvbXB0IGFzIGEgdmlydHVhbCBtZXNzYWdlXG4gIGNvbnN0IGN1cnJlbnRVVUlEID0gdXNlTWVtbyhyYW5kb21VVUlELCBbXSlcbiAgY29uc3QgbWVzc2FnZU9wdGlvbnMgPSB1c2VNZW1vKFxuICAgICgpID0+IFtcbiAgICAgIC4uLm1lc3NhZ2VzLmZpbHRlcihzZWxlY3RhYmxlVXNlck1lc3NhZ2VzRmlsdGVyKSxcbiAgICAgIHtcbiAgICAgICAgLi4uY3JlYXRlVXNlck1lc3NhZ2Uoe1xuICAgICAgICAgIGNvbnRlbnQ6ICcnLFxuICAgICAgICB9KSxcbiAgICAgICAgdXVpZDogY3VycmVudFVVSUQsXG4gICAgICB9IGFzIFVzZXJNZXNzYWdlLFxuICAgIF0sXG4gICAgW21lc3NhZ2VzLCBjdXJyZW50VVVJRF0sXG4gIClcbiAgY29uc3QgW3NlbGVjdGVkSW5kZXgsIHNldFNlbGVjdGVkSW5kZXhdID0gdXNlU3RhdGUobWVzc2FnZU9wdGlvbnMubGVuZ3RoIC0gMSlcblxuICAvLyBPcmllbnQgdGhlIHNlbGVjdGVkIG1lc3NhZ2UgYXMgdGhlIG1pZGRsZSBvZiB0aGUgdmlzaWJsZSBvcHRpb25zXG4gIGNvbnN0IGZpcnN0VmlzaWJsZUluZGV4ID0gTWF0aC5tYXgoXG4gICAgMCxcbiAgICBNYXRoLm1pbihcbiAgICAgIHNlbGVjdGVkSW5kZXggLSBNYXRoLmZsb29yKE1BWF9WSVNJQkxFX01FU1NBR0VTIC8gMiksXG4gICAgICBtZXNzYWdlT3B0aW9ucy5sZW5ndGggLSBNQVhfVklTSUJMRV9NRVNTQUdFUyxcbiAgICApLFxuICApXG5cbiAgY29uc3QgaGFzTWVzc2FnZXNUb1NlbGVjdCA9IG1lc3NhZ2VPcHRpb25zLmxlbmd0aCA+IDFcblxuICBjb25zdCBbbWVzc2FnZVRvUmVzdG9yZSwgc2V0TWVzc2FnZVRvUmVzdG9yZV0gPSB1c2VTdGF0ZTxcbiAgICBVc2VyTWVzc2FnZSB8IHVuZGVmaW5lZFxuICA+KHByZXNlbGVjdGVkTWVzc2FnZSlcbiAgY29uc3QgW2RpZmZTdGF0c0ZvclJlc3RvcmUsIHNldERpZmZTdGF0c0ZvclJlc3RvcmVdID0gdXNlU3RhdGU8XG4gICAgRGlmZlN0YXRzIHwgdW5kZWZpbmVkXG4gID4odW5kZWZpbmVkKVxuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFwcmVzZWxlY3RlZE1lc3NhZ2UgfHwgIWlzRmlsZUhpc3RvcnlFbmFibGVkKSByZXR1cm5cbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2VcbiAgICB2b2lkIGZpbGVIaXN0b3J5R2V0RGlmZlN0YXRzKGZpbGVIaXN0b3J5LCBwcmVzZWxlY3RlZE1lc3NhZ2UudXVpZCkudGhlbihcbiAgICAgIHN0YXRzID0+IHtcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldERpZmZTdGF0c0ZvclJlc3RvcmUoc3RhdHMpXG4gICAgICB9LFxuICAgIClcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY2FuY2VsbGVkID0gdHJ1ZVxuICAgIH1cbiAgfSwgW3ByZXNlbGVjdGVkTWVzc2FnZSwgaXNGaWxlSGlzdG9yeUVuYWJsZWQsIGZpbGVIaXN0b3J5XSlcblxuICBjb25zdCBbaXNSZXN0b3JpbmcsIHNldElzUmVzdG9yaW5nXSA9IHVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBbcmVzdG9yaW5nT3B0aW9uLCBzZXRSZXN0b3JpbmdPcHRpb25dID0gdXNlU3RhdGU8UmVzdG9yZU9wdGlvbiB8IG51bGw+KFxuICAgIG51bGwsXG4gIClcbiAgY29uc3QgW3NlbGVjdGVkUmVzdG9yZU9wdGlvbiwgc2V0U2VsZWN0ZWRSZXN0b3JlT3B0aW9uXSA9XG4gICAgdXNlU3RhdGU8UmVzdG9yZU9wdGlvbj4oJ2JvdGgnKVxuICAvLyBQZXItb3B0aW9uIGZlZWRiYWNrIHN0YXRlOyBTZWxlY3QncyBpbnRlcm5hbCBpbnB1dFZhbHVlcyBNYXAgcGVyc2lzdHNcbiAgLy8gcGVyLW9wdGlvbiB0ZXh0IGluZGVwZW5kZW50bHksIHNvIHNoYXJpbmcgb25lIHZhcmlhYmxlIHdvdWxkIGRlc3luYy5cbiAgY29uc3QgW3N1bW1hcml6ZUZyb21GZWVkYmFjaywgc2V0U3VtbWFyaXplRnJvbUZlZWRiYWNrXSA9IHVzZVN0YXRlKCcnKVxuICBjb25zdCBbc3VtbWFyaXplVXBUb0ZlZWRiYWNrLCBzZXRTdW1tYXJpemVVcFRvRmVlZGJhY2tdID0gdXNlU3RhdGUoJycpXG5cbiAgLy8gR2VuZXJhdGUgb3B0aW9ucyB3aXRoIHN1bW1hcml6ZSBhcyBpbnB1dCB0eXBlIGZvciBpbmxpbmUgY29udGV4dFxuICBmdW5jdGlvbiBnZXRSZXN0b3JlT3B0aW9ucyhcbiAgICBjYW5SZXN0b3JlQ29kZTogYm9vbGVhbixcbiAgKTogT3B0aW9uV2l0aERlc2NyaXB0aW9uPFJlc3RvcmVPcHRpb24+W10ge1xuICAgIGNvbnN0IGJhc2VPcHRpb25zOiBPcHRpb25XaXRoRGVzY3JpcHRpb248UmVzdG9yZU9wdGlvbj5bXSA9IGNhblJlc3RvcmVDb2RlXG4gICAgICA/IFtcbiAgICAgICAgICB7IHZhbHVlOiAnYm90aCcsIGxhYmVsOiAnUmVzdG9yZSBjb2RlIGFuZCBjb252ZXJzYXRpb24nIH0sXG4gICAgICAgICAgeyB2YWx1ZTogJ2NvbnZlcnNhdGlvbicsIGxhYmVsOiAnUmVzdG9yZSBjb252ZXJzYXRpb24nIH0sXG4gICAgICAgICAgeyB2YWx1ZTogJ2NvZGUnLCBsYWJlbDogJ1Jlc3RvcmUgY29kZScgfSxcbiAgICAgICAgXVxuICAgICAgOiBbeyB2YWx1ZTogJ2NvbnZlcnNhdGlvbicsIGxhYmVsOiAnUmVzdG9yZSBjb252ZXJzYXRpb24nIH1dXG5cbiAgICBjb25zdCBzdW1tYXJpemVJbnB1dFByb3BzID0ge1xuICAgICAgdHlwZTogJ2lucHV0JyBhcyBjb25zdCxcbiAgICAgIHBsYWNlaG9sZGVyOiAnYWRkIGNvbnRleHQgKG9wdGlvbmFsKScsXG4gICAgICBpbml0aWFsVmFsdWU6ICcnLFxuICAgICAgYWxsb3dFbXB0eVN1Ym1pdFRvQ2FuY2VsOiB0cnVlLFxuICAgICAgc2hvd0xhYmVsV2l0aFZhbHVlOiB0cnVlLFxuICAgICAgbGFiZWxWYWx1ZVNlcGFyYXRvcjogJzogJyxcbiAgICB9XG4gICAgYmFzZU9wdGlvbnMucHVzaCh7XG4gICAgICB2YWx1ZTogJ3N1bW1hcml6ZScsXG4gICAgICBsYWJlbDogJ1N1bW1hcml6ZSBmcm9tIGhlcmUnLFxuICAgICAgLi4uc3VtbWFyaXplSW5wdXRQcm9wcyxcbiAgICAgIG9uQ2hhbmdlOiBzZXRTdW1tYXJpemVGcm9tRmVlZGJhY2ssXG4gICAgfSlcbiAgICBpZiAoXCJleHRlcm5hbFwiID09PSAnYW50Jykge1xuICAgICAgYmFzZU9wdGlvbnMucHVzaCh7XG4gICAgICAgIHZhbHVlOiAnc3VtbWFyaXplX3VwX3RvJyxcbiAgICAgICAgbGFiZWw6ICdTdW1tYXJpemUgdXAgdG8gaGVyZScsXG4gICAgICAgIC4uLnN1bW1hcml6ZUlucHV0UHJvcHMsXG4gICAgICAgIG9uQ2hhbmdlOiBzZXRTdW1tYXJpemVVcFRvRmVlZGJhY2ssXG4gICAgICB9KVxuICAgIH1cblxuICAgIGJhc2VPcHRpb25zLnB1c2goeyB2YWx1ZTogJ25ldmVybWluZCcsIGxhYmVsOiAnTmV2ZXIgbWluZCcgfSlcbiAgICByZXR1cm4gYmFzZU9wdGlvbnNcbiAgfVxuXG4gIC8vIExvZyB3aGVuIHNlbGVjdG9yIGlzIG9wZW5lZFxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGxvZ0V2ZW50KCd0ZW5ndV9tZXNzYWdlX3NlbGVjdG9yX29wZW5lZCcsIHt9KVxuICB9LCBbXSlcblxuICAvLyBIZWxwZXIgdG8gcmVzdG9yZSBjb252ZXJzYXRpb24gd2l0aG91dCBjb25maXJtYXRpb25cbiAgYXN5bmMgZnVuY3Rpb24gcmVzdG9yZUNvbnZlcnNhdGlvbkRpcmVjdGx5KG1lc3NhZ2U6IFVzZXJNZXNzYWdlKSB7XG4gICAgb25QcmVSZXN0b3JlKClcbiAgICBzZXRJc1Jlc3RvcmluZyh0cnVlKVxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBvblJlc3RvcmVNZXNzYWdlKG1lc3NhZ2UpXG4gICAgICBzZXRJc1Jlc3RvcmluZyhmYWxzZSlcbiAgICAgIG9uQ2xvc2UoKVxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBsb2dFcnJvcihlcnJvciBhcyBFcnJvcilcbiAgICAgIHNldElzUmVzdG9yaW5nKGZhbHNlKVxuICAgICAgc2V0RXJyb3IoYEZhaWxlZCB0byByZXN0b3JlIHRoZSBjb252ZXJzYXRpb246XFxuJHtlcnJvcn1gKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGZ1bmN0aW9uIGhhbmRsZVNlbGVjdChtZXNzYWdlOiBVc2VyTWVzc2FnZSkge1xuICAgIGNvbnN0IGluZGV4ID0gbWVzc2FnZXMuaW5kZXhPZihtZXNzYWdlKVxuICAgIGNvbnN0IGluZGV4RnJvbUVuZCA9IG1lc3NhZ2VzLmxlbmd0aCAtIDEgLSBpbmRleFxuXG4gICAgbG9nRXZlbnQoJ3Rlbmd1X21lc3NhZ2Vfc2VsZWN0b3Jfc2VsZWN0ZWQnLCB7XG4gICAgICBpbmRleF9mcm9tX2VuZDogaW5kZXhGcm9tRW5kLFxuICAgICAgbWVzc2FnZV90eXBlOlxuICAgICAgICBtZXNzYWdlLnR5cGUgYXMgQW5hbHl0aWNzTWV0YWRhdGFfSV9WRVJJRklFRF9USElTX0lTX05PVF9DT0RFX09SX0ZJTEVQQVRIUyxcbiAgICAgIGlzX2N1cnJlbnRfcHJvbXB0OiBmYWxzZSxcbiAgICB9KVxuXG4gICAgLy8gRG8gbm90aGluZyBpZiB0aGUgbWVzc2FnZSBpcyBub3QgZm91bmRcbiAgICBpZiAoIW1lc3NhZ2VzLmluY2x1ZGVzKG1lc3NhZ2UpKSB7XG4gICAgICBvbkNsb3NlKClcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICghaXNGaWxlSGlzdG9yeUVuYWJsZWQpIHtcbiAgICAgIGF3YWl0IHJlc3RvcmVDb252ZXJzYXRpb25EaXJlY3RseShtZXNzYWdlKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgY29uc3QgZGlmZlN0YXRzID0gYXdhaXQgZmlsZUhpc3RvcnlHZXREaWZmU3RhdHMoZmlsZUhpc3RvcnksIG1lc3NhZ2UudXVpZClcbiAgICBzZXRNZXNzYWdlVG9SZXN0b3JlKG1lc3NhZ2UpXG4gICAgc2V0RGlmZlN0YXRzRm9yUmVzdG9yZShkaWZmU3RhdHMpXG4gIH1cblxuICBhc3luYyBmdW5jdGlvbiBvblNlbGVjdFJlc3RvcmVPcHRpb24ob3B0aW9uOiBSZXN0b3JlT3B0aW9uKSB7XG4gICAgbG9nRXZlbnQoJ3Rlbmd1X21lc3NhZ2Vfc2VsZWN0b3JfcmVzdG9yZV9vcHRpb25fc2VsZWN0ZWQnLCB7XG4gICAgICBvcHRpb246XG4gICAgICAgIG9wdGlvbiBhcyBBbmFseXRpY3NNZXRhZGF0YV9JX1ZFUklGSUVEX1RISVNfSVNfTk9UX0NPREVfT1JfRklMRVBBVEhTLFxuICAgIH0pXG4gICAgaWYgKCFtZXNzYWdlVG9SZXN0b3JlKSB7XG4gICAgICBzZXRFcnJvcignTWVzc2FnZSBub3QgZm91bmQuJylcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAob3B0aW9uID09PSAnbmV2ZXJtaW5kJykge1xuICAgICAgaWYgKHByZXNlbGVjdGVkTWVzc2FnZSkgb25DbG9zZSgpXG4gICAgICBlbHNlIHNldE1lc3NhZ2VUb1Jlc3RvcmUodW5kZWZpbmVkKVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYgKGlzU3VtbWFyaXplT3B0aW9uKG9wdGlvbikpIHtcbiAgICAgIG9uUHJlUmVzdG9yZSgpXG4gICAgICBzZXRJc1Jlc3RvcmluZyh0cnVlKVxuICAgICAgc2V0UmVzdG9yaW5nT3B0aW9uKG9wdGlvbilcbiAgICAgIHNldEVycm9yKHVuZGVmaW5lZClcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGRpcmVjdGlvbiA9IG9wdGlvbiA9PT0gJ3N1bW1hcml6ZV91cF90bycgPyAndXBfdG8nIDogJ2Zyb20nXG4gICAgICAgIGNvbnN0IGZlZWRiYWNrID1cbiAgICAgICAgICAoZGlyZWN0aW9uID09PSAndXBfdG8nXG4gICAgICAgICAgICA/IHN1bW1hcml6ZVVwVG9GZWVkYmFja1xuICAgICAgICAgICAgOiBzdW1tYXJpemVGcm9tRmVlZGJhY2tcbiAgICAgICAgICApLnRyaW0oKSB8fCB1bmRlZmluZWRcbiAgICAgICAgYXdhaXQgb25TdW1tYXJpemUobWVzc2FnZVRvUmVzdG9yZSwgZmVlZGJhY2ssIGRpcmVjdGlvbilcbiAgICAgICAgc2V0SXNSZXN0b3JpbmcoZmFsc2UpXG4gICAgICAgIHNldFJlc3RvcmluZ09wdGlvbihudWxsKVxuICAgICAgICBzZXRNZXNzYWdlVG9SZXN0b3JlKHVuZGVmaW5lZClcbiAgICAgICAgb25DbG9zZSgpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2dFcnJvcihlcnJvciBhcyBFcnJvcilcbiAgICAgICAgc2V0SXNSZXN0b3JpbmcoZmFsc2UpXG4gICAgICAgIHNldFJlc3RvcmluZ09wdGlvbihudWxsKVxuICAgICAgICBzZXRNZXNzYWdlVG9SZXN0b3JlKHVuZGVmaW5lZClcbiAgICAgICAgc2V0RXJyb3IoYEZhaWxlZCB0byBzdW1tYXJpemU6XFxuJHtlcnJvcn1gKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgb25QcmVSZXN0b3JlKClcbiAgICBzZXRJc1Jlc3RvcmluZyh0cnVlKVxuICAgIHNldEVycm9yKHVuZGVmaW5lZClcblxuICAgIGxldCBjb2RlRXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGxcbiAgICBsZXQgY29udmVyc2F0aW9uRXJyb3I6IEVycm9yIHwgbnVsbCA9IG51bGxcblxuICAgIGlmIChvcHRpb24gPT09ICdjb2RlJyB8fCBvcHRpb24gPT09ICdib3RoJykge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgb25SZXN0b3JlQ29kZShtZXNzYWdlVG9SZXN0b3JlKVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29kZUVycm9yID0gZXJyb3IgYXMgRXJyb3JcbiAgICAgICAgbG9nRXJyb3IoY29kZUVycm9yKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChvcHRpb24gPT09ICdjb252ZXJzYXRpb24nIHx8IG9wdGlvbiA9PT0gJ2JvdGgnKSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBvblJlc3RvcmVNZXNzYWdlKG1lc3NhZ2VUb1Jlc3RvcmUpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb252ZXJzYXRpb25FcnJvciA9IGVycm9yIGFzIEVycm9yXG4gICAgICAgIGxvZ0Vycm9yKGNvbnZlcnNhdGlvbkVycm9yKVxuICAgICAgfVxuICAgIH1cblxuICAgIHNldElzUmVzdG9yaW5nKGZhbHNlKVxuICAgIHNldE1lc3NhZ2VUb1Jlc3RvcmUodW5kZWZpbmVkKVxuXG4gICAgLy8gSGFuZGxlIGVycm9yc1xuICAgIGlmIChjb252ZXJzYXRpb25FcnJvciAmJiBjb2RlRXJyb3IpIHtcbiAgICAgIHNldEVycm9yKFxuICAgICAgICBgRmFpbGVkIHRvIHJlc3RvcmUgdGhlIGNvbnZlcnNhdGlvbiBhbmQgY29kZTpcXG4ke2NvbnZlcnNhdGlvbkVycm9yfVxcbiR7Y29kZUVycm9yfWAsXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb252ZXJzYXRpb25FcnJvcikge1xuICAgICAgc2V0RXJyb3IoYEZhaWxlZCB0byByZXN0b3JlIHRoZSBjb252ZXJzYXRpb246XFxuJHtjb252ZXJzYXRpb25FcnJvcn1gKVxuICAgIH0gZWxzZSBpZiAoY29kZUVycm9yKSB7XG4gICAgICBzZXRFcnJvcihgRmFpbGVkIHRvIHJlc3RvcmUgdGhlIGNvZGU6XFxuJHtjb2RlRXJyb3J9YClcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gU3VjY2VzcyAtIGNsb3NlIHRoZSBzZWxlY3RvclxuICAgICAgb25DbG9zZSgpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgZXhpdFN0YXRlID0gdXNlRXhpdE9uQ3RybENEV2l0aEtleWJpbmRpbmdzKClcblxuICBjb25zdCBoYW5kbGVFc2NhcGUgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgaWYgKG1lc3NhZ2VUb1Jlc3RvcmUgJiYgIXByZXNlbGVjdGVkTWVzc2FnZSkge1xuICAgICAgLy8gR28gYmFjayB0byBtZXNzYWdlIGxpc3QgaW5zdGVhZCBvZiBjbG9zaW5nIGVudGlyZWx5XG4gICAgICBzZXRNZXNzYWdlVG9SZXN0b3JlKHVuZGVmaW5lZClcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBsb2dFdmVudCgndGVuZ3VfbWVzc2FnZV9zZWxlY3Rvcl9jYW5jZWxsZWQnLCB7fSlcbiAgICBvbkNsb3NlKClcbiAgfSwgW29uQ2xvc2UsIG1lc3NhZ2VUb1Jlc3RvcmUsIHByZXNlbGVjdGVkTWVzc2FnZV0pXG5cbiAgY29uc3QgbW92ZVVwID0gdXNlQ2FsbGJhY2soXG4gICAgKCkgPT4gc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+IE1hdGgubWF4KDAsIHByZXYgLSAxKSksXG4gICAgW10sXG4gIClcbiAgY29uc3QgbW92ZURvd24gPSB1c2VDYWxsYmFjayhcbiAgICAoKSA9PlxuICAgICAgc2V0U2VsZWN0ZWRJbmRleChwcmV2ID0+IE1hdGgubWluKG1lc3NhZ2VPcHRpb25zLmxlbmd0aCAtIDEsIHByZXYgKyAxKSksXG4gICAgW21lc3NhZ2VPcHRpb25zLmxlbmd0aF0sXG4gIClcbiAgY29uc3QganVtcFRvVG9wID0gdXNlQ2FsbGJhY2soKCkgPT4gc2V0U2VsZWN0ZWRJbmRleCgwKSwgW10pXG4gIGNvbnN0IGp1bXBUb0JvdHRvbSA9IHVzZUNhbGxiYWNrKFxuICAgICgpID0+IHNldFNlbGVjdGVkSW5kZXgobWVzc2FnZU9wdGlvbnMubGVuZ3RoIC0gMSksXG4gICAgW21lc3NhZ2VPcHRpb25zLmxlbmd0aF0sXG4gIClcbiAgY29uc3QgaGFuZGxlU2VsZWN0Q3VycmVudCA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBjb25zdCBzZWxlY3RlZCA9IG1lc3NhZ2VPcHRpb25zW3NlbGVjdGVkSW5kZXhdXG4gICAgaWYgKHNlbGVjdGVkKSB7XG4gICAgICB2b2lkIGhhbmRsZVNlbGVjdChzZWxlY3RlZClcbiAgICB9XG4gIH0sIFttZXNzYWdlT3B0aW9ucywgc2VsZWN0ZWRJbmRleCwgaGFuZGxlU2VsZWN0XSlcblxuICAvLyBFc2NhcGUgdG8gY2xvc2UgLSB1c2VzIENvbmZpcm1hdGlvbiBjb250ZXh0IHdoZXJlIGVzY2FwZSBpcyBib3VuZFxuICB1c2VLZXliaW5kaW5nKCdjb25maXJtOm5vJywgaGFuZGxlRXNjYXBlLCB7XG4gICAgY29udGV4dDogJ0NvbmZpcm1hdGlvbicsXG4gICAgaXNBY3RpdmU6ICFtZXNzYWdlVG9SZXN0b3JlLFxuICB9KVxuXG4gIC8vIE1lc3NhZ2Ugc2VsZWN0b3IgbmF2aWdhdGlvbiBrZXliaW5kaW5nc1xuICB1c2VLZXliaW5kaW5ncyhcbiAgICB7XG4gICAgICAnbWVzc2FnZVNlbGVjdG9yOnVwJzogbW92ZVVwLFxuICAgICAgJ21lc3NhZ2VTZWxlY3Rvcjpkb3duJzogbW92ZURvd24sXG4gICAgICAnbWVzc2FnZVNlbGVjdG9yOnRvcCc6IGp1bXBUb1RvcCxcbiAgICAgICdtZXNzYWdlU2VsZWN0b3I6Ym90dG9tJzoganVtcFRvQm90dG9tLFxuICAgICAgJ21lc3NhZ2VTZWxlY3RvcjpzZWxlY3QnOiBoYW5kbGVTZWxlY3RDdXJyZW50LFxuICAgIH0sXG4gICAge1xuICAgICAgY29udGV4dDogJ01lc3NhZ2VTZWxlY3RvcicsXG4gICAgICBpc0FjdGl2ZTpcbiAgICAgICAgIWlzUmVzdG9yaW5nICYmICFlcnJvciAmJiAhbWVzc2FnZVRvUmVzdG9yZSAmJiBoYXNNZXNzYWdlc1RvU2VsZWN0LFxuICAgIH0sXG4gIClcblxuICBjb25zdCBbZmlsZUhpc3RvcnlNZXRhZGF0YSwgc2V0RmlsZUhpc3RvcnlNZXRhZGF0YV0gPSB1c2VTdGF0ZTxcbiAgICBSZWNvcmQ8bnVtYmVyLCBEaWZmU3RhdHM+XG4gID4oe30pXG5cbiAgdXNlRWZmZWN0KCgpID0+IHtcbiAgICBhc3luYyBmdW5jdGlvbiBsb2FkRmlsZUhpc3RvcnlNZXRhZGF0YSgpIHtcbiAgICAgIGlmICghaXNGaWxlSGlzdG9yeUVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICAvLyBMb2FkIGZpbGUgc25hcHNob3QgbWV0YWRhdGFcbiAgICAgIHZvaWQgUHJvbWlzZS5hbGwoXG4gICAgICAgIG1lc3NhZ2VPcHRpb25zLm1hcChhc3luYyAodXNlck1lc3NhZ2UsIGl0ZW1JbmRleCkgPT4ge1xuICAgICAgICAgIGlmICh1c2VyTWVzc2FnZS51dWlkICE9PSBjdXJyZW50VVVJRCkge1xuICAgICAgICAgICAgY29uc3QgY2FuUmVzdG9yZSA9IGZpbGVIaXN0b3J5Q2FuUmVzdG9yZShcbiAgICAgICAgICAgICAgZmlsZUhpc3RvcnksXG4gICAgICAgICAgICAgIHVzZXJNZXNzYWdlLnV1aWQsXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGNvbnN0IG5leHRVc2VyTWVzc2FnZSA9IG1lc3NhZ2VPcHRpb25zLmF0KGl0ZW1JbmRleCArIDEpXG4gICAgICAgICAgICBjb25zdCBkaWZmU3RhdHMgPSBjYW5SZXN0b3JlXG4gICAgICAgICAgICAgID8gY29tcHV0ZURpZmZTdGF0c0JldHdlZW5NZXNzYWdlcyhcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzLFxuICAgICAgICAgICAgICAgICAgdXNlck1lc3NhZ2UudXVpZCxcbiAgICAgICAgICAgICAgICAgIG5leHRVc2VyTWVzc2FnZT8udXVpZCAhPT0gY3VycmVudFVVSURcbiAgICAgICAgICAgICAgICAgICAgPyBuZXh0VXNlck1lc3NhZ2U/LnV1aWRcbiAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuXG4gICAgICAgICAgICBpZiAoZGlmZlN0YXRzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgc2V0RmlsZUhpc3RvcnlNZXRhZGF0YShwcmV2ID0+ICh7XG4gICAgICAgICAgICAgICAgLi4ucHJldixcbiAgICAgICAgICAgICAgICBbaXRlbUluZGV4XTogZGlmZlN0YXRzLFxuICAgICAgICAgICAgICB9KSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHNldEZpbGVIaXN0b3J5TWV0YWRhdGEocHJldiA9PiAoe1xuICAgICAgICAgICAgICAgIC4uLnByZXYsXG4gICAgICAgICAgICAgICAgW2l0ZW1JbmRleF06IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgIClcbiAgICB9XG4gICAgdm9pZCBsb2FkRmlsZUhpc3RvcnlNZXRhZGF0YSgpXG4gIH0sIFttZXNzYWdlT3B0aW9ucywgbWVzc2FnZXMsIGN1cnJlbnRVVUlELCBmaWxlSGlzdG9yeSwgaXNGaWxlSGlzdG9yeUVuYWJsZWRdKVxuXG4gIGNvbnN0IGNhblJlc3RvcmVDb2RlID1cbiAgICBpc0ZpbGVIaXN0b3J5RW5hYmxlZCAmJlxuICAgIGRpZmZTdGF0c0ZvclJlc3RvcmU/LmZpbGVzQ2hhbmdlZCAmJlxuICAgIGRpZmZTdGF0c0ZvclJlc3RvcmUuZmlsZXNDaGFuZ2VkLmxlbmd0aCA+IDBcbiAgY29uc3Qgc2hvd1BpY2tMaXN0ID1cbiAgICAhZXJyb3IgJiYgIW1lc3NhZ2VUb1Jlc3RvcmUgJiYgIXByZXNlbGVjdGVkTWVzc2FnZSAmJiBoYXNNZXNzYWdlc1RvU2VsZWN0XG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgIDxEaXZpZGVyIGNvbG9yPVwic3VnZ2VzdGlvblwiIC8+XG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiBtYXJnaW5YPXsxfSBnYXA9ezF9PlxuICAgICAgICA8VGV4dCBib2xkIGNvbG9yPVwic3VnZ2VzdGlvblwiPlxuICAgICAgICAgIFJld2luZFxuICAgICAgICA8L1RleHQ+XG5cbiAgICAgICAge2Vycm9yICYmIChcbiAgICAgICAgICA8PlxuICAgICAgICAgICAgPFRleHQgY29sb3I9XCJlcnJvclwiPkVycm9yOiB7ZXJyb3J9PC9UZXh0PlxuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgICB7IWhhc01lc3NhZ2VzVG9TZWxlY3QgJiYgKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICA8VGV4dD5Ob3RoaW5nIHRvIHJld2luZCB0byB5ZXQuPC9UZXh0PlxuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgICB7IWVycm9yICYmIG1lc3NhZ2VUb1Jlc3RvcmUgJiYgaGFzTWVzc2FnZXNUb1NlbGVjdCAmJiAoXG4gICAgICAgICAgPD5cbiAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICBDb25maXJtIHlvdSB3YW50IHRvIHJlc3RvcmV7JyAnfVxuICAgICAgICAgICAgICB7IWRpZmZTdGF0c0ZvclJlc3RvcmUgJiYgJ3RoZSBjb252ZXJzYXRpb24gJ310byB0aGUgcG9pbnQgYmVmb3JlXG4gICAgICAgICAgICAgIHlvdSBzZW50IHRoaXMgbWVzc2FnZTpcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDxCb3hcbiAgICAgICAgICAgICAgZmxleERpcmVjdGlvbj1cImNvbHVtblwiXG4gICAgICAgICAgICAgIHBhZGRpbmdMZWZ0PXsxfVxuICAgICAgICAgICAgICBib3JkZXJTdHlsZT1cInNpbmdsZVwiXG4gICAgICAgICAgICAgIGJvcmRlclJpZ2h0PXtmYWxzZX1cbiAgICAgICAgICAgICAgYm9yZGVyVG9wPXtmYWxzZX1cbiAgICAgICAgICAgICAgYm9yZGVyQm90dG9tPXtmYWxzZX1cbiAgICAgICAgICAgICAgYm9yZGVyTGVmdD17dHJ1ZX1cbiAgICAgICAgICAgICAgYm9yZGVyTGVmdERpbUNvbG9yXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxVc2VyTWVzc2FnZU9wdGlvblxuICAgICAgICAgICAgICAgIHVzZXJNZXNzYWdlPXttZXNzYWdlVG9SZXN0b3JlfVxuICAgICAgICAgICAgICAgIGNvbG9yPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgaXNDdXJyZW50PXtmYWxzZX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgKHtmb3JtYXRSZWxhdGl2ZVRpbWVBZ28obmV3IERhdGUobWVzc2FnZVRvUmVzdG9yZS50aW1lc3RhbXApKX0pXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgPFJlc3RvcmVPcHRpb25EZXNjcmlwdGlvblxuICAgICAgICAgICAgICBzZWxlY3RlZFJlc3RvcmVPcHRpb249e3NlbGVjdGVkUmVzdG9yZU9wdGlvbn1cbiAgICAgICAgICAgICAgY2FuUmVzdG9yZUNvZGU9eyEhY2FuUmVzdG9yZUNvZGV9XG4gICAgICAgICAgICAgIGRpZmZTdGF0c0ZvclJlc3RvcmU9e2RpZmZTdGF0c0ZvclJlc3RvcmV9XG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAge2lzUmVzdG9yaW5nICYmIGlzU3VtbWFyaXplT3B0aW9uKHJlc3RvcmluZ09wdGlvbikgPyAoXG4gICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiIGdhcD17MX0+XG4gICAgICAgICAgICAgICAgPFNwaW5uZXIgLz5cbiAgICAgICAgICAgICAgICA8VGV4dD5TdW1tYXJpemluZ+KApjwvVGV4dD5cbiAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICA8U2VsZWN0XG4gICAgICAgICAgICAgICAgaXNEaXNhYmxlZD17aXNSZXN0b3Jpbmd9XG4gICAgICAgICAgICAgICAgb3B0aW9ucz17Z2V0UmVzdG9yZU9wdGlvbnMoISFjYW5SZXN0b3JlQ29kZSl9XG4gICAgICAgICAgICAgICAgZGVmYXVsdEZvY3VzVmFsdWU9e2NhblJlc3RvcmVDb2RlID8gJ2JvdGgnIDogJ2NvbnZlcnNhdGlvbid9XG4gICAgICAgICAgICAgICAgb25Gb2N1cz17dmFsdWUgPT5cbiAgICAgICAgICAgICAgICAgIHNldFNlbGVjdGVkUmVzdG9yZU9wdGlvbih2YWx1ZSBhcyBSZXN0b3JlT3B0aW9uKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17dmFsdWUgPT5cbiAgICAgICAgICAgICAgICAgIG9uU2VsZWN0UmVzdG9yZU9wdGlvbih2YWx1ZSBhcyBSZXN0b3JlT3B0aW9uKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBvbkNhbmNlbD17KCkgPT5cbiAgICAgICAgICAgICAgICAgIHByZXNlbGVjdGVkTWVzc2FnZVxuICAgICAgICAgICAgICAgICAgICA/IG9uQ2xvc2UoKVxuICAgICAgICAgICAgICAgICAgICA6IHNldE1lc3NhZ2VUb1Jlc3RvcmUodW5kZWZpbmVkKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICB7Y2FuUmVzdG9yZUNvZGUgJiYgKFxuICAgICAgICAgICAgICA8Qm94IG1hcmdpbkJvdHRvbT17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgICAgICAgICAgICB7ZmlndXJlcy53YXJuaW5nfSBSZXdpbmRpbmcgZG9lcyBub3QgYWZmZWN0IGZpbGVzIGVkaXRlZFxuICAgICAgICAgICAgICAgICAgbWFudWFsbHkgb3IgdmlhIGJhc2guXG4gICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC8+XG4gICAgICAgICl9XG4gICAgICAgIHtzaG93UGlja0xpc3QgJiYgKFxuICAgICAgICAgIDw+XG4gICAgICAgICAgICB7aXNGaWxlSGlzdG9yeUVuYWJsZWQgPyAoXG4gICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgIFJlc3RvcmUgdGhlIGNvZGUgYW5kL29yIGNvbnZlcnNhdGlvbiB0byB0aGUgcG9pbnQgYmVmb3Jl4oCmXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxUZXh0PlxuICAgICAgICAgICAgICAgIFJlc3RvcmUgYW5kIGZvcmsgdGhlIGNvbnZlcnNhdGlvbiB0byB0aGUgcG9pbnQgYmVmb3Jl4oCmXG4gICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgICA8Qm94IHdpZHRoPVwiMTAwJVwiIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgICAgICAgICAge21lc3NhZ2VPcHRpb25zXG4gICAgICAgICAgICAgICAgLnNsaWNlKFxuICAgICAgICAgICAgICAgICAgZmlyc3RWaXNpYmxlSW5kZXgsXG4gICAgICAgICAgICAgICAgICBmaXJzdFZpc2libGVJbmRleCArIE1BWF9WSVNJQkxFX01FU1NBR0VTLFxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAubWFwKChtc2csIHZpc2libGVPcHRpb25JbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgb3B0aW9uSW5kZXggPSBmaXJzdFZpc2libGVJbmRleCArIHZpc2libGVPcHRpb25JbmRleFxuICAgICAgICAgICAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IG9wdGlvbkluZGV4ID09PSBzZWxlY3RlZEluZGV4XG4gICAgICAgICAgICAgICAgICBjb25zdCBpc0N1cnJlbnQgPSBtc2cudXVpZCA9PT0gY3VycmVudFVVSURcblxuICAgICAgICAgICAgICAgICAgY29uc3QgbWV0YWRhdGFMb2FkZWQgPSBvcHRpb25JbmRleCBpbiBmaWxlSGlzdG9yeU1ldGFkYXRhXG4gICAgICAgICAgICAgICAgICBjb25zdCBtZXRhZGF0YSA9IGZpbGVIaXN0b3J5TWV0YWRhdGFbb3B0aW9uSW5kZXhdXG4gICAgICAgICAgICAgICAgICBjb25zdCBudW1GaWxlc0NoYW5nZWQgPVxuICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YT8uZmlsZXNDaGFuZ2VkICYmIG1ldGFkYXRhLmZpbGVzQ2hhbmdlZC5sZW5ndGhcblxuICAgICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgICAgPEJveFxuICAgICAgICAgICAgICAgICAgICAgIGtleT17bXNnLnV1aWR9XG4gICAgICAgICAgICAgICAgICAgICAgaGVpZ2h0PXtpc0ZpbGVIaXN0b3J5RW5hYmxlZCA/IDMgOiAyfVxuICAgICAgICAgICAgICAgICAgICAgIG92ZXJmbG93PVwiaGlkZGVuXCJcbiAgICAgICAgICAgICAgICAgICAgICB3aWR0aD1cIjEwMCVcIlxuICAgICAgICAgICAgICAgICAgICAgIGZsZXhEaXJlY3Rpb249XCJyb3dcIlxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPEJveCB3aWR0aD17Mn0gbWluV2lkdGg9ezJ9PlxuICAgICAgICAgICAgICAgICAgICAgICAge2lzU2VsZWN0ZWQgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxUZXh0IGNvbG9yPVwicGVybWlzc2lvblwiIGJvbGQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2ZpZ3VyZXMucG9pbnRlcn17JyAnfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dD57JyAgJ308L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPEJveCBmbGV4U2hyaW5rPXsxfSBoZWlnaHQ9ezF9IG92ZXJmbG93PVwiaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxVc2VyTWVzc2FnZU9wdGlvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVzZXJNZXNzYWdlPXttc2d9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I9e2lzU2VsZWN0ZWQgPyAnc3VnZ2VzdGlvbicgOiB1bmRlZmluZWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaXNDdXJyZW50PXtpc0N1cnJlbnR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkZGluZ1JpZ2h0PXsxMH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICAgICAge2lzRmlsZUhpc3RvcnlFbmFibGVkICYmIG1ldGFkYXRhTG9hZGVkICYmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPEJveCBoZWlnaHQ9ezF9IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bWV0YWRhdGEgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj17IWlzU2VsZWN0ZWR9IGNvbG9yPVwiaW5hY3RpdmVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7bnVtRmlsZXNDaGFuZ2VkID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge251bUZpbGVzQ2hhbmdlZCA9PT0gMSAmJlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRhZGF0YS5maWxlc0NoYW5nZWQhWzBdXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyBgJHtwYXRoLmJhc2VuYW1lKG1ldGFkYXRhLmZpbGVzQ2hhbmdlZCFbMF0pfSBgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBgJHtudW1GaWxlc0NoYW5nZWR9IGZpbGVzIGNoYW5nZWQgYH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPERpZmZTdGF0c1RleHQgZGlmZlN0YXRzPXttZXRhZGF0YX0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8Pk5vIGNvZGUgY2hhbmdlczwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvciBjb2xvcj1cIndhcm5pbmdcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge2ZpZ3VyZXMud2FybmluZ30gTm8gY29kZSByZXN0b3JlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDwvPlxuICAgICAgICApfVxuICAgICAgICB7IW1lc3NhZ2VUb1Jlc3RvcmUgJiYgKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgIHtleGl0U3RhdGUucGVuZGluZyA/IChcbiAgICAgICAgICAgICAgPD5QcmVzcyB7ZXhpdFN0YXRlLmtleU5hbWV9IGFnYWluIHRvIGV4aXQ8Lz5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgeyFlcnJvciAmJiBoYXNNZXNzYWdlc1RvU2VsZWN0ICYmICdFbnRlciB0byBjb250aW51ZSDCtyAnfUVzYyB0b1xuICAgICAgICAgICAgICAgIGV4aXRcbiAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgKX1cbiAgICAgIDwvQm94PlxuICAgIDwvQm94PlxuICApXG59XG5cbmZ1bmN0aW9uIGdldFJlc3RvcmVPcHRpb25Db252ZXJzYXRpb25UZXh0KG9wdGlvbjogUmVzdG9yZU9wdGlvbik6IHN0cmluZyB7XG4gIHN3aXRjaCAob3B0aW9uKSB7XG4gICAgY2FzZSAnc3VtbWFyaXplJzpcbiAgICAgIHJldHVybiAnTWVzc2FnZXMgYWZ0ZXIgdGhpcyBwb2ludCB3aWxsIGJlIHN1bW1hcml6ZWQuJ1xuICAgIGNhc2UgJ3N1bW1hcml6ZV91cF90byc6XG4gICAgICByZXR1cm4gJ1ByZWNlZGluZyBtZXNzYWdlcyB3aWxsIGJlIHN1bW1hcml6ZWQuIFRoaXMgYW5kIHN1YnNlcXVlbnQgbWVzc2FnZXMgd2lsbCByZW1haW4gdW5jaGFuZ2VkIOKAlCB5b3Ugd2lsbCBzdGF5IGF0IHRoZSBlbmQgb2YgdGhlIGNvbnZlcnNhdGlvbi4nXG4gICAgY2FzZSAnYm90aCc6XG4gICAgY2FzZSAnY29udmVyc2F0aW9uJzpcbiAgICAgIHJldHVybiAnVGhlIGNvbnZlcnNhdGlvbiB3aWxsIGJlIGZvcmtlZC4nXG4gICAgY2FzZSAnY29kZSc6XG4gICAgY2FzZSAnbmV2ZXJtaW5kJzpcbiAgICAgIHJldHVybiAnVGhlIGNvbnZlcnNhdGlvbiB3aWxsIGJlIHVuY2hhbmdlZC4nXG4gIH1cbn1cblxuZnVuY3Rpb24gUmVzdG9yZU9wdGlvbkRlc2NyaXB0aW9uKHtcbiAgc2VsZWN0ZWRSZXN0b3JlT3B0aW9uLFxuICBjYW5SZXN0b3JlQ29kZSxcbiAgZGlmZlN0YXRzRm9yUmVzdG9yZSxcbn06IHtcbiAgc2VsZWN0ZWRSZXN0b3JlT3B0aW9uOiBSZXN0b3JlT3B0aW9uXG4gIGNhblJlc3RvcmVDb2RlOiBib29sZWFuXG4gIGRpZmZTdGF0c0ZvclJlc3RvcmU6IERpZmZTdGF0cyB8IHVuZGVmaW5lZFxufSk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IHNob3dDb2RlUmVzdG9yZSA9XG4gICAgY2FuUmVzdG9yZUNvZGUgJiZcbiAgICAoc2VsZWN0ZWRSZXN0b3JlT3B0aW9uID09PSAnYm90aCcgfHwgc2VsZWN0ZWRSZXN0b3JlT3B0aW9uID09PSAnY29kZScpXG5cbiAgcmV0dXJuIChcbiAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIj5cbiAgICAgIDxUZXh0IGRpbUNvbG9yPlxuICAgICAgICB7Z2V0UmVzdG9yZU9wdGlvbkNvbnZlcnNhdGlvblRleHQoc2VsZWN0ZWRSZXN0b3JlT3B0aW9uKX1cbiAgICAgIDwvVGV4dD5cbiAgICAgIHshaXNTdW1tYXJpemVPcHRpb24oc2VsZWN0ZWRSZXN0b3JlT3B0aW9uKSAmJlxuICAgICAgICAoc2hvd0NvZGVSZXN0b3JlID8gKFxuICAgICAgICAgIDxSZXN0b3JlQ29kZUNvbmZpcm1hdGlvbiBkaWZmU3RhdHNGb3JSZXN0b3JlPXtkaWZmU3RhdHNGb3JSZXN0b3JlfSAvPlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxUZXh0IGRpbUNvbG9yPlRoZSBjb2RlIHdpbGwgYmUgdW5jaGFuZ2VkLjwvVGV4dD5cbiAgICAgICAgKSl9XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuZnVuY3Rpb24gUmVzdG9yZUNvZGVDb25maXJtYXRpb24oe1xuICBkaWZmU3RhdHNGb3JSZXN0b3JlLFxufToge1xuICBkaWZmU3RhdHNGb3JSZXN0b3JlOiBEaWZmU3RhdHMgfCB1bmRlZmluZWRcbn0pOiBSZWFjdC5SZWFjdE5vZGUge1xuICBpZiAoZGlmZlN0YXRzRm9yUmVzdG9yZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZFxuICB9XG4gIGlmIChcbiAgICAhZGlmZlN0YXRzRm9yUmVzdG9yZS5maWxlc0NoYW5nZWQgfHxcbiAgICAhZGlmZlN0YXRzRm9yUmVzdG9yZS5maWxlc0NoYW5nZWRbMF1cbiAgKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxUZXh0IGRpbUNvbG9yPlRoZSBjb2RlIGhhcyBub3QgY2hhbmdlZCAobm90aGluZyB3aWxsIGJlIHJlc3RvcmVkKS48L1RleHQ+XG4gICAgKVxuICB9XG5cbiAgY29uc3QgbnVtRmlsZXNDaGFuZ2VkID0gZGlmZlN0YXRzRm9yUmVzdG9yZS5maWxlc0NoYW5nZWQubGVuZ3RoXG5cbiAgbGV0IGZpbGVMYWJlbCA9ICcnXG4gIGlmIChudW1GaWxlc0NoYW5nZWQgPT09IDEpIHtcbiAgICBmaWxlTGFiZWwgPSBwYXRoLmJhc2VuYW1lKGRpZmZTdGF0c0ZvclJlc3RvcmUuZmlsZXNDaGFuZ2VkWzBdIHx8ICcnKVxuICB9IGVsc2UgaWYgKG51bUZpbGVzQ2hhbmdlZCA9PT0gMikge1xuICAgIGNvbnN0IGZpbGUxID0gcGF0aC5iYXNlbmFtZShkaWZmU3RhdHNGb3JSZXN0b3JlLmZpbGVzQ2hhbmdlZFswXSB8fCAnJylcbiAgICBjb25zdCBmaWxlMiA9IHBhdGguYmFzZW5hbWUoZGlmZlN0YXRzRm9yUmVzdG9yZS5maWxlc0NoYW5nZWRbMV0gfHwgJycpXG4gICAgZmlsZUxhYmVsID0gYCR7ZmlsZTF9IGFuZCAke2ZpbGUyfWBcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBmaWxlMSA9IHBhdGguYmFzZW5hbWUoZGlmZlN0YXRzRm9yUmVzdG9yZS5maWxlc0NoYW5nZWRbMF0gfHwgJycpXG4gICAgZmlsZUxhYmVsID0gYCR7ZmlsZTF9IGFuZCAke2RpZmZTdGF0c0ZvclJlc3RvcmUuZmlsZXNDaGFuZ2VkLmxlbmd0aCAtIDF9IG90aGVyIGZpbGVzYFxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPFRleHQgZGltQ29sb3I+XG4gICAgICAgIFRoZSBjb2RlIHdpbGwgYmUgcmVzdG9yZWR7JyAnfVxuICAgICAgICA8RGlmZlN0YXRzVGV4dCBkaWZmU3RhdHM9e2RpZmZTdGF0c0ZvclJlc3RvcmV9IC8+IGluIHtmaWxlTGFiZWx9LlxuICAgICAgPC9UZXh0PlxuICAgIDwvPlxuICApXG59XG5cbmZ1bmN0aW9uIERpZmZTdGF0c1RleHQoe1xuICBkaWZmU3RhdHMsXG59OiB7XG4gIGRpZmZTdGF0czogRGlmZlN0YXRzIHwgdW5kZWZpbmVkXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgaWYgKCFkaWZmU3RhdHMgfHwgIWRpZmZTdGF0cy5maWxlc0NoYW5nZWQpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cbiAgcmV0dXJuIChcbiAgICA8PlxuICAgICAgPFRleHQgY29sb3I9XCJkaWZmQWRkZWRXb3JkXCI+K3tkaWZmU3RhdHMuaW5zZXJ0aW9uc30gPC9UZXh0PlxuICAgICAgPFRleHQgY29sb3I9XCJkaWZmUmVtb3ZlZFdvcmRcIj4te2RpZmZTdGF0cy5kZWxldGlvbnN9PC9UZXh0PlxuICAgIDwvPlxuICApXG59XG5cbmZ1bmN0aW9uIFVzZXJNZXNzYWdlT3B0aW9uKHtcbiAgdXNlck1lc3NhZ2UsXG4gIGNvbG9yLFxuICBkaW1Db2xvcixcbiAgaXNDdXJyZW50LFxuICBwYWRkaW5nUmlnaHQsXG59OiB7XG4gIHVzZXJNZXNzYWdlOiBVc2VyTWVzc2FnZVxuICBjb2xvcj86IGtleW9mIFRoZW1lXG4gIGRpbUNvbG9yPzogYm9vbGVhblxuICBpc0N1cnJlbnQ6IGJvb2xlYW5cbiAgcGFkZGluZ1JpZ2h0PzogbnVtYmVyXG59KTogUmVhY3QuUmVhY3ROb2RlIHtcbiAgY29uc3QgeyBjb2x1bW5zIH0gPSB1c2VUZXJtaW5hbFNpemUoKVxuICBpZiAoaXNDdXJyZW50KSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxCb3ggd2lkdGg9XCIxMDAlXCI+XG4gICAgICAgIDxUZXh0IGl0YWxpYyBjb2xvcj17Y29sb3J9IGRpbUNvbG9yPXtkaW1Db2xvcn0+XG4gICAgICAgICAgKGN1cnJlbnQpXG4gICAgICAgIDwvVGV4dD5cbiAgICAgIDwvQm94PlxuICAgIClcbiAgfVxuXG4gIGNvbnN0IGNvbnRlbnQgPSB1c2VyTWVzc2FnZS5tZXNzYWdlLmNvbnRlbnRcbiAgY29uc3QgbGFzdEJsb2NrID1cbiAgICB0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycgPyBudWxsIDogY29udGVudFtjb250ZW50Lmxlbmd0aCAtIDFdXG4gIGNvbnN0IHJhd01lc3NhZ2VUZXh0ID1cbiAgICB0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZydcbiAgICAgID8gY29udGVudC50cmltKClcbiAgICAgIDogbGFzdEJsb2NrICYmIGlzVGV4dEJsb2NrKGxhc3RCbG9jaylcbiAgICAgICAgPyBsYXN0QmxvY2sudGV4dC50cmltKClcbiAgICAgICAgOiAnKG5vIHByb21wdCknXG5cbiAgLy8gU3RyaXAgZGlzcGxheS11bmZyaWVuZGx5IHRhZ3MgKGxpa2UgPGlkZV9vcGVuZWRfZmlsZT4pIGJlZm9yZSBzaG93aW5nIGluIHRoZSBsaXN0XG4gIGNvbnN0IG1lc3NhZ2VUZXh0ID0gc3RyaXBEaXNwbGF5VGFncyhyYXdNZXNzYWdlVGV4dClcblxuICBpZiAoaXNFbXB0eU1lc3NhZ2VUZXh0KG1lc3NhZ2VUZXh0KSkge1xuICAgIHJldHVybiAoXG4gICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgPFRleHQgaXRhbGljIGNvbG9yPXtjb2xvcn0gZGltQ29sb3I9e2RpbUNvbG9yfT5cbiAgICAgICAgICAoKGVtcHR5IG1lc3NhZ2UpKVxuICAgICAgICA8L1RleHQ+XG4gICAgICA8L0JveD5cbiAgICApXG4gIH1cblxuICAvLyBCYXNoIGlucHV0c1xuICBpZiAobWVzc2FnZVRleHQuaW5jbHVkZXMoJzxiYXNoLWlucHV0PicpKSB7XG4gICAgY29uc3QgaW5wdXQgPSBleHRyYWN0VGFnKG1lc3NhZ2VUZXh0LCAnYmFzaC1pbnB1dCcpXG4gICAgaWYgKGlucHV0KSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJyb3dcIiB3aWR0aD1cIjEwMCVcIj5cbiAgICAgICAgICA8VGV4dCBjb2xvcj1cImJhc2hCb3JkZXJcIj4hPC9UZXh0PlxuICAgICAgICAgIDxUZXh0IGNvbG9yPXtjb2xvcn0gZGltQ29sb3I9e2RpbUNvbG9yfT5cbiAgICAgICAgICAgIHsnICd9XG4gICAgICAgICAgICB7aW5wdXR9XG4gICAgICAgICAgPC9UZXh0PlxuICAgICAgICA8L0JveD5cbiAgICAgIClcbiAgICB9XG4gIH1cblxuICAvLyBTa2lsbHMgYW5kIHNsYXNoIGNvbW1hbmRzXG4gIGlmIChtZXNzYWdlVGV4dC5pbmNsdWRlcyhgPCR7Q09NTUFORF9NRVNTQUdFX1RBR30+YCkpIHtcbiAgICBjb25zdCBjb21tYW5kTWVzc2FnZSA9IGV4dHJhY3RUYWcobWVzc2FnZVRleHQsIENPTU1BTkRfTUVTU0FHRV9UQUcpXG4gICAgY29uc3QgYXJncyA9IGV4dHJhY3RUYWcobWVzc2FnZVRleHQsICdjb21tYW5kLWFyZ3MnKVxuICAgIGNvbnN0IGlzU2tpbGxGb3JtYXQgPSBleHRyYWN0VGFnKG1lc3NhZ2VUZXh0LCAnc2tpbGwtZm9ybWF0JykgPT09ICd0cnVlJ1xuICAgIGlmIChjb21tYW5kTWVzc2FnZSkge1xuICAgICAgaWYgKGlzU2tpbGxGb3JtYXQpIHtcbiAgICAgICAgLy8gU2tpbGxzOiBEaXNwbGF5IGFzIFwiU2tpbGwobmFtZSlcIlxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiIHdpZHRoPVwiMTAwJVwiPlxuICAgICAgICAgICAgPFRleHQgY29sb3I9e2NvbG9yfSBkaW1Db2xvcj17ZGltQ29sb3J9PlxuICAgICAgICAgICAgICBTa2lsbCh7Y29tbWFuZE1lc3NhZ2V9KVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBTbGFzaCBjb21tYW5kczogQWRkIFwiL1wiIHByZWZpeCBhbmQgaW5jbHVkZSBhcmdzXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgd2lkdGg9XCIxMDAlXCI+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj17Y29sb3J9IGRpbUNvbG9yPXtkaW1Db2xvcn0+XG4gICAgICAgICAgICAgIC97Y29tbWFuZE1lc3NhZ2V9IHthcmdzfVxuICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgIDwvQm94PlxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gVXNlciBwcm9tcHRzXG4gIHJldHVybiAoXG4gICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgd2lkdGg9XCIxMDAlXCI+XG4gICAgICA8VGV4dCBjb2xvcj17Y29sb3J9IGRpbUNvbG9yPXtkaW1Db2xvcn0+XG4gICAgICAgIHtwYWRkaW5nUmlnaHRcbiAgICAgICAgICA/IHRydW5jYXRlKG1lc3NhZ2VUZXh0LCBjb2x1bW5zIC0gcGFkZGluZ1JpZ2h0LCB0cnVlKVxuICAgICAgICAgIDogbWVzc2FnZVRleHQuc2xpY2UoMCwgNTAwKS5zcGxpdCgnXFxuJykuc2xpY2UoMCwgNCkuam9pbignXFxuJyl9XG4gICAgICA8L1RleHQ+XG4gICAgPC9Cb3g+XG4gIClcbn1cblxuLyoqXG4gKiBDb21wdXRlcyB0aGUgZGlmZiBzdGF0cyBmb3IgYWxsIHRoZSBmaWxlIGVkaXRzIGluLWJldHdlZW4gdHdvIG1lc3NhZ2VzLlxuICovXG5mdW5jdGlvbiBjb21wdXRlRGlmZlN0YXRzQmV0d2Vlbk1lc3NhZ2VzKFxuICBtZXNzYWdlczogTWVzc2FnZVtdLFxuICBmcm9tTWVzc2FnZUlkOiBVVUlELFxuICB0b01lc3NhZ2VJZDogVVVJRCB8IHVuZGVmaW5lZCxcbik6IERpZmZTdGF0cyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IHN0YXJ0SW5kZXggPSBtZXNzYWdlcy5maW5kSW5kZXgobXNnID0+IG1zZy51dWlkID09PSBmcm9tTWVzc2FnZUlkKVxuICBpZiAoc3RhcnRJbmRleCA9PT0gLTEpIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkXG4gIH1cblxuICBsZXQgZW5kSW5kZXggPSB0b01lc3NhZ2VJZFxuICAgID8gbWVzc2FnZXMuZmluZEluZGV4KG1zZyA9PiBtc2cudXVpZCA9PT0gdG9NZXNzYWdlSWQpXG4gICAgOiBtZXNzYWdlcy5sZW5ndGhcbiAgaWYgKGVuZEluZGV4ID09PSAtMSkge1xuICAgIGVuZEluZGV4ID0gbWVzc2FnZXMubGVuZ3RoXG4gIH1cblxuICBjb25zdCBmaWxlc0NoYW5nZWQ6IHN0cmluZ1tdID0gW11cbiAgbGV0IGluc2VydGlvbnMgPSAwXG4gIGxldCBkZWxldGlvbnMgPSAwXG5cbiAgZm9yIChsZXQgaSA9IHN0YXJ0SW5kZXggKyAxOyBpIDwgZW5kSW5kZXg7IGkrKykge1xuICAgIGNvbnN0IG1zZyA9IG1lc3NhZ2VzW2ldXG4gICAgaWYgKCFtc2cgfHwgIWlzVG9vbFVzZVJlc3VsdE1lc3NhZ2UobXNnKSkge1xuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBjb25zdCByZXN1bHQgPSBtc2cudG9vbFVzZVJlc3VsdCBhcyBGaWxlRWRpdE91dHB1dCB8IEZpbGVXcml0ZVRvb2xPdXRwdXRcbiAgICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0LmZpbGVQYXRoIHx8ICFyZXN1bHQuc3RydWN0dXJlZFBhdGNoKSB7XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmICghZmlsZXNDaGFuZ2VkLmluY2x1ZGVzKHJlc3VsdC5maWxlUGF0aCkpIHtcbiAgICAgIGZpbGVzQ2hhbmdlZC5wdXNoKHJlc3VsdC5maWxlUGF0aClcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgaWYgKCd0eXBlJyBpbiByZXN1bHQgJiYgcmVzdWx0LnR5cGUgPT09ICdjcmVhdGUnKSB7XG4gICAgICAgIGluc2VydGlvbnMgKz0gcmVzdWx0LmNvbnRlbnQuc3BsaXQoL1xccj9cXG4vKS5sZW5ndGhcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAoY29uc3QgaHVuayBvZiByZXN1bHQuc3RydWN0dXJlZFBhdGNoKSB7XG4gICAgICAgICAgY29uc3QgYWRkaXRpb25zID0gY291bnQoaHVuay5saW5lcywgbGluZSA9PiBsaW5lLnN0YXJ0c1dpdGgoJysnKSlcbiAgICAgICAgICBjb25zdCByZW1vdmFscyA9IGNvdW50KGh1bmsubGluZXMsIGxpbmUgPT4gbGluZS5zdGFydHNXaXRoKCctJykpXG5cbiAgICAgICAgICBpbnNlcnRpb25zICs9IGFkZGl0aW9uc1xuICAgICAgICAgIGRlbGV0aW9ucyArPSByZW1vdmFsc1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb250aW51ZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgZmlsZXNDaGFuZ2VkLFxuICAgIGluc2VydGlvbnMsXG4gICAgZGVsZXRpb25zLFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZWxlY3RhYmxlVXNlck1lc3NhZ2VzRmlsdGVyKFxuICBtZXNzYWdlOiBNZXNzYWdlLFxuKTogbWVzc2FnZSBpcyBVc2VyTWVzc2FnZSB7XG4gIGlmIChtZXNzYWdlLnR5cGUgIT09ICd1c2VyJykge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGlmIChcbiAgICBBcnJheS5pc0FycmF5KG1lc3NhZ2UubWVzc2FnZS5jb250ZW50KSAmJlxuICAgIG1lc3NhZ2UubWVzc2FnZS5jb250ZW50WzBdPy50eXBlID09PSAndG9vbF9yZXN1bHQnXG4gICkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGlmIChpc1N5bnRoZXRpY01lc3NhZ2UobWVzc2FnZSkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBpZiAobWVzc2FnZS5pc01ldGEpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBpZiAobWVzc2FnZS5pc0NvbXBhY3RTdW1tYXJ5IHx8IG1lc3NhZ2UuaXNWaXNpYmxlSW5UcmFuc2NyaXB0T25seSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgY29uc3QgY29udGVudCA9IG1lc3NhZ2UubWVzc2FnZS5jb250ZW50XG4gIGNvbnN0IGxhc3RCbG9jayA9XG4gICAgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnID8gbnVsbCA6IGNvbnRlbnRbY29udGVudC5sZW5ndGggLSAxXVxuICBjb25zdCBtZXNzYWdlVGV4dCA9XG4gICAgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnXG4gICAgICA/IGNvbnRlbnQudHJpbSgpXG4gICAgICA6IGxhc3RCbG9jayAmJiBpc1RleHRCbG9jayhsYXN0QmxvY2spXG4gICAgICAgID8gbGFzdEJsb2NrLnRleHQudHJpbSgpXG4gICAgICAgIDogJydcblxuICAvLyBGaWx0ZXIgb3V0IG5vbi11c2VyLWF1dGhvcmVkIG1lc3NhZ2VzIChjb21tYW5kIG91dHB1dHMsIHRhc2sgbm90aWZpY2F0aW9ucywgdGlja3MpLlxuICBpZiAoXG4gICAgbWVzc2FnZVRleHQuaW5kZXhPZihgPCR7TE9DQUxfQ09NTUFORF9TVERPVVRfVEFHfT5gKSAhPT0gLTEgfHxcbiAgICBtZXNzYWdlVGV4dC5pbmRleE9mKGA8JHtMT0NBTF9DT01NQU5EX1NUREVSUl9UQUd9PmApICE9PSAtMSB8fFxuICAgIG1lc3NhZ2VUZXh0LmluZGV4T2YoYDwke0JBU0hfU1RET1VUX1RBR30+YCkgIT09IC0xIHx8XG4gICAgbWVzc2FnZVRleHQuaW5kZXhPZihgPCR7QkFTSF9TVERFUlJfVEFHfT5gKSAhPT0gLTEgfHxcbiAgICBtZXNzYWdlVGV4dC5pbmRleE9mKGA8JHtUQVNLX05PVElGSUNBVElPTl9UQUd9PmApICE9PSAtMSB8fFxuICAgIG1lc3NhZ2VUZXh0LmluZGV4T2YoYDwke1RJQ0tfVEFHfT5gKSAhPT0gLTEgfHxcbiAgICBtZXNzYWdlVGV4dC5pbmRleE9mKGA8JHtURUFNTUFURV9NRVNTQUdFX1RBR31gKSAhPT0gLTFcbiAgKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgcmV0dXJuIHRydWVcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgYWxsIG1lc3NhZ2VzIGFmdGVyIHRoZSBnaXZlbiBpbmRleCBhcmUgc3ludGhldGljIChpbnRlcnJ1cHRpb25zLCBjYW5jZWxzLCBldGMuKVxuICogb3Igbm9uLW1lYW5pbmdmdWwgY29udGVudC4gUmV0dXJucyB0cnVlIGlmIHRoZXJlJ3Mgbm90aGluZyBtZWFuaW5nZnVsIHRvIGNvbmZpcm0gLVxuICogZm9yIGV4YW1wbGUsIGlmIHRoZSB1c2VyIGhpdCBlbnRlciB0aGVuIGltbWVkaWF0ZWx5IGNhbmNlbGxlZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lc3NhZ2VzQWZ0ZXJBcmVPbmx5U3ludGhldGljKFxuICBtZXNzYWdlczogTWVzc2FnZVtdLFxuICBmcm9tSW5kZXg6IG51bWJlcixcbik6IGJvb2xlYW4ge1xuICBmb3IgKGxldCBpID0gZnJvbUluZGV4ICsgMTsgaSA8IG1lc3NhZ2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgbXNnID0gbWVzc2FnZXNbaV1cbiAgICBpZiAoIW1zZykgY29udGludWVcblxuICAgIC8vIFNraXAga25vd24gbm9uLW1lYW5pbmdmdWwgbWVzc2FnZSB0eXBlc1xuICAgIGlmIChpc1N5bnRoZXRpY01lc3NhZ2UobXNnKSkgY29udGludWVcbiAgICBpZiAoaXNUb29sVXNlUmVzdWx0TWVzc2FnZShtc2cpKSBjb250aW51ZVxuICAgIGlmIChtc2cudHlwZSA9PT0gJ3Byb2dyZXNzJykgY29udGludWVcbiAgICBpZiAobXNnLnR5cGUgPT09ICdzeXN0ZW0nKSBjb250aW51ZVxuICAgIGlmIChtc2cudHlwZSA9PT0gJ2F0dGFjaG1lbnQnKSBjb250aW51ZVxuICAgIGlmIChtc2cudHlwZSA9PT0gJ3VzZXInICYmIG1zZy5pc01ldGEpIGNvbnRpbnVlXG5cbiAgICAvLyBBc3Npc3RhbnQgd2l0aCBhY3R1YWwgY29udGVudCA9IG1lYW5pbmdmdWxcbiAgICBpZiAobXNnLnR5cGUgPT09ICdhc3Npc3RhbnQnKSB7XG4gICAgICBjb25zdCBjb250ZW50ID0gbXNnLm1lc3NhZ2UuY29udGVudFxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29udGVudCkpIHtcbiAgICAgICAgY29uc3QgaGFzTWVhbmluZ2Z1bENvbnRlbnQgPSBjb250ZW50LnNvbWUoXG4gICAgICAgICAgYmxvY2sgPT5cbiAgICAgICAgICAgIChibG9jay50eXBlID09PSAndGV4dCcgJiYgYmxvY2sudGV4dC50cmltKCkpIHx8XG4gICAgICAgICAgICBibG9jay50eXBlID09PSAndG9vbF91c2UnLFxuICAgICAgICApXG4gICAgICAgIGlmIChoYXNNZWFuaW5nZnVsQ29udGVudCkgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIC8vIFVzZXIgbWVzc2FnZXMgdGhhdCBhcmVuJ3Qgc3ludGhldGljIG9yIG1ldGEgPSBtZWFuaW5nZnVsXG4gICAgaWYgKG1zZy50eXBlID09PSAndXNlcicpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIC8vIE90aGVyIHR5cGVzIChlLmcuLCB0b21ic3RvbmUpIGFyZSBub24tbWVhbmluZ2Z1bCwgY29udGludWVcbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuIl0sIm1hcHBpbmdzIjoiO0FBQUEsY0FDRUEsaUJBQWlCLEVBQ2pCQyxjQUFjLFFBQ1QsdUNBQXVDO0FBQzlDLFNBQVNDLFVBQVUsRUFBRSxLQUFLQyxJQUFJLFFBQVEsUUFBUTtBQUM5QyxPQUFPQyxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPLEtBQUtDLEtBQUssTUFBTSxPQUFPO0FBQzlCLFNBQVNDLFdBQVcsRUFBRUMsU0FBUyxFQUFFQyxPQUFPLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ2pFLFNBQ0UsS0FBS0MsMERBQTBELEVBQy9EQyxRQUFRLFFBQ0gsaUNBQWlDO0FBQ3hDLFNBQVNDLFdBQVcsUUFBUSx1QkFBdUI7QUFDbkQsU0FDRSxLQUFLQyxTQUFTLEVBQ2RDLHFCQUFxQixFQUNyQkMsa0JBQWtCLEVBQ2xCQyx1QkFBdUIsUUFDbEIsMEJBQTBCO0FBQ2pDLFNBQVNDLFFBQVEsUUFBUSxrQkFBa0I7QUFDM0MsU0FBU0MsOEJBQThCLFFBQVEsNENB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