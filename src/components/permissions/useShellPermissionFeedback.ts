import { useState } from 'react'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import { sanitizeToolNameForAnalytics } from '../../services/analytics/metadata.js'
import { useSetAppState } from '../../state/AppState.js'
import type { ToolUseConfirm } from './PermissionRequest.js'
import { logUnaryPermissionEvent } from './utils.js'

/**
 * Shared feedback-mode state + handlers for shell permission dialogs (Bash,
 * PowerShell). Encapsulates the yes/no input-mode toggle, feedback text state,
 * focus tracking, and reject handling.
 */
export function useShellPermissionFeedback({
  toolUseConfirm,
  onDone,
  onReject,
  explainerVisible,
}: {
  toolUseConfirm: ToolUseConfirm
  onDone: () => void
  onReject: () => void
  explainerVisible: boolean
}): {
  yesInputMode: boolean
  noInputMode: boolean
  yesFeedbackModeEntered: boolean
  noFeedbackModeEntered: boolean
  acceptFeedback: string
  rejectFeedback: string
  setAcceptFeedback: (v: string) => void
  setRejectFeedback: (v: string) => void
  focusedOption: string
  handleInputModeToggle: (option: string) => void
  handleReject: (feedback?: string) => void
  handleFocus: (value: string) => void
} {
  const setAppState = useSetAppState()
  const [rejectFeedback, setRejectFeedback] = useState('')
  const [acceptFeedback, setAcceptFeedback] = useState('')
  const [yesInputMode, setYesInputMode] = useState(false)
  const [noInputMode, setNoInputMode] = useState(false)
  const [focusedOption, setFocusedOption] = useState('yes')
  // Track whether user ever entered feedback mode (persists after collapse)
  const [yesFeedbackModeEntered, setYesFeedbackModeEntered] = useState(false)
  const [noFeedbackModeEntered, setNoFeedbackModeEntered] = useState(false)

  // Handle Tab key toggling input mode for Yes/No options
  function handleInputModeToggle(option: string) {
    // Notify that user is interacting with the dialog
    toolUseConfirm.onUserInteraction()
    const analyticsProps = {
      toolName: sanitizeToolNameForAnalytics(
        toolUseConfirm.tool.name,
      ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      isMcp: toolUseConfirm.tool.isMcp ?? false,
    }

    if (option === 'yes') {
      if (yesInputMode) {
        setYesInputMode(false)
        logEvent('tengu_accept_feedback_mode_collapsed', analyticsProps)
      } else {
        setYesInputMode(true)
        setYesFeedbackModeEntered(true)
        logEvent('tengu_accept_feedback_mode_entered', analyticsProps)
      }
    } else if (option === 'no') {
      if (noInputMode) {
        setNoInputMode(false)
        logEvent('tengu_reject_feedback_mode_collapsed', analyticsProps)
      } else {
        setNoInputMode(true)
        setNoFeedbackModeEntered(true)
        logEvent('tengu_reject_feedback_mode_entered', analyticsProps)
      }
    }
  }

  function handleReject(feedback?: string) {
    const trimmedFeedback = feedback?.trim()
    const hasFeedback = !!trimmedFeedback

    // Log escape if no feedback was provided (user pressed ESC)
    if (!hasFeedback) {
      logEvent('tengu_permission_request_escape', {
        explainer_visible: explainerVisible,
      })
      // Increment escape count for attribution tracking
      setAppState(prev => ({
        ...prev,
        attribution: {
          ...prev.attribution,
          escapeCount: prev.attribution.escapeCount + 1,
        },
      }))
    }

    logUnaryPermissionEvent(
      'tool_use_single',
      toolUseConfirm,
      'reject',
      hasFeedback,
    )

    if (trimmedFeedback) {
      toolUseConfirm.onReject(trimmedFeedback)
    } else {
      toolUseConfirm.onReject()
    }

    onReject()
    onDone()
  }

  function handleFocus(value: string) {
    // Notify that user is interacting with the dialog (only if focus changed)
    // This prevents triggering on the initial mount/render
    if (value !== focusedOption) {
      toolUseConfirm.onUserInteraction()
    }
    // Reset input mode when navigating away, but only if no text typed
    if (value !== 'yes' && yesInputMode && !acceptFeedback.trim()) {
      setYesInputMode(false)
    }
    if (value !== 'no' && noInputMode && !rejectFeedback.trim()) {
      setNoInputMode(false)
    }
    setFocusedOption(value)
  }

  return {
    yesInputMode,
    noInputMode,
    yesFeedbackModeEntered,
    noFeedbackModeEntered,
    acceptFeedback,
    rejectFeedback,
    setAcceptFeedback,
    setRejectFeedback,
    focusedOption,
    handleInputModeToggle,
    handleReject,
    handleFocus,
  }
}
