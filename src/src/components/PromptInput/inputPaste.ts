import { getPastedTextRefNumLines } from 'src/history.js'
import type { PastedContent } from 'src/utils/config.js'

const TRUNCATION_THRESHOLD = 10000 // Characters before we truncate
const PREVIEW_LENGTH = 1000 // Characters to show at start and end

type TruncatedMessage = {
  truncatedText: string
  placeholderContent: string
}

/**
 * Determines whether the input text should be truncated. If so, it adds a
 * truncated text placeholder and neturns
 *
 * @param text The input text
 * @param nextPasteId The reference id to use
 * @returns The new text to display and separate placeholder content if applicable.
 */
export function maybeTruncateMessageForInput(
  text: string,
  nextPasteId: number,
): TruncatedMessage {
  // If the text is short enough, return it as-is
  if (text.length <= TRUNCATION_THRESHOLD) {
    return {
      truncatedText: text,
      placeholderContent: '',
    }
  }

  // Calculate how much text to keep from start and end
  const startLength = Math.floor(PREVIEW_LENGTH / 2)
  const endLength = Math.floor(PREVIEW_LENGTH / 2)

  // Extract the portions we'll keep
  const startText = text.slice(0, startLength)
  const endText = text.slice(-endLength)

  // Calculate the number of lines that will be truncated
  const placeholderContent = text.slice(startLength, -endLength)
  const truncatedLines = getPastedTextRefNumLines(placeholderContent)

  // Create a placeholder reference similar to pasted text
  const placeholderId = nextPasteId
  const placeholderRef = formatTruncatedTextRef(placeholderId, truncatedLines)

  // Combine the parts with the placeholder
  const truncatedText = startText + placeholderRef + endText

  return {
    truncatedText,
    placeholderContent,
  }
}

function formatTruncatedTextRef(id: number, numLines: number): string {
  return `[...Truncated text #${id} +${numLines} lines...]`
}

export function maybeTruncateInput(
  input: string,
  pastedContents: Record<number, PastedContent>,
): { newInput: string; newPastedContents: Record<number, PastedContent> } {
  // Get the next available ID for the truncated content
  const existingIds = Object.keys(pastedContents).map(Number)
  const nextPasteId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1

  // Apply truncation
  const { truncatedText, placeholderContent } = maybeTruncateMessageForInput(
    input,
    nextPasteId,
  )

  if (!placeholderContent) {
    return { newInput: input, newPastedContents: pastedContents }
  }

  return {
    newInput: truncatedText,
    newPastedContents: {
      ...pastedContents,
      [nextPasteId]: {
        id: nextPasteId,
        type: 'text',
        content: placeholderContent,
      },
    },
  }
}
