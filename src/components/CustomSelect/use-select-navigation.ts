import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { isDeepStrictEqual } from 'util'
import OptionMap from './option-map.js'
import type { OptionWithDescription } from './select.js'

type State<T> = {
  /**
   * Map where key is option's value and value is option's index.
   */
  optionMap: OptionMap<T>

  /**
   * Number of visible options.
   */
  visibleOptionCount: number

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
}

type Action<T> =
  | FocusNextOptionAction
  | FocusPreviousOptionAction
  | FocusNextPageAction
  | FocusPreviousPageAction
  | SetFocusAction<T>
  | ResetAction<T>

type SetFocusAction<T> = {
  type: 'set-focus'
  value: T
}

type FocusNextOptionAction = {
  type: 'focus-next-option'
}

type FocusPreviousOptionAction = {
  type: 'focus-previous-option'
}

type FocusNextPageAction = {
  type: 'focus-next-page'
}

type FocusPreviousPageAction = {
  type: 'focus-previous-page'
}

type ResetAction<T> = {
  type: 'reset'
  state: State<T>
}

const reducer = <T>(state: State<T>, action: Action<T>): State<T> => {
  switch (action.type) {
    case 'focus-next-option': {
      if (state.focusedValue === undefined) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      // Wrap to first item if at the end
      const next = item.next || state.optionMap.first

      if (!next) {
        return state
      }

      // When wrapping to first, reset viewport to start
      if (!item.next && next === state.optionMap.first) {
        return {
          ...state,
          focusedValue: next.value,
          visibleFromIndex: 0,
          visibleToIndex: state.visibleOptionCount,
        }
      }

      const needsToScroll = next.index >= state.visibleToIndex

      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: next.value,
        }
      }

      const nextVisibleToIndex = Math.min(
        state.optionMap.size,
        state.visibleToIndex + 1,
      )

      const nextVisibleFromIndex = nextVisibleToIndex - state.visibleOptionCount

      return {
        ...state,
        focusedValue: next.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'focus-previous-option': {
      if (state.focusedValue === undefined) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      // Wrap to last item if at the beginning
      const previous = item.previous || state.optionMap.last

      if (!previous) {
        return state
      }

      // When wrapping to last, reset viewport to end
      if (!item.previous && previous === state.optionMap.last) {
        const nextVisibleToIndex = state.optionMap.size
        const nextVisibleFromIndex = Math.max(
          0,
          nextVisibleToIndex - state.visibleOptionCount,
        )
        return {
          ...state,
          focusedValue: previous.value,
          visibleFromIndex: nextVisibleFromIndex,
          visibleToIndex: nextVisibleToIndex,
        }
      }

      const needsToScroll = previous.index <= state.visibleFromIndex

      if (!needsToScroll) {
        return {
          ...state,
          focusedValue: previous.value,
        }
      }

      const nextVisibleFromIndex = Math.max(0, state.visibleFromIndex - 1)

      const nextVisibleToIndex = nextVisibleFromIndex + state.visibleOptionCount

      return {
        ...state,
        focusedValue: previous.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'focus-next-page': {
      if (state.focusedValue === undefined) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      // Move by a full page (visibleOptionCount items)
      const targetIndex = Math.min(
        state.optionMap.size - 1,
        item.index + state.visibleOptionCount,
      )

      // Find the item at the target index
      let targetItem = state.optionMap.first
      while (targetItem && targetItem.index < targetIndex) {
        if (targetItem.next) {
          targetItem = targetItem.next
        } else {
          break
        }
      }

      if (!targetItem) {
        return state
      }

      // Update the visible range to include the new focused item
      const nextVisibleToIndex = Math.min(
        state.optionMap.size,
        targetItem.index + 1,
      )
      const nextVisibleFromIndex = Math.max(
        0,
        nextVisibleToIndex - state.visibleOptionCount,
      )

      return {
        ...state,
        focusedValue: targetItem.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'focus-previous-page': {
      if (state.focusedValue === undefined) {
        return state
      }

      const item = state.optionMap.get(state.focusedValue)

      if (!item) {
        return state
      }

      // Move by a full page (visibleOptionCount items)
      const targetIndex = Math.max(0, item.index - state.visibleOptionCount)

      // Find the item at the target index
      let targetItem = state.optionMap.first
      while (targetItem && targetItem.index < targetIndex) {
        if (targetItem.next) {
          targetItem = targetItem.next
        } else {
          break
        }
      }

      if (!targetItem) {
        return state
      }

      // Update the visible range to include the new focused item
      const nextVisibleFromIndex = Math.max(0, targetItem.index)
      const nextVisibleToIndex = Math.min(
        state.optionMap.size,
        nextVisibleFromIndex + state.visibleOptionCount,
      )

      return {
        ...state,
        focusedValue: targetItem.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }

    case 'reset': {
      return action.state
    }

    case 'set-focus': {
      // Early return if already focused on this value
      if (state.focusedValue === action.value) {
        return state
      }

      const item = state.optionMap.get(action.value)
      if (!item) {
        return state
      }

      // Check if the item is already in view
      if (
        item.index >= state.visibleFromIndex &&
        item.index < state.visibleToIndex
      ) {
        // Already visible, just update focus
        return {
          ...state,
          focusedValue: action.value,
        }
      }

      // Need to scroll to make the item visible
      // Scroll as little as possible - put item at edge of viewport
      let nextVisibleFromIndex: number
      let nextVisibleToIndex: number

      if (item.index < state.visibleFromIndex) {
        // Item is above viewport - scroll up to put it at the top
        nextVisibleFromIndex = item.index
        nextVisibleToIndex = Math.min(
          state.optionMap.size,
          nextVisibleFromIndex + state.visibleOptionCount,
        )
      } else {
        // Item is below viewport - scroll down to put it at the bottom
        nextVisibleToIndex = Math.min(state.optionMap.size, item.index + 1)
        nextVisibleFromIndex = Math.max(
          0,
          nextVisibleToIndex - state.visibleOptionCount,
        )
      }

      return {
        ...state,
        focusedValue: action.value,
        visibleFromIndex: nextVisibleFromIndex,
        visibleToIndex: nextVisibleToIndex,
      }
    }
  }
}

export type UseSelectNavigationProps<T> = {
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
   * Initially focused option's value.
   */
  initialFocusValue?: T

  /**
   * Callback for focusing an option.
   */
  onFocus?: (value: T) => void

  /**
   * Value to focus
   */
  focusValue?: T
}

export type SelectNavigation<T> = {
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
}

const createDefaultState = <T>({
  visibleOptionCount: customVisibleOptionCount,
  options,
  initialFocusValue,
  currentViewport,
}: Pick<UseSelectNavigationProps<T>, 'visibleOptionCount' | 'options'> & {
  initialFocusValue?: T
  currentViewport?: { visibleFromIndex: number; visibleToIndex: number }
}): State<T> => {
  const visibleOptionCount =
    typeof customVisibleOptionCount === 'number'
      ? Math.min(customVisibleOptionCount, options.length)
      : options.length

  const optionMap = new OptionMap<T>(options)
  const focusedItem =
    initialFocusValue !== undefined && optionMap.get(initialFocusValue)
  const focusedValue = focusedItem ? initialFocusValue : optionMap.first?.value

  let visibleFromIndex = 0
  let visibleToIndex = visibleOptionCount

  // When there's a valid focused item, adjust viewport to show it
  if (focusedItem) {
    const focusedIndex = focusedItem.index

    if (currentViewport) {
      // If focused item is already in the current viewport range, try to preserve it
      if (
        focusedIndex >= currentViewport.visibleFromIndex &&
        focusedIndex < currentViewport.visibleToIndex
      ) {
        // Keep the same viewport if it's valid
        visibleFromIndex = currentViewport.visibleFromIndex
        visibleToIndex = Math.min(
          optionMap.size,
          currentViewport.visibleToIndex,
        )
      } else {
        // Need to adjust viewport to show focused item
        // Use minimal scrolling - put item at edge of viewport
        if (focusedIndex < currentViewport.visibleFromIndex) {
          // Item is above current viewport - scroll up to put it at the top
          visibleFromIndex = focusedIndex
          visibleToIndex = Math.min(
            optionMap.size,
            visibleFromIndex + visibleOptionCount,
          )
        } else {
          // Item is below current viewport - scroll down to put it at the bottom
          visibleToIndex = Math.min(optionMap.size, focusedIndex + 1)
          visibleFromIndex = Math.max(0, visibleToIndex - visibleOptionCount)
        }
      }
    } else if (focusedIndex >= visibleOptionCount) {
      // No current viewport but focused item is outside default viewport
      // Scroll to show the focused item at the bottom of the viewport
      visibleToIndex = Math.min(optionMap.size, focusedIndex + 1)
      visibleFromIndex = Math.max(0, visibleToIndex - visibleOptionCount)
    }

    // Ensure viewport bounds are valid
    visibleFromIndex = Math.max(
      0,
      Math.min(visibleFromIndex, optionMap.size - 1),
    )
    visibleToIndex = Math.min(
      optionMap.size,
      Math.max(visibleOptionCount, visibleToIndex),
    )
  }

  return {
    optionMap,
    visibleOptionCount,
    focusedValue,
    visibleFromIndex,
    visibleToIndex,
  }
}

export function useSelectNavigation<T>({
  visibleOptionCount = 5,
  options,
  initialFocusValue,
  onFocus,
  focusValue,
}: UseSelectNavigationProps<T>): SelectNavigation<T> {
  const [state, dispatch] = useReducer(
    reducer<T>,
    {
      visibleOptionCount,
      options,
      initialFocusValue: focusValue || initialFocusValue,
    } as Parameters<typeof createDefaultState<T>>[0],
    createDefaultState<T>,
  )

  // Store onFocus in a ref to avoid re-running useEffect when callback changes
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  const [lastOptions, setLastOptions] = useState(options)

  if (options !== lastOptions && !isDeepStrictEqual(options, lastOptions)) {
    dispatch({
      type: 'reset',
      state: createDefaultState({
        visibleOptionCount,
        options,
        initialFocusValue:
          focusValue ?? state.focusedValue ?? initialFocusValue,
        currentViewport: {
          visibleFromIndex: state.visibleFromIndex,
          visibleToIndex: state.visibleToIndex,
        },
      }),
    })

    setLastOptions(options)
  }

  const focusNextOption = useCallback(() => {
    dispatch({
      type: 'focus-next-option',
    })
  }, [])

  const focusPreviousOption = useCallback(() => {
    dispatch({
      type: 'focus-previous-option',
    })
  }, [])

  const focusNextPage = useCallback(() => {
    dispatch({
      type: 'focus-next-page',
    })
  }, [])

  const focusPreviousPage = useCallback(() => {
    dispatch({
      type: 'focus-previous-page',
    })
  }, [])

  const focusOption = useCallback((value: T | undefined) => {
    if (value !== undefined) {
      dispatch({
        type: 'set-focus',
        value,
      })
    }
  }, [])

  const visibleOptions = useMemo(() => {
    return options
      .map((option, index) => ({
        ...option,
        index,
      }))
      .slice(state.visibleFromIndex, state.visibleToIndex)
  }, [options, state.visibleFromIndex, state.visibleToIndex])

  // Validate that focusedValue exists in current options.
  // This handles the case where options change during render but the reset
  // action hasn't been processed yet - without this, the cursor would disappear
  // because focusedValue points to an option that no longer exists.
  const validatedFocusedValue = useMemo(() => {
    if (state.focusedValue === undefined) {
      return undefined
    }
    const exists = options.some(opt => opt.value === state.focusedValue)
    if (exists) {
      return state.focusedValue
    }
    // Fall back to first option if focused value doesn't exist
    return options[0]?.value
  }, [state.focusedValue, options])

  const isInInput = useMemo(() => {
    const focusedOption = options.find(
      opt => opt.value === validatedFocusedValue,
    )
    return focusedOption?.type === 'input'
  }, [validatedFocusedValue, options])

  // Call onFocus with the validated value (what's actually displayed),
  // not the internal state value which may be stale if options changed.
  // Use ref to avoid re-running when callback reference changes.
  useEffect(() => {
    if (validatedFocusedValue !== undefined) {
      onFocusRef.current?.(validatedFocusedValue)
    }
  }, [validatedFocusedValue])

  // Allow parent to programmatically set focus via focusValue prop
  useEffect(() => {
    if (focusValue !== undefined) {
      dispatch({
        type: 'set-focus',
        value: focusValue,
      })
    }
  }, [focusValue])

  // Compute 1-based focused index for scroll position display
  const focusedIndex = useMemo(() => {
    if (validatedFocusedValue === undefined) {
      return 0
    }
    const index = options.findIndex(opt => opt.value === validatedFocusedValue)
    return index >= 0 ? index + 1 : 0
  }, [validatedFocusedValue, options])

  return {
    focusedValue: validatedFocusedValue,
    focusedIndex,
    visibleFromIndex: state.visibleFromIndex,
    visibleToIndex: state.visibleToIndex,
    visibleOptions,
    isInInput: isInInput ?? false,
    focusNextOption,
    focusPreviousOption,
    focusNextPage,
    focusPreviousPage,
    focusOption,
    options,
  }
}
