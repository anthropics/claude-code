import { useCallback, useMemo, useState } from 'react'
import { useAppState } from 'src/state/AppState.js'
import { useKeybindings } from '../../../keybindings/useKeybinding.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../../services/analytics/index.js'
import { sanitizeToolNameForAnalytics } from '../../../services/analytics/metadata.js'
import type { PermissionUpdate } from '../../../utils/permissions/PermissionUpdateSchema.js'
import type { CompletionType } from '../../../utils/unaryLogging.js'
import type { ToolUseConfirm } from '../PermissionRequest.js'
import {
  type FileOperationType,
  getFilePermissionOptions,
  type PermissionOption,
  type PermissionOptionWithLabel,
} from './permissionOptions.js'
import {
  PERMISSION_HANDLERS,
  type PermissionHandlerParams,
} from './usePermissionHandler.js'

export interface ToolInput {
  [key: string]: unknown
}

export type UseFilePermissionDialogProps<T extends ToolInput> = {
  filePath: string
  completionType: CompletionType
  languageName: string | Promise<string>
  toolUseConfirm: ToolUseConfirm
  onDone: () => void
  onReject: () => void
  parseInput: (input: unknown) => T
  operationType?: FileOperationType
}

export type UseFilePermissionDialogResult<T> = {
  options: PermissionOptionWithLabel[]
  onChange: (option: PermissionOption, input: T, feedback?: string) => void
  acceptFeedback: string
  rejectFeedback: string
  focusedOption: string
  setFocusedOption: (option: string) => void
  handleInputModeToggle: (value: string) => void
  yesInputMode: boolean
  noInputMode: boolean
}

/**
 * Hook for handling file permission dialogs with common logic
 */
export function useFilePermissionDialog<T extends ToolInput>({
  filePath,
  completionType,
  languageName,
  toolUseConfirm,
  onDone,
  onReject,
  parseInput,
  operationType = 'write',
}: UseFilePermissionDialogProps<T>): UseFilePermissionDialogResult<T> {
  const toolPermissionContext = useAppState(s => s.toolPermissionContext)
  const [acceptFeedback, setAcceptFeedback] = useState('')
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [focusedOption, setFocusedOption] = useState('yes')
  const [yesInputMode, setYesInputMode] = useState(false)
  const [noInputMode, setNoInputMode] = useState(false)
  // Track whether user ever entered feedback mode (persists after collapse)
  const [yesFeedbackModeEntered, setYesFeedbackModeEntered] = useState(false)
  const [noFeedbackModeEntered, setNoFeedbackModeEntered] = useState(false)

  // Generate options based on context
  const options = useMemo(
    () =>
      getFilePermissionOptions({
        filePath,
        toolPermissionContext,
        operationType,
        onRejectFeedbackChange: setRejectFeedback,
        onAcceptFeedbackChange: setAcceptFeedback,
        yesInputMode,
        noInputMode,
      }),
    [filePath, toolPermissionContext, operationType, yesInputMode, noInputMode],
  )

  // Handle option selection using shared handlers
  const onChange = useCallback(
    (option: PermissionOption, input: T, feedback?: string) => {
      const params: PermissionHandlerParams = {
        messageId: toolUseConfirm.assistantMessage.message.id,
        path: filePath,
        toolUseConfirm,
        toolPermissionContext,
        onDone,
        onReject,
        completionType,
        languageName,
        operationType,
      }

      // Override the input in toolUseConfirm to pass the parsed input
      const originalOnAllow = toolUseConfirm.onAllow
      toolUseConfirm.onAllow = (
        _input: unknown,
        permissionUpdates: PermissionUpdate[],
        feedback?: string,
      ) => {
        originalOnAllow(input, permissionUpdates, feedback)
      }

      const handler = PERMISSION_HANDLERS[option.type]
      handler(params, {
        feedback,
        hasFeedback: !!feedback,
        enteredFeedbackMode:
          option.type === 'accept-once'
            ? yesFeedbackModeEntered
            : noFeedbackModeEntered,
        scope: option.type === 'accept-session' ? option.scope : undefined,
      })
    },
    [
      filePath,
      completionType,
      languageName,
      toolUseConfirm,
      toolPermissionContext,
      onDone,
      onReject,
      operationType,
      yesFeedbackModeEntered,
      noFeedbackModeEntered,
    ],
  )

  // Handler for confirm:cycleMode - select accept-session option
  const handleCycleMode = useCallback(() => {
    const sessionOption = options.find(o => o.option.type === 'accept-session')
    if (sessionOption) {
      const parsedInput = parseInput(toolUseConfirm.input)
      onChange(sessionOption.option, parsedInput)
    }
  }, [options, parseInput, toolUseConfirm.input, onChange])

  // Register keyboard shortcut handler via keybindings system
  useKeybindings(
    { 'confirm:cycleMode': handleCycleMode },
    { context: 'Confirmation' },
  )

  // Wrap setFocusedOption and reset input mode when navigating away
  const handleFocusedOptionChange = useCallback(
    (value: string) => {
      // Reset input mode when navigating away, but only if no text typed
      if (value !== 'yes' && yesInputMode && !acceptFeedback.trim()) {
        setYesInputMode(false)
      }
      if (value !== 'no' && noInputMode && !rejectFeedback.trim()) {
        setNoInputMode(false)
      }
      setFocusedOption(value)
    },
    [yesInputMode, noInputMode, acceptFeedback, rejectFeedback],
  )

  // Handle Tab key toggling input mode for Yes/No options
  const handleInputModeToggle = useCallback(
    (value: string) => {
      const analyticsProps = {
        toolName: sanitizeToolNameForAnalytics(
          toolUseConfirm.tool.name,
        ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        isMcp: toolUseConfirm.tool.isMcp ?? false,
      }

      if (value === 'yes') {
        if (yesInputMode) {
          setYesInputMode(false)
          logEvent('tengu_accept_feedback_mode_collapsed', analyticsProps)
        } else {
          setYesInputMode(true)
          setYesFeedbackModeEntered(true)
          logEvent('tengu_accept_feedback_mode_entered', analyticsProps)
        }
      } else if (value === 'no') {
        if (noInputMode) {
          setNoInputMode(false)
          logEvent('tengu_reject_feedback_mode_collapsed', analyticsProps)
        } else {
          setNoInputMode(true)
          setNoFeedbackModeEntered(true)
          logEvent('tengu_reject_feedback_mode_entered', analyticsProps)
        }
      }
    },
    [yesInputMode, noInputMode, toolUseConfirm],
  )

  return {
    options,
    onChange,
    acceptFeedback,
    rejectFeedback,
    focusedOption,
    setFocusedOption: handleFocusedOptionChange,
    handleInputModeToggle,
    yesInputMode,
    noInputMode,
  }
}
