export type HorizontalScrollWindow = {
  startIndex: number
  endIndex: number
  showLeftArrow: boolean
  showRightArrow: boolean
}

/**
 * Calculate the visible window of items that fit within available width,
 * ensuring the selected item is always visible. Uses edge-based scrolling:
 * the window only scrolls when the selected item would be outside the visible
 * range, and positions the selected item at the edge (not centered).
 *
 * @param itemWidths - Array of item widths (each width should include separator if applicable)
 * @param availableWidth - Total available width for items
 * @param arrowWidth - Width of scroll indicator arrow (including space)
 * @param selectedIdx - Index of selected item (must stay visible)
 * @param firstItemHasSeparator - Whether first item's width includes a separator that should be ignored
 * @returns Visible window bounds and whether to show scroll arrows
 */
export function calculateHorizontalScrollWindow(
  itemWidths: number[],
  availableWidth: number,
  arrowWidth: number,
  selectedIdx: number,
  firstItemHasSeparator = true,
): HorizontalScrollWindow {
  const totalItems = itemWidths.length

  if (totalItems === 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      showLeftArrow: false,
      showRightArrow: false,
    }
  }

  // Clamp selectedIdx to valid range
  const clampedSelected = Math.max(0, Math.min(selectedIdx, totalItems - 1))

  // If all items fit, show them all
  const totalWidth = itemWidths.reduce((sum, w) => sum + w, 0)
  if (totalWidth <= availableWidth) {
    return {
      startIndex: 0,
      endIndex: totalItems,
      showLeftArrow: false,
      showRightArrow: false,
    }
  }

  // Calculate cumulative widths for efficient range calculations
  const cumulativeWidths: number[] = [0]
  for (let i = 0; i < totalItems; i++) {
    cumulativeWidths.push(cumulativeWidths[i]! + itemWidths[i]!)
  }

  // Helper to get width of range [start, end)
  function rangeWidth(start: number, end: number): number {
    const baseWidth = cumulativeWidths[end]! - cumulativeWidths[start]!
    // When starting after index 0 and first item has separator baked in,
    // subtract 1 because we don't render leading separator on first visible item
    if (firstItemHasSeparator && start > 0) {
      return baseWidth - 1
    }
    return baseWidth
  }

  // Calculate effective available width based on whether we'll show arrows
  function getEffectiveWidth(start: number, end: number): number {
    let width = availableWidth
    if (start > 0) width -= arrowWidth // left arrow
    if (end < totalItems) width -= arrowWidth // right arrow
    return width
  }

  // Edge-based scrolling: Start from the beginning and only scroll when necessary
  // First, calculate how many items fit starting from index 0
  let startIndex = 0
  let endIndex = 1

  // Expand from start as much as possible
  while (
    endIndex < totalItems &&
    rangeWidth(startIndex, endIndex + 1) <=
      getEffectiveWidth(startIndex, endIndex + 1)
  ) {
    endIndex++
  }

  // If selected is within visible range, we're done
  if (clampedSelected >= startIndex && clampedSelected < endIndex) {
    return {
      startIndex,
      endIndex,
      showLeftArrow: startIndex > 0,
      showRightArrow: endIndex < totalItems,
    }
  }

  // Selected is outside visible range - need to scroll
  if (clampedSelected >= endIndex) {
    // Selected is to the right - scroll so selected is at the right edge
    endIndex = clampedSelected + 1
    startIndex = clampedSelected

    // Expand left as much as possible (selected stays at right edge)
    while (
      startIndex > 0 &&
      rangeWidth(startIndex - 1, endIndex) <=
        getEffectiveWidth(startIndex - 1, endIndex)
    ) {
      startIndex--
    }
  } else {
    // Selected is to the left - scroll so selected is at the left edge
    startIndex = clampedSelected
    endIndex = clampedSelected + 1

    // Expand right as much as possible (selected stays at left edge)
    while (
      endIndex < totalItems &&
      rangeWidth(startIndex, endIndex + 1) <=
        getEffectiveWidth(startIndex, endIndex + 1)
    ) {
      endIndex++
    }
  }

  return {
    startIndex,
    endIndex,
    showLeftArrow: startIndex > 0,
    showRightArrow: endIndex < totalItems,
  }
}
