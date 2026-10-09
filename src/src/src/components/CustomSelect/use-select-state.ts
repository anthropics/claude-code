import { useCallback, useState } from 'react'
import type { OptionWithDescription } from './select.js'
import { useSelectNavigation } from './use-select-navigation.js'

export type UseSelectStateProps<T> = {
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
   * Initially selected option's value.
   */
  defaultValue?: T

  /**
   * Callback for selecting an option.
   */
  onChange?: (value: T) => void

  /**
   * Callback for canceling the select.
   */
  onCancel?: () => void

  /**
   * Callback for focusing an option.
   */
  onFocus?: (value: T) => void

  /**
   * Value to focus
   */
  focusValue?: T
}

export type SelectState<T> = {
  /**
   * Value of the currently focused option.
   */
  focusedValue: T | undefined

  /**
   * 1-based index of the focused option in the full list.
   * Returns 0 if no option is focused.
   */
  focusedIndex: number

  /**
   * Index of the first visible option.
   */
  visibleFromIndex: number

  /**
   * Index of the last visible option.
   */
  visibleToIndex: number

  /**
   * Value of the selected option.
   */
  value: T | undefined

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
   * Focus next option and scroll the list down, if needed.
   */
  focusNextOption: () => void

  /**
   * Focus previous option and scroll the list up, if needed.
   */
  focusPreviousOption: () => void

  /**
   * Focus next page and scroll the list down by a page.
   */
  focusNextPage: () => void

  /**
   * Focus previous page and scroll the list up by a page.
   */
  focusPreviousPage: () => void

  /**
   * Focus a specific option by value.
   */
  focusOption: (value: T | undefined) => void

  /**
   * Select currently focused option.
   */
  selectFocusedOption: () => void

  /**
   * Callback for selecting an option.
   */
  onChange?: (value: T) => void

  /**
   * Callback for canceling the select.
   */
  onCancel?: () => void
}

export function useSelectState<T>({
  visibleOptionCount = 5,
  options,
  defaultValue,
  onChange,
  onCancel,
  onFocus,
  focusValue,
}: UseSelectStateProps<T>): SelectState<T> {
  const [value, setValue] = useState<T | undefined>(defaultValue)

  const navigation = useSelectNavigation<T>({
    visibleOptionCount,
    options,
    initialFocusValue: undefined,
    onFocus,
    focusValue,
  })

  const selectFocusedOption = useCallback(() => {
    setValue(navigation.focusedValue)
  }, [navigation.focusedValue])

  return {
    ...navigation,
    value,
    selectFocusedOption,
    onChange,
    onCancel,
  }
}
