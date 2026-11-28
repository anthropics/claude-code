import { useCallback, useReducer } from 'react'

export type AnswerValue = string

export type QuestionState = {
  selectedValue?: string | string[]
  textInputValue: string
}

type State = {
  currentQuestionIndex: number
  answers: Record<string, AnswerValue>
  questionStates: Record<string, QuestionState>
  isInTextInput: boolean
}

type Action =
  | { type: 'next-question' }
  | { type: 'prev-question' }
  | {
      type: 'update-question-state'
      questionText: string
      updates: Partial<QuestionState>
      isMultiSelect: boolean
    }
  | {
      type: 'set-answer'
      questionText: string
      answer: string
      shouldAdvance: boolean
    }
  | { type: 'set-text-input-mode'; isInInput: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'next-question':
      return {
        ...state,
        currentQuestionIndex: state.currentQuestionIndex + 1,
        isInTextInput: false,
      }

    case 'prev-question':
      return {
        ...state,
        currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1),
        isInTextInput: false,
      }

    case 'update-question-state': {
      const existing = state.questionStates[action.questionText]
      const newState: QuestionState = {
        selectedValue:
          action.updates.selectedValue ??
          existing?.selectedValue ??
          (action.isMultiSelect ? [] : undefined),
        textInputValue:
          action.updates.textInputValue ?? existing?.textInputValue ?? '',
      }

      return {
        ...state,
        questionStates: {
          ...state.questionStates,
          [action.questionText]: newState,
        },
      }
    }

    case 'set-answer': {
      const newState = {
        ...state,
        answers: {
          ...state.answers,
          [action.questionText]: action.answer,
        },
      }

      if (action.shouldAdvance) {
        return {
          ...newState,
          currentQuestionIndex: newState.currentQuestionIndex + 1,
          isInTextInput: false,
        }
      }

      return newState
    }

    case 'set-text-input-mode':
      return {
        ...state,
        isInTextInput: action.isInInput,
      }
  }
}

const INITIAL_STATE: State = {
  currentQuestionIndex: 0,
  answers: {},
  questionStates: {},
  isInTextInput: false,
}

export type MultipleChoiceState = {
  currentQuestionIndex: number
  answers: Record<string, AnswerValue>
  questionStates: Record<string, QuestionState>
  isInTextInput: boolean
  nextQuestion: () => void
  prevQuestion: () => void
  updateQuestionState: (
    questionText: string,
    updates: Partial<QuestionState>,
    isMultiSelect: boolean,
  ) => void
  setAnswer: (
    questionText: string,
    answer: string,
    shouldAdvance?: boolean,
  ) => void
  setTextInputMode: (isInInput: boolean) => void
}

export function useMultipleChoiceState(): MultipleChoiceState {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'next-question' })
  }, [])

  const prevQuestion = useCallback(() => {
    dispatch({ type: 'prev-question' })
  }, [])

  const updateQuestionState = useCallback(
    (
      questionText: string,
      updates: Partial<QuestionState>,
      isMultiSelect: boolean,
    ) => {
      dispatch({
        type: 'update-question-state',
        questionText,
        updates,
        isMultiSelect,
      })
    },
    [],
  )

  const setAnswer = useCallback(
    (questionText: string, answer: string, shouldAdvance: boolean = true) => {
      dispatch({
        type: 'set-answer',
        questionText,
        answer,
        shouldAdvance,
      })
    },
    [],
  )

  const setTextInputMode = useCallback((isInInput: boolean) => {
    dispatch({ type: 'set-text-input-mode', isInInput })
  }, [])

  return {
    currentQuestionIndex: state.currentQuestionIndex,
    answers: state.answers,
    questionStates: state.questionStates,
    isInTextInput: state.isInTextInput,
    nextQuestion,
    prevQuestion,
    updateQuestionState,
    setAnswer,
    setTextInputMode,
  }
}
