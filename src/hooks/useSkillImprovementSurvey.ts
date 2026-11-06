import { useCallback, useRef, useState } from 'react'
import type { FeedbackSurveyResponse } from '../components/FeedbackSurvey/utils.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
  logEvent,
} from '../services/analytics/index.js'
import { useAppState, useSetAppState } from '../state/AppState.js'
import type { Message } from '../types/message.js'
import type { SkillUpdate } from '../utils/hooks/skillImprovement.js'
import { applySkillImprovement } from '../utils/hooks/skillImprovement.js'
import { createSystemMessage } from '../utils/messages.js'

type SkillImprovementSuggestion = {
  skillName: string
  updates: SkillUpdate[]
}

type SetMessages = (fn: (prev: Message[]) => Message[]) => void

export function useSkillImprovementSurvey(setMessages: SetMessages): {
  isOpen: boolean
  suggestion: SkillImprovementSuggestion | null
  handleSelect: (selected: FeedbackSurveyResponse) => void
} {
  const suggestion = useAppState(s => s.skillImprovement.suggestion)
  const setAppState = useSetAppState()
  const [isOpen, setIsOpen] = useState(false)
  const lastSuggestionRef = useRef(suggestion)
  const loggedAppearanceRef = useRef(false)

  // Track the suggestion for display even after clearing AppState
  if (suggestion) {
    lastSuggestionRef.current = suggestion
  }

  // Open when a new suggestion arrives
  if (suggestion && !isOpen) {
    setIsOpen(true)
    if (!loggedAppearanceRef.current) {
      loggedAppearanceRef.current = true
      logEvent('tengu_skill_improvement_survey', {
        event_type:
          'appeared' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        // _PROTO_skill_name routes to the privileged skill_name BQ column.
        // Unredacted names don't go in additional_metadata.
        _PROTO_skill_name: (suggestion.skillName ??
          'unknown') as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      })
    }
  }

  const handleSelect = useCallback(
    (selected: FeedbackSurveyResponse) => {
      const current = lastSuggestionRef.current
      if (!current) return

      const applied = selected !== 'dismissed'

      logEvent('tengu_skill_improvement_survey', {
        event_type:
          'responded' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        response: (applied
          ? 'applied'
          : 'dismissed') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        // _PROTO_skill_name routes to the privileged skill_name BQ column.
        // Unredacted names don't go in additional_metadata.
        _PROTO_skill_name:
          current.skillName as AnalyticsMetadata_I_VERIFIED_THIS_IS_PII_TAGGED,
      })

      if (applied) {
        void applySkillImprovement(current.skillName, current.updates).then(
          () => {
            setMessages(prev => [
              ...prev,
              createSystemMessage(
                `Skill "${current.skillName}" updated with improvements.`,
                'suggestion',
              ),
            ])
          },
        )
      }

      // Close and clear
      setIsOpen(false)
      loggedAppearanceRef.current = false
      setAppState(prev => {
        if (!prev.skillImprovement.suggestion) return prev
        return {
          ...prev,
          skillImprovement: { suggestion: null },
        }
      })
    },
    [setAppState, setMessages],
  )

  return {
    isOpen,
    suggestion: lastSuggestionRef.current,
    handleSelect,
  }
}
