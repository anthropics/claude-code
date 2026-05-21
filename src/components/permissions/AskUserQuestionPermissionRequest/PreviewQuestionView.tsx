import figures from 'figures';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTerminalSize } from '../../../hooks/useTerminalSize.js';
import type { KeyboardEvent } from '../../../ink/events/keyboard-event.js';
import { Box, Text } from '../../../ink.js';
import { useKeybinding, useKeybindings } from '../../../keybindings/useKeybinding.js';
import { useAppState } from '../../../state/AppState.js';
import type { Question } from '../../../tools/AskUserQuestionTool/AskUserQuestionTool.js';
import { getExternalEditor } from '../../../utils/editor.js';
import { toIDEDisplayName } from '../../../utils/ide.js';
import { editPromptInEditor } from '../../../utils/promptEditor.js';
import { Divider } from '../../design-system/Divider.js';
import TextInput from '../../TextInput.js';
import { PermissionRequestTitle } from '../PermissionRequestTitle.js';
import { PreviewBox } from './PreviewBox.js';
import { QuestionNavigationBar } from './QuestionNavigationBar.js';
import type { QuestionState } from './use-multiple-choice-state.js';
type Props = {
  question: Question;
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  questionStates: Record<string, QuestionState>;
  hideSubmitTab?: boolean;
  minContentHeight?: number;
  minContentWidth?: number;
  onUpdateQuestionState: (questionText: string, updates: Partial<QuestionState>, isMultiSelect: boolean) => void;
  onAnswer: (questionText: string, label: string | string[], textInput?: string, shouldAdvance?: boolean) => void;
  onTextInputFocus: (isInInput: boolean) => void;
  onCancel: () => void;
  onTabPrev?: () => void;
  onTabNext?: () => void;
  onRespondToClaude: () => void;
  onFinishPlanInterview: () => void;
};

/**
 * A side-by-side question view for questions with preview content.
 * Displays a vertical option list on the left with a preview panel on the right.
 */
export function PreviewQuestionView({
  question,
  questions,
  currentQuestionIndex,
  answers,
  questionStates,
  hideSubmitTab = false,
  minContentHeight,
  minContentWidth,
  onUpdateQuestionState,
  onAnswer,
  onTextInputFocus,
  onCancel,
  onTabPrev,
  onTabNext,
  onRespondToClaude,
  onFinishPlanInterview
}: Props): React.ReactNode {
  const isInPlanMode = useAppState(s => s.toolPermissionContext.mode) === 'plan';
  const [isFooterFocused, setIsFooterFocused] = useState(false);
  const [footerIndex, setFooterIndex] = useState(0);
  const [isInNotesInput, setIsInNotesInput] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);
  const editor = getExternalEditor();
  const editorName = editor ? toIDEDisplayName(editor) : null;
  const questionText = question.question;
  const questionState = questionStates[questionText];

  // Only real options — no "Other" for preview questions
  const allOptions = question.options;

  // Track which option is focused (for preview display)
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Reset focusedIndex when navigating to a different question
  const prevQuestionText = useRef(questionText);
  if (prevQuestionText.current !== questionText) {
    prevQuestionText.current = questionText;
    const selected = questionState?.selectedValue as string | undefined;
    const idx = selected ? allOptions.findIndex(opt => opt.label === selected) : -1;
    setFocusedIndex(idx >= 0 ? idx : 0);
  }
  const focusedOption = allOptions[focusedIndex];
  const selectedValue = questionState?.selectedValue as string | undefined;
  const notesValue = questionState?.textInputValue || '';
  const handleSelectOption = useCallback((index: number) => {
    const option = allOptions[index];
    if (!option) return;
    setFocusedIndex(index);
    onUpdateQuestionState(questionText, {
      selectedValue: option.label
    }, false);
    onAnswer(questionText, option.label);
  }, [allOptions, questionText, onUpdateQuestionState, onAnswer]);
  const handleNavigate = useCallback((direction: 'up' | 'down' | number) => {
    if (isInNotesInput) return;
    let newIndex: number;
    if (typeof direction === 'number') {
      newIndex = direction;
    } else if (direction === 'up') {
      newIndex = focusedIndex > 0 ? focusedIndex - 1 : focusedIndex;
    } else {
      newIndex = focusedIndex < allOptions.length - 1 ? focusedIndex + 1 : focusedIndex;
    }
    if (newIndex >= 0 && newIndex < allOptions.length) {
      setFocusedIndex(newIndex);
    }
  }, [focusedIndex, allOptions.length, isInNotesInput]);

  // Handle ctrl+g to open external editor for notes
  useKeybinding('chat:externalEditor', async () => {
    const currentValue = questionState?.textInputValue || '';
    const result = await editPromptInEditor(currentValue);
    if (result.content !== null && result.content !== currentValue) {
      onUpdateQuestionState(questionText, {
        textInputValue: result.content
      }, false);
    }
  }, {
    context: 'Chat',
    isActive: isInNotesInput && !!editor
  });

  // Handle left/right arrow and tab for question navigation.
  // This must be in the child component (not just the parent) because child useInput
  // handlers register first on the event emitter and fire before parent handlers.
  // Without this, the parent's useKeybindings may not fire reliably depending on
  // listener ordering in the event emitter.
  useKeybindings({
    'tabs:previous': () => onTabPrev?.(),
    'tabs:next': () => onTabNext?.()
  }, {
    context: 'Tabs',
    isActive: !isInNotesInput && !isFooterFocused
  });

  // Re-submit the answer (plain label) when exiting notes input.
  // Notes are stored in questionStates and collected at submit time via annotations.
  const handleNotesExit = useCallback(() => {
    setIsInNotesInput(false);
    onTextInputFocus(false);
    if (selectedValue) {
      onAnswer(questionText, selectedValue);
    }
  }, [selectedValue, questionText, onAnswer, onTextInputFocus]);
  const handleDownFromPreview = useCallback(() => {
    setIsFooterFocused(true);
  }, []);
  const handleUpFromFooter = useCallback(() => {
    setIsFooterFocused(false);
  }, []);

  // Handle keyboard input for option/footer/notes navigation.
  // Always active — the handler routes internally based on isFooterFocused/isInNotesInput.
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isFooterFocused) {
      if (e.key === 'up' || e.ctrl && e.key === 'p') {
        e.preventDefault();
        if (footerIndex === 0) {
          handleUpFromFooter();
        } else {
          setFooterIndex(0);
        }
        return;
      }
      if (e.key === 'down' || e.ctrl && e.key === 'n') {
        e.preventDefault();
        if (isInPlanMode && footerIndex === 0) {
          setFooterIndex(1);
        }
        return;
      }
      if (e.key === 'return') {
        e.preventDefault();
        if (footerIndex === 0) {
          onRespondToClaude();
        } else {
          onFinishPlanInterview();
        }
        return;
      }
      if (e.key === 'escape') {
        e.preventDefault();
        onCancel();
      }
      return;
    }
    if (isInNotesInput) {
      // In notes input mode, handle escape to exit back to option navigation
      if (e.key === 'escape') {
        e.preventDefault();
        handleNotesExit();
      }
      return;
    }

    // Handle option navigation (vertical)
    if (e.key === 'up' || e.ctrl && e.key === 'p') {
      e.preventDefault();
      if (focusedIndex > 0) {
        handleNavigate('up');
      }
    } else if (e.key === 'down' || e.ctrl && e.key === 'n') {
      e.preventDefault();
      if (focusedIndex === allOptions.length - 1) {
        // At bottom of options, go to footer
        handleDownFromPreview();
      } else {
        handleNavigate('down');
      }
    } else if (e.key === 'return') {
      e.preventDefault();
      handleSelectOption(focusedIndex);
    } else if (e.key === 'n' && !e.ctrl && !e.meta) {
      // Press 'n' to focus the notes input
      e.preventDefault();
      setIsInNotesInput(true);
      onTextInputFocus(true);
    } else if (e.key === 'escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key.length === 1 && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const idx_0 = parseInt(e.key, 10) - 1;
      if (idx_0 < allOptions.length) {
        handleNavigate(idx_0);
      }
    }
  }, [isFooterFocused, footerIndex, isInPlanMode, isInNotesInput, focusedIndex, allOptions.length, handleUpFromFooter, handleDownFromPreview, handleNavigate, handleSelectOption, handleNotesExit, onRespondToClaude, onFinishPlanInterview, onCancel, onTextInputFocus]);
  const previewContent = focusedOption?.preview || null;

  // The right panel's available width is terminal minus the left panel and gap.
  const LEFT_PANEL_WIDTH = 30;
  const GAP = 4;
  const {
    columns
  } = useTerminalSize();
  const previewMaxWidth = columns - LEFT_PANEL_WIDTH - GAP;

  // Lines used within the content area that aren't preview content:
  // 1: marginTop on side-by-side box
  // 2: PreviewBox borders (top + bottom)
  // 2: notes section (marginTop=1 + text)
  // 2: footer section (marginTop=1 + divider)
  // 1: "Chat about this" line
  // 1: plan mode line (may or may not show)
  // 2: help text (marginTop=1 + text)
  const PREVIEW_OVERHEAD = 11;

  // Compute the max lines available for preview content from the parent's
  // height budget to prevent terminal overflow. We do NOT pad shorter options
  // to match the tallest — the outer box's minHeight handles cross-question
  // layout consistency, and within-question shifts are acceptable.
  const previewMaxLines = useMemo(() => {
    return minContentHeight ? Math.max(1, minContentHeight - PREVIEW_OVERHEAD) : undefined;
  }, [minContentHeight]);
  return <Box flexDirection="column" marginTop={1} tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Divider color="inactive" />
      <Box flexDirection="column" paddingTop={0}>
        <QuestionNavigationBar questions={questions} currentQuestionIndex={currentQuestionIndex} answers={answers} hideSubmitTab={hideSubmitTab} />
        <PermissionRequestTitle title={question.question} color={'text'} />

        <Box flexDirection="column" minHeight={minContentHeight}>
          {/* Side-by-side layout: options on left, preview on right */}
          <Box marginTop={1} flexDirection="row" gap={4}>
            {/* Left panel: vertical option list */}
            <Box flexDirection="column" width={30}>
              {allOptions.map((option_0, index_0) => {
              const isFocused = focusedIndex === index_0;
              const isSelected = selectedValue === option_0.label;
              return <Box key={option_0.label} flexDirection="row">
                    {isFocused ? <Text color="suggestion">{figures.pointer}</Text> : <Text> </Text>}
                    <Text dimColor> {index_0 + 1}.</Text>
                    <Text color={isSelected ? 'success' : isFocused ? 'suggestion' : undefined} bold={isFocused}>
                      {' '}
                      {option_0.label}
                    </Text>
                    {isSelected && <Text color="success"> {figures.tick}</Text>}
                  </Box>;
            })}
            </Box>

            {/* Right panel: preview + notes */}
            <Box flexDirection="column" flexGrow={1}>
              <PreviewBox content={previewContent || 'No preview available'} maxLines={previewMaxLines} minWidth={minContentWidth} maxWidth={previewMaxWidth} />
              <Box marginTop={1} flexDirection="row" gap={1}>
                <Text color="suggestion">Notes:</Text>
                {isInNotesInput ? <TextInput value={notesValue} placeholder="Add notes on this design…" onChange={value => {
                onUpdateQuestionState(questionText, {
                  textInputValue: value
                }, false);
              }} onSubmit={handleNotesExit} onExit={handleNotesExit} focus={true} showCursor={true} columns={60} cursorOffset={cursorOffset} onChangeCursorOffset={setCursorOffset} /> : <Text dimColor italic>
                    {notesValue || 'press n to add notes'}
                  </Text>}
              </Box>
            </Box>
          </Box>

          {/* Footer section */}
          <Box flexDirection="column" marginTop={1}>
            <Divider color="inactive" />
            <Box flexDirection="row" gap={1}>
              {isFooterFocused && footerIndex === 0 ? <Text color="suggestion">{figures.pointer}</Text> : <Text> </Text>}
              <Text color={isFooterFocused && footerIndex === 0 ? 'suggestion' : undefined}>
                Chat about this
              </Text>
            </Box>
            {isInPlanMode && <Box flexDirection="row" gap={1}>
                {isFooterFocused && footerIndex === 1 ? <Text color="suggestion">{figures.pointer}</Text> : <Text> </Text>}
                <Text color={isFooterFocused && footerIndex === 1 ? 'suggestion' : undefined}>
                  Skip interview and plan immediately
                </Text>
              </Box>}
          </Box>
          <Box marginTop={1}>
            <Text color="inactive" dimColor>
              Enter to select · {figures.arrowUp}/{figures.arrowDown} to
              navigate · n to add notes
              {questions.length > 1 && <> · Tab to switch questions</>}
              {isInNotesInput && editorName && <> · ctrl+g to edit in {editorName}</>}{' '}
              · Esc to cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJmaWd1cmVzIiwiUmVhY3QiLCJ1c2VDYWxsYmFjayIsInVzZU1lbW8iLCJ1c2VSZWYiLCJ1c2VTdGF0ZSIsInVzZVRlcm1pbmFsU2l6ZSIsIktleWJvYXJkRXZlbnQiLCJCb3giLCJUZXh0IiwidXNlS2V5YmluZGluZyIsInVzZUtleWJpbmRpbmdzIiwidXNlQXBwU3RhdGUiLCJRdWVzdGlvbiIsImdldEV4dGVybmFsRWRpdG9yIiwidG9JREVEaXNwbGF5TmFtZSIsImVkaXRQcm9tcHRJbkVkaXRvciIsIkRpdmlkZXIiLCJUZXh0SW5wdXQiLCJQZXJtaXNzaW9uUmVxdWVzdFRpdGxlIiwiUHJldmlld0JveCIsIlF1ZXN0aW9uTmF2aWdhdGlvbkJhciIsIlF1ZXN0aW9uU3RhdGUiLCJQcm9wcyIsInF1ZXN0aW9uIiwicXVlc3Rpb25zIiwiY3VycmVudFF1ZXN0aW9uSW5kZXgiLCJhbnN3ZXJzIiwiUmVjb3JkIiwicXVlc3Rpb25TdGF0ZXMiLCJoaWRlU3VibWl0VGFiIiwibWluQ29udGVudEhlaWdodCIsIm1pbkNvbnRlbnRXaWR0aCIsIm9uVXBkYXRlUXVlc3Rpb25TdGF0ZSIsInF1ZXN0aW9uVGV4dCIsInVwZGF0ZXMiLCJQYXJ0aWFsIiwiaXNNdWx0aVNlbGVjdCIsIm9uQW5zd2VyIiwibGFiZWwiLCJ0ZXh0SW5wdXQiLCJzaG91bGRBZHZhbmNlIiwib25UZXh0SW5wdXRGb2N1cyIsImlzSW5JbnB1dCIsIm9uQ2FuY2VsIiwib25UYWJQcmV2Iiwib25UYWJOZXh0Iiwib25SZXNwb25kVG9DbGF1ZGUiLCJvbkZpbmlzaFBsYW5JbnRlcnZpZXciLCJQcmV2aWV3UXVlc3Rpb25WaWV3IiwiUmVhY3ROb2RlIiwiaXNJblBsYW5Nb2RlIiwicyIsInRvb2xQZXJtaXNzaW9uQ29udGV4dCIsIm1vZGUiLCJpc0Zvb3RlckZvY3VzZWQiLCJzZXRJc0Zvb3RlckZvY3VzZWQiLCJmb290ZXJJbmRleCIsInNldEZvb3RlckluZGV4IiwiaXNJbk5vdGVzSW5wdXQiLCJzZXRJc0luTm90ZXNJbnB1dCIsImN1cnNvck9mZnNldCIsInNldEN1cnNvck9mZnNldCIsImVkaXRvciIsImVkaXRvck5hbWUiLCJxdWVzdGlvblN0YXRlIiwiYWxsT3B0aW9ucyIsIm9wdGlvbnMiLCJmb2N1c2VkSW5kZXgiLCJzZXRGb2N1c2VkSW5kZXgiLCJwcmV2UXVlc3Rpb25UZXh0IiwiY3VycmVudCIsInNlbGVjdGVkIiwic2VsZWN0ZWRWYWx1ZSIsImlkeCIsImZpbmRJbmRleCIsIm9wdCIsImZvY3VzZWRPcHRpb24iLCJub3Rlc1ZhbHVlIiwidGV4dElucHV0VmFsdWUiLCJoYW5kbGVTZWxlY3RPcHRpb24iLCJpbmRleCIsIm9wdGlvbiIsImhhbmRsZU5hdmlnYXRlIiwiZGlyZWN0aW9uIiwibmV3SW5kZXgiLCJsZW5ndGgiLCJjdXJyZW50VmFsdWUiLCJyZXN1bHQiLCJjb250ZW50IiwiY29udGV4dCIsImlzQWN0aXZlIiwidGFiczpwcmV2aW91cyIsInRhYnM6bmV4dCIsImhhbmRsZU5vdGVzRXhpdCIsImhhbmRsZURvd25Gcm9tUHJldmlldyIsImhhbmRsZVVwRnJvbUZvb3RlciIsImhhbmRsZUtleURvd24iLCJlIiwia2V5IiwiY3RybCIsInByZXZlbnREZWZhdWx0IiwibWV0YSIsInBhcnNlSW50IiwicHJldmlld0NvbnRlbnQiLCJwcmV2aWV3IiwiTEVGVF9QQU5FTF9XSURUSCIsIkdBUCIsImNvbHVtbnMiLCJwcmV2aWV3TWF4V2lkdGgiLCJQUkVWSUVXX09WRVJIRUFEIiwicHJldmlld01heExpbmVzIiwiTWF0aCIsIm1heCIsInVuZGVmaW5lZCIsIm1hcCIsImlzRm9jdXNlZCIsImlzU2VsZWN0ZWQiLCJwb2ludGVyIiwidGljayIsInZhbHVlIiwiYXJyb3dVcCIsImFycm93RG93biJdLCJzb3VyY2VzIjpbIlByZXZpZXdRdWVzdGlvblZpZXcudHN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmaWd1cmVzIGZyb20gJ2ZpZ3VyZXMnXG5pbXBvcnQgUmVhY3QsIHsgdXNlQ2FsbGJhY2ssIHVzZU1lbW8sIHVzZVJlZiwgdXNlU3RhdGUgfSBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHVzZVRlcm1pbmFsU2l6ZSB9IGZyb20gJy4uLy4uLy4uL2hvb2tzL3VzZVRlcm1pbmFsU2l6ZS5qcydcbmltcG9ydCB0eXBlIHsgS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2luay9ldmVudHMva2V5Ym9hcmQtZXZlbnQuanMnXG5pbXBvcnQgeyBCb3gsIFRleHQgfSBmcm9tICcuLi8uLi8uLi9pbmsuanMnXG5pbXBvcnQge1xuICB1c2VLZXliaW5kaW5nLFxuICB1c2VLZXliaW5kaW5ncyxcbn0gZnJvbSAnLi4vLi4vLi4va2V5YmluZGluZ3MvdXNlS2V5YmluZGluZy5qcydcbmltcG9ydCB7IHVzZUFwcFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vc3RhdGUvQXBwU3RhdGUuanMnXG5pbXBvcnQgdHlwZSB7IFF1ZXN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vdG9vbHMvQXNrVXNlclF1ZXN0aW9uVG9vbC9Bc2tVc2VyUXVlc3Rpb25Ub29sLmpzJ1xuaW1wb3J0IHsgZ2V0RXh0ZXJuYWxFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi91dGlscy9lZGl0b3IuanMnXG5pbXBvcnQgeyB0b0lERURpc3BsYXlOYW1lIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvaWRlLmpzJ1xuaW1wb3J0IHsgZWRpdFByb21wdEluRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vdXRpbHMvcHJvbXB0RWRpdG9yLmpzJ1xuaW1wb3J0IHsgRGl2aWRlciB9IGZyb20gJy4uLy4uL2Rlc2lnbi1zeXN0ZW0vRGl2aWRlci5qcydcbmltcG9ydCBUZXh0SW5wdXQgZnJvbSAnLi4vLi4vVGV4dElucHV0LmpzJ1xuaW1wb3J0IHsgUGVybWlzc2lvblJlcXVlc3RUaXRsZSB9IGZyb20gJy4uL1Blcm1pc3Npb25SZXF1ZXN0VGl0bGUuanMnXG5pbXBvcnQgeyBQcmV2aWV3Qm94IH0gZnJvbSAnLi9QcmV2aWV3Qm94LmpzJ1xuaW1wb3J0IHsgUXVlc3Rpb25OYXZpZ2F0aW9uQmFyIH0gZnJvbSAnLi9RdWVzdGlvbk5hdmlnYXRpb25CYXIuanMnXG5pbXBvcnQgdHlwZSB7IFF1ZXN0aW9uU3RhdGUgfSBmcm9tICcuL3VzZS1tdWx0aXBsZS1jaG9pY2Utc3RhdGUuanMnXG5cbnR5cGUgUHJvcHMgPSB7XG4gIHF1ZXN0aW9uOiBRdWVzdGlvblxuICBxdWVzdGlvbnM6IFF1ZXN0aW9uW11cbiAgY3VycmVudFF1ZXN0aW9uSW5kZXg6IG51bWJlclxuICBhbnN3ZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gIHF1ZXN0aW9uU3RhdGVzOiBSZWNvcmQ8c3RyaW5nLCBRdWVzdGlvblN0YXRlPlxuICBoaWRlU3VibWl0VGFiPzogYm9vbGVhblxuICBtaW5Db250ZW50SGVpZ2h0PzogbnVtYmVyXG4gIG1pbkNvbnRlbnRXaWR0aD86IG51bWJlclxuICBvblVwZGF0ZVF1ZXN0aW9uU3RhdGU6IChcbiAgICBxdWVzdGlvblRleHQ6IHN0cmluZyxcbiAgICB1cGRhdGVzOiBQYXJ0aWFsPFF1ZXN0aW9uU3RhdGU+LFxuICAgIGlzTXVsdGlTZWxlY3Q6IGJvb2xlYW4sXG4gICkgPT4gdm9pZFxuICBvbkFuc3dlcjogKFxuICAgIHF1ZXN0aW9uVGV4dDogc3RyaW5nLFxuICAgIGxhYmVsOiBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICB0ZXh0SW5wdXQ/OiBzdHJpbmcsXG4gICAgc2hvdWxkQWR2YW5jZT86IGJvb2xlYW4sXG4gICkgPT4gdm9pZFxuICBvblRleHRJbnB1dEZvY3VzOiAoaXNJbklucHV0OiBib29sZWFuKSA9PiB2b2lkXG4gIG9uQ2FuY2VsOiAoKSA9PiB2b2lkXG4gIG9uVGFiUHJldj86ICgpID0+IHZvaWRcbiAgb25UYWJOZXh0PzogKCkgPT4gdm9pZFxuICBvblJlc3BvbmRUb0NsYXVkZTogKCkgPT4gdm9pZFxuICBvbkZpbmlzaFBsYW5JbnRlcnZpZXc6ICgpID0+IHZvaWRcbn1cblxuLyoqXG4gKiBBIHNpZGUtYnktc2lkZSBxdWVzdGlvbiB2aWV3IGZvciBxdWVzdGlvbnMgd2l0aCBwcmV2aWV3IGNvbnRlbnQuXG4gKiBEaXNwbGF5cyBhIHZlcnRpY2FsIG9wdGlvbiBsaXN0IG9uIHRoZSBsZWZ0IHdpdGggYSBwcmV2aWV3IHBhbmVsIG9uIHRoZSByaWdodC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIFByZXZpZXdRdWVzdGlvblZpZXcoe1xuICBxdWVzdGlvbixcbiAgcXVlc3Rpb25zLFxuICBjdXJyZW50UXVlc3Rpb25JbmRleCxcbiAgYW5zd2VycyxcbiAgcXVlc3Rpb25TdGF0ZXMsXG4gIGhpZGVTdWJtaXRUYWIgPSBmYWxzZSxcbiAgbWluQ29udGVudEhlaWdodCxcbiAgbWluQ29udGVudFdpZHRoLFxuICBvblVwZGF0ZVF1ZXN0aW9uU3RhdGUsXG4gIG9uQW5zd2VyLFxuICBvblRleHRJbnB1dEZvY3VzLFxuICBvbkNhbmNlbCxcbiAgb25UYWJQcmV2LFxuICBvblRhYk5leHQsXG4gIG9uUmVzcG9uZFRvQ2xhdWRlLFxuICBvbkZpbmlzaFBsYW5JbnRlcnZpZXcsXG59OiBQcm9wcyk6IFJlYWN0LlJlYWN0Tm9kZSB7XG4gIGNvbnN0IGlzSW5QbGFuTW9kZSA9IHVzZUFwcFN0YXRlKHMgPT4gcy50b29sUGVybWlzc2lvbkNvbnRleHQubW9kZSkgPT09ICdwbGFuJ1xuICBjb25zdCBbaXNGb290ZXJGb2N1c2VkLCBzZXRJc0Zvb3RlckZvY3VzZWRdID0gdXNlU3RhdGUoZmFsc2UpXG4gIGNvbnN0IFtmb290ZXJJbmRleCwgc2V0Rm9vdGVySW5kZXhdID0gdXNlU3RhdGUoMClcbiAgY29uc3QgW2lzSW5Ob3Rlc0lucHV0LCBzZXRJc0luTm90ZXNJbnB1dF0gPSB1c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2N1cnNvck9mZnNldCwgc2V0Q3Vyc29yT2Zmc2V0XSA9IHVzZVN0YXRlKDApXG5cbiAgY29uc3QgZWRpdG9yID0gZ2V0RXh0ZXJuYWxFZGl0b3IoKVxuICBjb25zdCBlZGl0b3JOYW1lID0gZWRpdG9yID8gdG9JREVEaXNwbGF5TmFtZShlZGl0b3IpIDogbnVsbFxuXG4gIGNvbnN0IHF1ZXN0aW9uVGV4dCA9IHF1ZXN0aW9uLnF1ZXN0aW9uXG4gIGNvbnN0IHF1ZXN0aW9uU3RhdGUgPSBxdWVzdGlvblN0YXRlc1txdWVzdGlvblRleHRdXG5cbiAgLy8gT25seSByZWFsIG9wdGlvbnMg4oCUIG5vIFwiT3RoZXJcIiBmb3IgcHJldmlldyBxdWVzdGlvbnNcbiAgY29uc3QgYWxsT3B0aW9ucyA9IHF1ZXN0aW9uLm9wdGlvbnNcblxuICAvLyBUcmFjayB3aGljaCBvcHRpb24gaXMgZm9jdXNlZCAoZm9yIHByZXZpZXcgZGlzcGxheSlcbiAgY29uc3QgW2ZvY3VzZWRJbmRleCwgc2V0Rm9jdXNlZEluZGV4XSA9IHVzZVN0YXRlKDApXG5cbiAgLy8gUmVzZXQgZm9jdXNlZEluZGV4IHdoZW4gbmF2aWdhdGluZyB0byBhIGRpZmZlcmVudCBxdWVzdGlvblxuICBjb25zdCBwcmV2UXVlc3Rpb25UZXh0ID0gdXNlUmVmKHF1ZXN0aW9uVGV4dClcbiAgaWYgKHByZXZRdWVzdGlvblRleHQuY3VycmVudCAhPT0gcXVlc3Rpb25UZXh0KSB7XG4gICAgcHJldlF1ZXN0aW9uVGV4dC5jdXJyZW50ID0gcXVlc3Rpb25UZXh0XG4gICAgY29uc3Qgc2VsZWN0ZWQgPSBxdWVzdGlvblN0YXRlPy5zZWxlY3RlZFZhbHVlIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuICAgIGNvbnN0IGlkeCA9IHNlbGVjdGVkXG4gICAgICA/IGFsbE9wdGlvbnMuZmluZEluZGV4KG9wdCA9PiBvcHQubGFiZWwgPT09IHNlbGVjdGVkKVxuICAgICAgOiAtMVxuICAgIHNldEZvY3VzZWRJbmRleChpZHggPj0gMCA/IGlkeCA6IDApXG4gIH1cblxuICBjb25zdCBmb2N1c2VkT3B0aW9uID0gYWxsT3B0aW9uc1tmb2N1c2VkSW5kZXhdXG4gIGNvbnN0IHNlbGVjdGVkVmFsdWUgPSBxdWVzdGlvblN0YXRlPy5zZWxlY3RlZFZhbHVlIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuICBjb25zdCBub3Rlc1ZhbHVlID0gcXVlc3Rpb25TdGF0ZT8udGV4dElucHV0VmFsdWUgfHwgJydcblxuICBjb25zdCBoYW5kbGVTZWxlY3RPcHRpb24gPSB1c2VDYWxsYmFjayhcbiAgICAoaW5kZXg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3Qgb3B0aW9uID0gYWxsT3B0aW9uc1tpbmRleF1cbiAgICAgIGlmICghb3B0aW9uKSByZXR1cm5cblxuICAgICAgc2V0Rm9jdXNlZEluZGV4KGluZGV4KVxuICAgICAgb25VcGRhdGVRdWVzdGlvblN0YXRlKFxuICAgICAgICBxdWVzdGlvblRleHQsXG4gICAgICAgIHsgc2VsZWN0ZWRWYWx1ZTogb3B0aW9uLmxhYmVsIH0sXG4gICAgICAgIGZhbHNlLFxuICAgICAgKVxuXG4gICAgICBvbkFuc3dlcihxdWVzdGlvblRleHQsIG9wdGlvbi5sYWJlbClcbiAgICB9LFxuICAgIFthbGxPcHRpb25zLCBxdWVzdGlvblRleHQsIG9uVXBkYXRlUXVlc3Rpb25TdGF0ZSwgb25BbnN3ZXJdLFxuICApXG5cbiAgY29uc3QgaGFuZGxlTmF2aWdhdGUgPSB1c2VDYWxsYmFjayhcbiAgICAoZGlyZWN0aW9uOiAndXAnIHwgJ2Rvd24nIHwgbnVtYmVyKSA9PiB7XG4gICAgICBpZiAoaXNJbk5vdGVzSW5wdXQpIHJldHVyblxuXG4gICAgICBsZXQgbmV3SW5kZXg6IG51bWJlclxuICAgICAgaWYgKHR5cGVvZiBkaXJlY3Rpb24gPT09ICdudW1iZXInKSB7XG4gICAgICAgIG5ld0luZGV4ID0gZGlyZWN0aW9uXG4gICAgICB9IGVsc2UgaWYgKGRpcmVjdGlvbiA9PT0gJ3VwJykge1xuICAgICAgICBuZXdJbmRleCA9IGZvY3VzZWRJbmRleCA+IDAgPyBmb2N1c2VkSW5kZXggLSAxIDogZm9jdXNlZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdJbmRleCA9XG4gICAgICAgICAgZm9jdXNlZEluZGV4IDwgYWxsT3B0aW9ucy5sZW5ndGggLSAxID8gZm9jdXNlZEluZGV4ICsgMSA6IGZvY3VzZWRJbmRleFxuICAgICAgfVxuXG4gICAgICBpZiAobmV3SW5kZXggPj0gMCAmJiBuZXdJbmRleCA8IGFsbE9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgIHNldEZvY3VzZWRJbmRleChuZXdJbmRleClcbiAgICAgIH1cbiAgICB9LFxuICAgIFtmb2N1c2VkSW5kZXgsIGFsbE9wdGlvbnMubGVuZ3RoLCBpc0luTm90ZXNJbnB1dF0sXG4gIClcblxuICAvLyBIYW5kbGUgY3RybCtnIHRvIG9wZW4gZXh0ZXJuYWwgZWRpdG9yIGZvciBub3Rlc1xuICB1c2VLZXliaW5kaW5nKFxuICAgICdjaGF0OmV4dGVybmFsRWRpdG9yJyxcbiAgICBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBjdXJyZW50VmFsdWUgPSBxdWVzdGlvblN0YXRlPy50ZXh0SW5wdXRWYWx1ZSB8fCAnJ1xuICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZWRpdFByb21wdEluRWRpdG9yKGN1cnJlbnRWYWx1ZSlcbiAgICAgIGlmIChyZXN1bHQuY29udGVudCAhPT0gbnVsbCAmJiByZXN1bHQuY29udGVudCAhPT0gY3VycmVudFZhbHVlKSB7XG4gICAgICAgIG9uVXBkYXRlUXVlc3Rpb25TdGF0ZShcbiAgICAgICAgICBxdWVzdGlvblRleHQsXG4gICAgICAgICAgeyB0ZXh0SW5wdXRWYWx1ZTogcmVzdWx0LmNvbnRlbnQgfSxcbiAgICAgICAgICBmYWxzZSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0sXG4gICAgeyBjb250ZXh0OiAnQ2hhdCcsIGlzQWN0aXZlOiBpc0luTm90ZXNJbnB1dCAmJiAhIWVkaXRvciB9LFxuICApXG5cbiAgLy8gSGFuZGxlIGxlZnQvcmlnaHQgYXJyb3cgYW5kIHRhYiBmb3IgcXVlc3Rpb24gbmF2aWdhdGlvbi5cbiAgLy8gVGhpcyBtdXN0IGJlIGluIHRoZSBjaGlsZCBjb21wb25lbnQgKG5vdCBqdXN0IHRoZSBwYXJlbnQpIGJlY2F1c2UgY2hpbGQgdXNlSW5wdXRcbiAgLy8gaGFuZGxlcnMgcmVnaXN0ZXIgZmlyc3Qgb24gdGhlIGV2ZW50IGVtaXR0ZXIgYW5kIGZpcmUgYmVmb3JlIHBhcmVudCBoYW5kbGVycy5cbiAgLy8gV2l0aG91dCB0aGlzLCB0aGUgcGFyZW50J3MgdXNlS2V5YmluZGluZ3MgbWF5IG5vdCBmaXJlIHJlbGlhYmx5IGRlcGVuZGluZyBvblxuICAvLyBsaXN0ZW5lciBvcmRlcmluZyBpbiB0aGUgZXZlbnQgZW1pdHRlci5cbiAgdXNlS2V5YmluZGluZ3MoXG4gICAge1xuICAgICAgJ3RhYnM6cHJldmlvdXMnOiAoKSA9PiBvblRhYlByZXY/LigpLFxuICAgICAgJ3RhYnM6bmV4dCc6ICgpID0+IG9uVGFiTmV4dD8uKCksXG4gICAgfSxcbiAgICB7IGNvbnRleHQ6ICdUYWJzJywgaXNBY3RpdmU6ICFpc0luTm90ZXNJbnB1dCAmJiAhaXNGb290ZXJGb2N1c2VkIH0sXG4gIClcblxuICAvLyBSZS1zdWJtaXQgdGhlIGFuc3dlciAocGxhaW4gbGFiZWwpIHdoZW4gZXhpdGluZyBub3RlcyBpbnB1dC5cbiAgLy8gTm90ZXMgYXJlIHN0b3JlZCBpbiBxdWVzdGlvblN0YXRlcyBhbmQgY29sbGVjdGVkIGF0IHN1Ym1pdCB0aW1lIHZpYSBhbm5vdGF0aW9ucy5cbiAgY29uc3QgaGFuZGxlTm90ZXNFeGl0ID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldElzSW5Ob3Rlc0lucHV0KGZhbHNlKVxuICAgIG9uVGV4dElucHV0Rm9jdXMoZmFsc2UpXG4gICAgaWYgKHNlbGVjdGVkVmFsdWUpIHtcbiAgICAgIG9uQW5zd2VyKHF1ZXN0aW9uVGV4dCwgc2VsZWN0ZWRWYWx1ZSlcbiAgICB9XG4gIH0sIFtzZWxlY3RlZFZhbHVlLCBxdWVzdGlvblRleHQsIG9uQW5zd2VyLCBvblRleHRJbnB1dEZvY3VzXSlcblxuICBjb25zdCBoYW5kbGVEb3duRnJvbVByZXZpZXcgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0SXNGb290ZXJGb2N1c2VkKHRydWUpXG4gIH0sIFtdKVxuXG4gIGNvbnN0IGhhbmRsZVVwRnJvbUZvb3RlciA9IHVzZUNhbGxiYWNrKCgpID0+IHtcbiAgICBzZXRJc0Zvb3RlckZvY3VzZWQoZmFsc2UpXG4gIH0sIFtdKVxuXG4gIC8vIEhhbmRsZSBrZXlib2FyZCBpbnB1dCBmb3Igb3B0aW9uL2Zvb3Rlci9ub3RlcyBuYXZpZ2F0aW9uLlxuICAvLyBBbHdheXMgYWN0aXZlIOKAlCB0aGUgaGFuZGxlciByb3V0ZXMgaW50ZXJuYWxseSBiYXNlZCBvbiBpc0Zvb3RlckZvY3VzZWQvaXNJbk5vdGVzSW5wdXQuXG4gIGNvbnN0IGhhbmRsZUtleURvd24gPSB1c2VDYWxsYmFjayhcbiAgICAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGlzRm9vdGVyRm9jdXNlZCkge1xuICAgICAgICBpZiAoZS5rZXkgPT09ICd1cCcgfHwgKGUuY3RybCAmJiBlLmtleSA9PT0gJ3AnKSkge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgIGlmIChmb290ZXJJbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgaGFuZGxlVXBGcm9tRm9vdGVyKClcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2V0Rm9vdGVySW5kZXgoMClcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5rZXkgPT09ICdkb3duJyB8fCAoZS5jdHJsICYmIGUua2V5ID09PSAnbicpKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgaWYgKGlzSW5QbGFuTW9kZSAmJiBmb290ZXJJbmRleCA9PT0gMCkge1xuICAgICAgICAgICAgc2V0Rm9vdGVySW5kZXgoMSlcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5rZXkgPT09ICdyZXR1cm4nKSB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgaWYgKGZvb3RlckluZGV4ID09PSAwKSB7XG4gICAgICAgICAgICBvblJlc3BvbmRUb0NsYXVkZSgpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9uRmluaXNoUGxhbkludGVydmlldygpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUua2V5ID09PSAnZXNjYXBlJykge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICAgIG9uQ2FuY2VsKClcbiAgICAgICAgfVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgaWYgKGlzSW5Ob3Rlc0lucHV0KSB7XG4gICAgICAgIC8vIEluIG5vdGVzIGlucHV0IG1vZGUsIGhhbmRsZSBlc2NhcGUgdG8gZXhpdCBiYWNrIHRvIG9wdGlvbiBuYXZpZ2F0aW9uXG4gICAgICAgIGlmIChlLmtleSA9PT0gJ2VzY2FwZScpIHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICBoYW5kbGVOb3Rlc0V4aXQoKVxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBIYW5kbGUgb3B0aW9uIG5hdmlnYXRpb24gKHZlcnRpY2FsKVxuICAgICAgaWYgKGUua2V5ID09PSAndXAnIHx8IChlLmN0cmwgJiYgZS5rZXkgPT09ICdwJykpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGlmIChmb2N1c2VkSW5kZXggPiAwKSB7XG4gICAgICAgICAgaGFuZGxlTmF2aWdhdGUoJ3VwJylcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ2Rvd24nIHx8IChlLmN0cmwgJiYgZS5rZXkgPT09ICduJykpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGlmIChmb2N1c2VkSW5kZXggPT09IGFsbE9wdGlvbnMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIC8vIEF0IGJvdHRvbSBvZiBvcHRpb25zLCBnbyB0byBmb290ZXJcbiAgICAgICAgICBoYW5kbGVEb3duRnJvbVByZXZpZXcoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhbmRsZU5hdmlnYXRlKCdkb3duJylcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ3JldHVybicpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIGhhbmRsZVNlbGVjdE9wdGlvbihmb2N1c2VkSW5kZXgpXG4gICAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnbicgJiYgIWUuY3RybCAmJiAhZS5tZXRhKSB7XG4gICAgICAgIC8vIFByZXNzICduJyB0byBmb2N1cyB0aGUgbm90ZXMgaW5wdXRcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgIHNldElzSW5Ob3Rlc0lucHV0KHRydWUpXG4gICAgICAgIG9uVGV4dElucHV0Rm9jdXModHJ1ZSlcbiAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdlc2NhcGUnKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBvbkNhbmNlbCgpXG4gICAgICB9IGVsc2UgaWYgKGUua2V5Lmxlbmd0aCA9PT0gMSAmJiBlLmtleSA+PSAnMScgJiYgZS5rZXkgPD0gJzknKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgICBjb25zdCBpZHggPSBwYXJzZUludChlLmtleSwgMTApIC0gMVxuICAgICAgICBpZiAoaWR4IDwgYWxsT3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICBoYW5kbGVOYXZpZ2F0ZShpZHgpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuICAgIFtcbiAgICAgIGlzRm9vdGVyRm9jdXNlZCxcbiAgICAgIGZvb3RlckluZGV4LFxuICAgICAgaXNJblBsYW5Nb2RlLFxuICAgICAgaXNJbk5vdGVzSW5wdXQsXG4gICAgICBmb2N1c2VkSW5kZXgsXG4gICAgICBhbGxPcHRpb25zLmxlbmd0aCxcbiAgICAgIGhhbmRsZVVwRnJvbUZvb3RlcixcbiAgICAgIGhhbmRsZURvd25Gcm9tUHJldmlldyxcbiAgICAgIGhhbmRsZU5hdmlnYXRlLFxuICAgICAgaGFuZGxlU2VsZWN0T3B0aW9uLFxuICAgICAgaGFuZGxlTm90ZXNFeGl0LFxuICAgICAgb25SZXNwb25kVG9DbGF1ZGUsXG4gICAgICBvbkZpbmlzaFBsYW5JbnRlcnZpZXcsXG4gICAgICBvbkNhbmNlbCxcbiAgICAgIG9uVGV4dElucHV0Rm9jdXMsXG4gICAgXSxcbiAgKVxuXG4gIGNvbnN0IHByZXZpZXdDb250ZW50ID0gZm9jdXNlZE9wdGlvbj8ucHJldmlldyB8fCBudWxsXG5cbiAgLy8gVGhlIHJpZ2h0IHBhbmVsJ3MgYXZhaWxhYmxlIHdpZHRoIGlzIHRlcm1pbmFsIG1pbnVzIHRoZSBsZWZ0IHBhbmVsIGFuZCBnYXAuXG4gIGNvbnN0IExFRlRfUEFORUxfV0lEVEggPSAzMFxuICBjb25zdCBHQVAgPSA0XG4gIGNvbnN0IHsgY29sdW1ucyB9ID0gdXNlVGVybWluYWxTaXplKClcbiAgY29uc3QgcHJldmlld01heFdpZHRoID0gY29sdW1ucyAtIExFRlRfUEFORUxfV0lEVEggLSBHQVBcblxuICAvLyBMaW5lcyB1c2VkIHdpdGhpbiB0aGUgY29udGVudCBhcmVhIHRoYXQgYXJlbid0IHByZXZpZXcgY29udGVudDpcbiAgLy8gMTogbWFyZ2luVG9wIG9uIHNpZGUtYnktc2lkZSBib3hcbiAgLy8gMjogUHJldmlld0JveCBib3JkZXJzICh0b3AgKyBib3R0b20pXG4gIC8vIDI6IG5vdGVzIHNlY3Rpb24gKG1hcmdpblRvcD0xICsgdGV4dClcbiAgLy8gMjogZm9vdGVyIHNlY3Rpb24gKG1hcmdpblRvcD0xICsgZGl2aWRlcilcbiAgLy8gMTogXCJDaGF0IGFib3V0IHRoaXNcIiBsaW5lXG4gIC8vIDE6IHBsYW4gbW9kZSBsaW5lIChtYXkgb3IgbWF5IG5vdCBzaG93KVxuICAvLyAyOiBoZWxwIHRleHQgKG1hcmdpblRvcD0xICsgdGV4dClcbiAgY29uc3QgUFJFVklFV19PVkVSSEVBRCA9IDExXG5cbiAgLy8gQ29tcHV0ZSB0aGUgbWF4IGxpbmVzIGF2YWlsYWJsZSBmb3IgcHJldmlldyBjb250ZW50IGZyb20gdGhlIHBhcmVudCdzXG4gIC8vIGhlaWdodCBidWRnZXQgdG8gcHJldmVudCB0ZXJtaW5hbCBvdmVyZmxvdy4gV2UgZG8gTk9UIHBhZCBzaG9ydGVyIG9wdGlvbnNcbiAgLy8gdG8gbWF0Y2ggdGhlIHRhbGxlc3Qg4oCUIHRoZSBvdXRlciBib3gncyBtaW5IZWlnaHQgaGFuZGxlcyBjcm9zcy1xdWVzdGlvblxuICAvLyBsYXlvdXQgY29uc2lzdGVuY3ksIGFuZCB3aXRoaW4tcXVlc3Rpb24gc2hpZnRzIGFyZSBhY2NlcHRhYmxlLlxuICBjb25zdCBwcmV2aWV3TWF4TGluZXMgPSB1c2VNZW1vKCgpID0+IHtcbiAgICByZXR1cm4gbWluQ29udGVudEhlaWdodFxuICAgICAgPyBNYXRoLm1heCgxLCBtaW5Db250ZW50SGVpZ2h0IC0gUFJFVklFV19PVkVSSEVBRClcbiAgICAgIDogdW5kZWZpbmVkXG4gIH0sIFttaW5Db250ZW50SGVpZ2h0XSlcblxuICByZXR1cm4gKFxuICAgIDxCb3hcbiAgICAgIGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIlxuICAgICAgbWFyZ2luVG9wPXsxfVxuICAgICAgdGFiSW5kZXg9ezB9XG4gICAgICBhdXRvRm9jdXNcbiAgICAgIG9uS2V5RG93bj17aGFuZGxlS2V5RG93bn1cbiAgICA+XG4gICAgICA8RGl2aWRlciBjb2xvcj1cImluYWN0aXZlXCIgLz5cbiAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIHBhZGRpbmdUb3A9ezB9PlxuICAgICAgICA8UXVlc3Rpb25OYXZpZ2F0aW9uQmFyXG4gICAgICAgICAgcXVlc3Rpb25zPXtxdWVzdGlvbnN9XG4gICAgICAgICAgY3VycmVudFF1ZXN0aW9uSW5kZXg9e2N1cnJlbnRRdWVzdGlvbkluZGV4fVxuICAgICAgICAgIGFuc3dlcnM9e2Fuc3dlcnN9XG4gICAgICAgICAgaGlkZVN1Ym1pdFRhYj17aGlkZVN1Ym1pdFRhYn1cbiAgICAgICAgLz5cbiAgICAgICAgPFBlcm1pc3Npb25SZXF1ZXN0VGl0bGUgdGl0bGU9e3F1ZXN0aW9uLnF1ZXN0aW9ufSBjb2xvcj17J3RleHQnfSAvPlxuXG4gICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1pbkhlaWdodD17bWluQ29udGVudEhlaWdodH0+XG4gICAgICAgICAgey8qIFNpZGUtYnktc2lkZSBsYXlvdXQ6IG9wdGlvbnMgb24gbGVmdCwgcHJldmlldyBvbiByaWdodCAqL31cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0gZmxleERpcmVjdGlvbj1cInJvd1wiIGdhcD17NH0+XG4gICAgICAgICAgICB7LyogTGVmdCBwYW5lbDogdmVydGljYWwgb3B0aW9uIGxpc3QgKi99XG4gICAgICAgICAgICA8Qm94IGZsZXhEaXJlY3Rpb249XCJjb2x1bW5cIiB3aWR0aD17MzB9PlxuICAgICAgICAgICAgICB7YWxsT3B0aW9ucy5tYXAoKG9wdGlvbiwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBpc0ZvY3VzZWQgPSBmb2N1c2VkSW5kZXggPT09IGluZGV4XG4gICAgICAgICAgICAgICAgY29uc3QgaXNTZWxlY3RlZCA9IHNlbGVjdGVkVmFsdWUgPT09IG9wdGlvbi5sYWJlbFxuXG4gICAgICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgICAgIDxCb3gga2V5PXtvcHRpb24ubGFiZWx9IGZsZXhEaXJlY3Rpb249XCJyb3dcIj5cbiAgICAgICAgICAgICAgICAgICAge2lzRm9jdXNlZCA/IChcbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dCBjb2xvcj1cInN1Z2dlc3Rpb25cIj57ZmlndXJlcy5wb2ludGVyfTwvVGV4dD5cbiAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICA8VGV4dD4gPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA8VGV4dCBkaW1Db2xvcj4ge2luZGV4ICsgMX0uPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgICAgIGNvbG9yPXtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlzU2VsZWN0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPyAnc3VjY2VzcydcbiAgICAgICAgICAgICAgICAgICAgICAgICAgOiBpc0ZvY3VzZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICdzdWdnZXN0aW9uJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGJvbGQ9e2lzRm9jdXNlZH1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIHsnICd9XG4gICAgICAgICAgICAgICAgICAgICAge29wdGlvbi5sYWJlbH1cbiAgICAgICAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgICAgICAgICB7aXNTZWxlY3RlZCAmJiA8VGV4dCBjb2xvcj1cInN1Y2Nlc3NcIj4ge2ZpZ3VyZXMudGlja308L1RleHQ+fVxuICAgICAgICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICB9KX1cbiAgICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAgICB7LyogUmlnaHQgcGFuZWw6IHByZXZpZXcgKyBub3RlcyAqL31cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIGZsZXhHcm93PXsxfT5cbiAgICAgICAgICAgICAgPFByZXZpZXdCb3hcbiAgICAgICAgICAgICAgICBjb250ZW50PXtwcmV2aWV3Q29udGVudCB8fCAnTm8gcHJldmlldyBhdmFpbGFibGUnfVxuICAgICAgICAgICAgICAgIG1heExpbmVzPXtwcmV2aWV3TWF4TGluZXN9XG4gICAgICAgICAgICAgICAgbWluV2lkdGg9e21pbkNvbnRlbnRXaWR0aH1cbiAgICAgICAgICAgICAgICBtYXhXaWR0aD17cHJldmlld01heFdpZHRofVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0gZmxleERpcmVjdGlvbj1cInJvd1wiIGdhcD17MX0+XG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+Tm90ZXM6PC9UZXh0PlxuICAgICAgICAgICAgICAgIHtpc0luTm90ZXNJbnB1dCA/IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0SW5wdXRcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e25vdGVzVmFsdWV9XG4gICAgICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiQWRkIG5vdGVzIG9uIHRoaXMgZGVzaWdu4oCmXCJcbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9e3ZhbHVlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICBvblVwZGF0ZVF1ZXN0aW9uU3RhdGUoXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVzdGlvblRleHQsXG4gICAgICAgICAgICAgICAgICAgICAgICB7IHRleHRJbnB1dFZhbHVlOiB2YWx1ZSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZmFsc2UsXG4gICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICBvblN1Ym1pdD17aGFuZGxlTm90ZXNFeGl0fVxuICAgICAgICAgICAgICAgICAgICBvbkV4aXQ9e2hhbmRsZU5vdGVzRXhpdH1cbiAgICAgICAgICAgICAgICAgICAgZm9jdXM9e3RydWV9XG4gICAgICAgICAgICAgICAgICAgIHNob3dDdXJzb3I9e3RydWV9XG4gICAgICAgICAgICAgICAgICAgIGNvbHVtbnM9ezYwfVxuICAgICAgICAgICAgICAgICAgICBjdXJzb3JPZmZzZXQ9e2N1cnNvck9mZnNldH1cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2VDdXJzb3JPZmZzZXQ9e3NldEN1cnNvck9mZnNldH1cbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0IGRpbUNvbG9yIGl0YWxpYz5cbiAgICAgICAgICAgICAgICAgICAge25vdGVzVmFsdWUgfHwgJ3ByZXNzIG4gdG8gYWRkIG5vdGVzJ31cbiAgICAgICAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L0JveD5cbiAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgIDwvQm94PlxuXG4gICAgICAgICAgey8qIEZvb3RlciBzZWN0aW9uICovfVxuICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cImNvbHVtblwiIG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8RGl2aWRlciBjb2xvcj1cImluYWN0aXZlXCIgLz5cbiAgICAgICAgICAgIDxCb3ggZmxleERpcmVjdGlvbj1cInJvd1wiIGdhcD17MX0+XG4gICAgICAgICAgICAgIHtpc0Zvb3RlckZvY3VzZWQgJiYgZm9vdGVySW5kZXggPT09IDAgPyAoXG4gICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2ZpZ3VyZXMucG9pbnRlcn08L1RleHQ+XG4gICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgPFRleHQ+IDwvVGV4dD5cbiAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPFRleHRcbiAgICAgICAgICAgICAgICBjb2xvcj17XG4gICAgICAgICAgICAgICAgICBpc0Zvb3RlckZvY3VzZWQgJiYgZm9vdGVySW5kZXggPT09IDBcbiAgICAgICAgICAgICAgICAgICAgPyAnc3VnZ2VzdGlvbidcbiAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICBDaGF0IGFib3V0IHRoaXNcbiAgICAgICAgICAgICAgPC9UZXh0PlxuICAgICAgICAgICAgPC9Cb3g+XG4gICAgICAgICAgICB7aXNJblBsYW5Nb2RlICYmIChcbiAgICAgICAgICAgICAgPEJveCBmbGV4RGlyZWN0aW9uPVwicm93XCIgZ2FwPXsxfT5cbiAgICAgICAgICAgICAgICB7aXNGb290ZXJGb2N1c2VkICYmIGZvb3RlckluZGV4ID09PSAxID8gKFxuICAgICAgICAgICAgICAgICAgPFRleHQgY29sb3I9XCJzdWdnZXN0aW9uXCI+e2ZpZ3VyZXMucG9pbnRlcn08L1RleHQ+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxUZXh0PiA8L1RleHQ+XG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICA8VGV4dFxuICAgICAgICAgICAgICAgICAgY29sb3I9e1xuICAgICAgICAgICAgICAgICAgICBpc0Zvb3RlckZvY3VzZWQgJiYgZm9vdGVySW5kZXggPT09IDFcbiAgICAgICAgICAgICAgICAgICAgICA/ICdzdWdnZXN0aW9uJ1xuICAgICAgICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgU2tpcCBpbnRlcnZpZXcgYW5kIHBsYW4gaW1tZWRpYXRlbHlcbiAgICAgICAgICAgICAgICA8L1RleHQ+XG4gICAgICAgICAgICAgIDwvQm94PlxuICAgICAgICAgICAgKX1cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgICA8Qm94IG1hcmdpblRvcD17MX0+XG4gICAgICAgICAgICA8VGV4dCBjb2xvcj1cImluYWN0aXZlXCIgZGltQ29sb3I+XG4gICAgICAgICAgICAgIEVudGVyIHRvIHNlbGVjdCDCtyB7ZmlndXJlcy5hcnJvd1VwfS97ZmlndXJlcy5hcnJvd0Rvd259IHRvXG4gICAgICAgICAgICAgIG5hdmlnYXRlIMK3IG4gdG8gYWRkIG5vdGVzXG4gICAgICAgICAgICAgIHtxdWVzdGlvbnMubGVuZ3RoID4gMSAmJiA8PiDCtyBUYWIgdG8gc3dpdGNoIHF1ZXN0aW9uczwvPn1cbiAgICAgICAgICAgICAge2lzSW5Ob3Rlc0lucHV0ICYmIGVkaXRvck5hbWUgJiYgKFxuICAgICAgICAgICAgICAgIDw+IMK3IGN0cmwrZyB0byBlZGl0IGluIHtlZGl0b3JOYW1lfTwvPlxuICAgICAgICAgICAgICApfXsnICd9XG4gICAgICAgICAgICAgIMK3IEVzYyB0byBjYW5jZWxcbiAgICAgICAgICAgIDwvVGV4dD5cbiAgICAgICAgICA8L0JveD5cbiAgICAgICAgPC9Cb3g+XG4gICAgICA8L0JveD5cbiAgICA8L0JveD5cbiAgKVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPQSxPQUFPLE1BQU0sU0FBUztBQUM3QixPQUFPQyxLQUFLLElBQUlDLFdBQVcsRUFBRUMsT0FBTyxFQUFFQyxNQUFNLEVBQUVDLFFBQVEsUUFBUSxPQUFPO0FBQ3JFLFNBQVNDLGVBQWUsUUFBUSxtQ0FBbUM7QUFDbkUsY0FBY0MsYUFBYSxRQUFRLHVDQUF1QztBQUMxRSxTQUFTQyxHQUFHLEVBQUVDLElBQUksUUFBUSxpQkFBaUI7QUFDM0MsU0FDRUMsYUFBYSxFQUNiQyxjQUFjLFFBQ1QsdUNBQXVDO0FBQzlDLFNBQVNDLFdBQVcsUUFBUSw0QkFBNEI7QUFDeEQsY0FBY0MsUUFBUSxRQUFRLDJEQUEyRDtBQUN6RixTQUFTQyxpQkFBaUIsUUFBUSwwQkFBMEI7QUFDNUQsU0FBU0MsZ0JBQWdCLFFBQVEsdUJBQXVCO0FBQ3hELFNBQVNDLGtCQUFrQixRQUFRLGdDQUFnQztBQUNuRSxTQUFTQyxPQUFPLFFBQVEsZ0NBQWdDO0FBQ3hELE9BQU9DLFNBQVMsTUFBTSxvQkFBb0I7QUFDMUMsU0FBU0Msc0JBQXNCLFFBQVEs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