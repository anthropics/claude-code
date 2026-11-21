import { useEffect, useState } from 'react'
import type { PastedContent } from 'src/utils/config.js'
import { maybeTruncateInput } from './inputPaste.js'

type Props = {
  input: string
  pastedContents: Record<number, PastedContent>
  onInputChange: (input: string) => void
  setCursorOffset: (offset: number) => void
  setPastedContents: (contents: Record<number, PastedContent>) => void
}

export function useMaybeTruncateInput({
  input,
  pastedContents,
  onInputChange,
  setCursorOffset,
  setPastedContents,
}: Props) {
  // Track if we've initialized this specific input value
  const [hasAppliedTruncationToInput, setHasAppliedTruncationToInput] =
    useState(false)

  // Process input for truncation and pasted images from MessageSelector.
  useEffect(() => {
    if (hasAppliedTruncationToInput) {
      return
    }

    if (input.length <= 10_000) {
      return
    }

    const { newInput, newPastedContents } = maybeTruncateInput(
      input,
      pastedContents,
    )

    onInputChange(newInput)
    setCursorOffset(newInput.length)
    setPastedContents(newPastedContents)
    setHasAppliedTruncationToInput(true)
  }, [
    input,
    hasAppliedTruncationToInput,
    pastedContents,
    onInputChange,
    setPastedContents,
    setCursorOffset,
  ])

  // Reset hasInitializedInput when input is cleared (e.g., after submission)
  useEffect(() => {
    if (input === '') {
      setHasAppliedTruncationToInput(false)
    }
  }, [input])
}
