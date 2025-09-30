/**
 * IME-aware form submission hook
 * Distinguishes between IME conversion Enter and regular Enter for Japanese/Chinese input
 */

import { useState, useCallback, KeyboardEvent } from 'react';

interface UseImeAwareSubmitOptions {
  onSubmit: (value: string) => void;
}

export const useImeAwareSubmit = ({
  onSubmit
}: UseImeAwareSubmitOptions) => {
  const [isComposing, setIsComposing] = useState<boolean>(false);

  // Handle IME composition start
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // Handle IME composition end
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  // Handle keydown events
  const handleKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // Check if IME is active
    // 1. isComposing: Standard IME state flag
    // 2. e.keyCode === 229: Special code indicating IME processing (for Safari compatibility)
    const isIMEActive = isComposing || e.keyCode === 229;

    // Handle Enter key press
    if (e.key === 'Enter') {
      if (isIMEActive) {
        // This Enter is for IME conversion confirmation
        // Do nothing (block form submission)
        return;
      } else {
        // Regular Enter (form submission)
        const target = e.currentTarget;
        const value = target.value.trim();
        
        if (value) {
          e.preventDefault(); // Prevent default submission
          onSubmit(value);
          target.value = ''; // Clear input field
        }
      }
    }
  }, [isComposing, onSubmit]);

  return {
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    isComposing
  };
};