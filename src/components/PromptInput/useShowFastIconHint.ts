import { useEffect, useState } from 'react'

const HINT_DISPLAY_DURATION_MS = 5000

let hasShownThisSession = false

/**
 * Hook to manage the /fast hint display next to the fast icon.
 * Shows the hint for 5 seconds once per session.
 */
export function useShowFastIconHint(showFastIcon: boolean): boolean {
  const [showHint, setShowHint] = useState(false)

  useEffect(() => {
    if (hasShownThisSession || !showFastIcon) {
      return
    }

    hasShownThisSession = true
    setShowHint(true)

    const timer = setTimeout(setShowHint, HINT_DISPLAY_DURATION_MS, false)

    return () => {
      clearTimeout(timer)
      setShowHint(false)
    }
  }, [showFastIcon])

  return showHint
}
