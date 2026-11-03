import type { Pressable } from '../pressable'

/**
 * A plain Button's face, press and address: a list row's Button, dim at
 * rest where the built-in's is, the focus ring's start where selected.
 */
export type KeyedPressable = Pressable & {
  key: string
  isDim: boolean
  isAutoFocus: boolean
}
