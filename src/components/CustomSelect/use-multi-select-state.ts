import { useCallback, useState } from 'react'
import { isDeepStrictEqual } from 'util'
import { useRegisterOverlay } from '../../context/overlayContext.js'
import type { InputEvent } from '../../ink/events/input-event.js'
// eslint-disable-next-line custom-rules/prefer-use-keybindings -- raw space/arrow multiselect input
import { useInput } from '../../ink.js'
import {
  normalizeFullWidthDigits,
  normalizeFullWidthSpace,
} from '../../utils/stringUtils.js'
import type { OptionWithDescription } from './select.js'
import { useSelectNavigation } from './use-select-navigation.js'

export type UseMultiSelectStateProps<T> = {
  /**
   * When disabled, user input is ignored.
   *
   * @default false
   */
  isDisabled?: boolean

  /**
   * Number of items to display.
   *
   * @default 5
   */
  visibleOptionCount?: number

  /**
   * Options.
   */
  options: OptionWithDescription<T>[]

  /**
   * Initially selected values.
   */
  defaultValue?: T[]

  /**
   * Callback when selection changes.
   */
  onChange?: (values: T[]) => void

  /**
   * Callback for canceling the select.
   */
  onCancel: () => void

  /**
   * Callback for focusing an option.
   */
  onFocus?: (value: T) => void

  /**
   * Value to focus
   */
  focusValue?: T

  /**
   * Text for the submit button. When provided, a submit button is shown and
   * Enter toggles selection (submit only fires when the button is focused).
   * When omitted, Enter submits directly and Space toggles selection.
   */
  submitButtonText?: string

  /**
   * Callback when user submits. Receives the currently selected values.
   */
  onSubmit?: (values: T[]) => void

  /**
   * Callback when user presses down from the last item (submit button).
   * If provided, navigation will not wrap to the first item.
   */
  onDownFromLastItem?: () => void

  /**
   * Callback when user presses up from the first item.
   * If provided, navigation will not wrap to the last item.
   */
  onUpFromFirstItem?: () => void

  /**
   * Focus the last option initially instead of the first.
   */
  initialFocusLast?: boolean

  /**
   * When true, numeric keys (1-9) do not toggle options by index.
   * Mirrors the rendering layer's hideIndexes: if index labels aren't shown,
   * pressing a number shouldn't silently toggle an invisible mapping.
   */
  hideIndexes?: boolean
}

export type MultiSelectState<T> = {
  /**
   * Value of the currently focused option.
   */
  focusedValue: T | undefined

  /**
   * Index of the first visible option.
   */
  visibleFromIndex: number

  /**
   * Index of the last visible option.
   */
  visibleToIndex: number

  /**
   * All options.
   */
  options: OptionWithDescription<T>[]

  /**
   * Visible options.
   */
  visibleOptions: Array<OptionWithDescription<T> & { index: number }>

  /**
   * Whether the focused option is an input type.
   */
  isInInput: boolean

  /**
   * Currently selected values.
   */
  selectedValues: T[]

  /**
   * Current input field values.
   */
  inputValues: Map<T, string>

  /**
   * Whether the submit button is focused.
   */
  isSubmitFocused: boolean

  /**
   * Update an input field value.
   */
  updateInputValue: (value: T, inputValue: string) => void

  /**
   * Callback for canceling the select.
   */
  onCancel: () => void
}

export function useMultiSelectState<T>({
  isDisabled = false,
  visibleOptionCount = 5,
  options,
  defaultValue = [],
  onChange,
  onCancel,
  onFocus,
  focusValue,
  submitButtonText,
  onSubmit,
  onDownFromLastItem,
  onUpFromFirstItem,
  initialFocusLast,
  hideIndexes = false,
}: UseMultiSelectStateProps<T>): MultiSelectState<T> {
  const [selectedValues, setSelectedValues] = useState<T[]>(defaultValue)
  const [isSubmitFocused, setIsSubmitFocused] = useState(false)

  // Reset selectedValues when options change (e.g. async-loaded data changes
  // defaultValue after mount). Mirrors the reset pattern in use-select-navigation.ts
  // and the deleted ui/useMultiSelectState.ts — without this, MCPServerDesktopImportDialog
  // keeps colliding servers checked after getAllMcpConfigs() resolves.
  const [lastOptions, setLastOptions] = useState(options)
  if (options !== lastOptions && !isDeepStrictEqual(options, lastOptions)) {
    setSelectedValues(defaultValue)
    setLastOptions(options)
  }

  // State for input type options
  const [inputValues, setInputValues] = useState<Map<T, string>>(() => {
    const initialMap = new Map<T, string>()
    options.forEach(option => {
      if (option.type === 'input' && option.initialValue) {
        initialMap.set(option.value, option.initialValue)
      }
    })
    return initialMap
  })

  const updateSelectedValues = useCallback(
    (values: T[] | ((prev: T[]) => T[])) => {
      const newValues =
        typeof values === 'function' ? values(selectedValues) : values
      setSelectedValues(newValues)
      onChange?.(newValues)
    },
    [selectedValues, onChange],
  )

  const navigation = useSelectNavigation<T>({
    visibleOptionCount,
    options,
    initialFocusValue: initialFocusLast
      ? options[options.length - 1]?.value
      : undefined,
    onFocus,
    focusValue,
  })

  // Automatically register as an overlay.
  // This ensures CancelRequestHandler won't intercept Escape when the multi-select is active.
  useRegisterOverlay('multi-select')

  const updateInputValue = useCallback(
    (value: T, inputValue: string) => {
      setInputValues(prev => {
        const next = new Map(prev)
        next.set(value, inputValue)
        return next
      })

      // Find the option and call its onChange
      const option = options.find(opt => opt.value === value)
      if (option && option.type === 'input') {
        option.onChange(inputValue)
      }

      // Update selected values to include/exclude based on input
      updateSelectedValues(prev => {
        if (inputValue) {
          if (!prev.includes(value)) {
            return [...prev, value]
          }
          return prev
        } else {
          return prev.filter(v => v !== value)
        }
      })
    },
    [options, updateSelectedValues],
  )

  // Handle all keyboard input
  useInput(
    (input, key, event: InputEvent) => {
      const normalizedInput = normalizeFullWidthDigits(input)
      const focusedOption = options.find(
        opt => opt.value === navigation.focusedValue,
      )
      const isInInput = focusedOption?.type === 'input'

      // When in input field, only allow navigation keys
      if (isInInput) {
        const isAllowedKey =
          key.upArrow ||
          key.downArrow ||
          key.escape ||
          key.tab ||
          key.return ||
          (key.ctrl && (input === 'n' || input === 'p' || key.return))
        if (!isAllowedKey) return
      }

      const lastOptionValue = options[options.length - 1]?.value

      // Handle Tab to move forward
      if (key.tab && !key.shift) {
        if (
          submitButtonText &&
          onSubmit &&
          navigation.focusedValue === lastOptionValue &&
          !isSubmitFocused
        ) {
          setIsSubmitFocused(true)
        } else if (!isSubmitFocused) {
          navigation.focusNextOption()
        }
        return
      }

      // Handle Shift+Tab to move backward
      if (key.tab && key.shift) {
        if (submitButtonText && onSubmit && isSubmitFocused) {
          setIsSubmitFocused(false)
          navigation.focusOption(lastOptionValue)
        } else {
          navigation.focusPreviousOption()
        }
        return
      }

      // Handle arrow down / Ctrl+N / j
      if (
        key.downArrow ||
        (key.ctrl && input === 'n') ||
        (!key.ctrl && !key.shift && input === 'j')
      ) {
        if (isSubmitFocused && onDownFromLastItem) {
          onDownFromLastItem()
        } else if (
          submitButtonText &&
          onSubmit &&
          navigation.focusedValue === lastOptionValue &&
          !isSubmitFocused
        ) {
          setIsSubmitFocused(true)
        } else if (
          !submitButtonText &&
          onDownFromLastItem &&
          navigation.focusedValue === lastOptionValue
        ) {
          // No submit button — exit from the last option
          onDownFromLastItem()
        } else if (!isSubmitFocused) {
          navigation.focusNextOption()
        }
        return
      }

      // Handle arrow up / Ctrl+P / k
      if (
        key.upArrow ||
        (key.ctrl && input === 'p') ||
        (!key.ctrl && !key.shift && input === 'k')
      ) {
        if (submitButtonText && onSubmit && isSubmitFocused) {
          setIsSubmitFocused(false)
          navigation.focusOption(lastOptionValue)
        } else if (
          onUpFromFirstItem &&
          navigation.focusedValue === options[0]?.value
        ) {
          onUpFromFirstItem()
        } else {
          navigation.focusPreviousOption()
        }
        return
      }

      // Handle page navigation
      if (key.pageDown) {
        navigation.focusNextPage()
        return
      }

      if (key.pageUp) {
        navigation.focusPreviousPage()
        return
      }

      // Handle Enter or Space for selection/submit
      if (key.return || normalizeFullWidthSpace(input) === ' ') {
        // Ctrl+Enter from input field submits
        if (key.ctrl && key.return && isInInput && onSubmit) {
          onSubmit(selectedValues)
          return
        }

        // Enter on submit button submits
        if (isSubmitFocused && onSubmit) {
          onSubmit(selectedValues)
          return
        }

        // No submit button: Enter submits directly, Space still toggles
        if (key.return && !submitButtonText && onSubmit) {
          onSubmit(selectedValues)
          return
        }

        // Enter or Space toggles selection (including for input fields)
        if (navigation.focusedValue !== undefined) {
          const newValues = selectedValues.includes(navigation.focusedValue)
            ? selectedValues.filter(v => v !== navigation.focusedValue)
            : [...selectedValues, navigation.focusedValue]
          updateSelectedValues(newValues)
        }
        return
      }

      // Handle numeric keys (1-9) for direct selection
      if (!hideIndexes && /^[0-9]+$/.test(normalizedInput)) {
        const index = parseInt(normalizedInput) - 1
        if (index >= 0 && index < options.length) {
          const value = options[index]!.value
          const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value]
          updateSelectedValues(newValues)
        }
        return
      }

      // Handle Escape
      if (key.escape) {
        onCancel()
        event.stopImmediatePropagation()
      }
    },
    { isActive: !isDisabled },
  )

  return {
    ...navigation,
    selectedValues,
    inputValues,
    isSubmitFocused,
    updateInputValue,
    onCancel,
  }
}
