/**
 * Advanced IME-aware form submission hook with edge case handling
 * Handles focus loss, ESC key, and mouse-based conversion confirmation
 */

import { useState, useCallback, useRef, KeyboardEvent, FocusEvent } from 'react';

interface UseImeAwareSubmitAdvancedOptions {
  onSubmit: (value: string) => void;
  onCancel?: () => void;
}

export const useImeAwareSubmitAdvanced = ({
  onSubmit,
  onCancel
}: UseImeAwareSubmitAdvancedOptions) => {
  const [isComposing, setIsComposing] = useState<boolean>(false);
  const [escPressed, setEscPressed] = useState<boolean>(false);
  const compositionValueRef = useRef<string>('');

  // Handle IME composition start
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
    setEscPressed(false);
  }, []);

  // Handle IME composition end
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setIsComposing(false);
    compositionValueRef.current = e.currentTarget.value;
    
    // Reset ESC flag after composition ends
    if (escPressed) {
      setEscPressed(false);
    }
  }, [escPressed]);

  // Handle keydown events
  const handleKeyDown = useCallback((
    e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    // Handle ESC key - cancels IME composition
    if (e.key === 'Escape') {
      setEscPressed(true);
      if (onCancel) {
        onCancel();
      }
      return;
    }

    // Check if IME is active
    const isIMEActive = isComposing || e.keyCode === 229;

    // Handle Enter key press
    if (e.key === 'Enter') {
      // Skip if ESC was just pressed (prevents accidental submission after cancel)
      if (escPressed) {
        setEscPressed(false);
        return;
      }

      if (isIMEActive) {
        // This Enter is for IME conversion confirmation
        return;
      } else {
        // Regular Enter (form submission)
        const target = e.currentTarget;
        const value = target.value.trim();
        
        if (value) {
          e.preventDefault();
          onSubmit(value);
          target.value = '';
          compositionValueRef.current = '';
        }
      }
    }
  }, [isComposing, escPressed, onSubmit, onCancel]);

  // Handle focus loss during composition
  const handleBlur = useCallback((e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // If composition is active when focus is lost, end it gracefully
    if (isComposing) {
      setIsComposing(false);
      compositionValueRef.current = e.currentTarget.value;
    }
  }, [isComposing]);

  // Handle mouse-based text selection/confirmation
  const handleMouseUp = useCallback(() => {
    // If user clicks to select conversion candidate
    // The composition will end automatically
    // No special handling needed, just ensure state is consistent
    if (!isComposing && compositionValueRef.current) {
      // Composition has ended via mouse selection
      compositionValueRef.current = '';
    }
  }, [isComposing]);

  return {
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    handleBlur,
    handleMouseUp,
    isComposing,
    escPressed
  };
};