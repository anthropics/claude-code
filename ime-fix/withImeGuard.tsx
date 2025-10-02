/**
 * IME Guard Higher-Order Component
 * Wraps existing components to add IME support
 */

import React, { ComponentType, useState, useCallback } from 'react';

interface WithImeGuardProps {
  onSubmit?: (value: string) => void;
  [key: string]: any;
}

export function withImeGuard<P extends WithImeGuardProps>(
  WrappedComponent: ComponentType<P>
): ComponentType<P> {
  return (props: P) => {
    const [isComposing, setIsComposing] = useState<boolean>(false);

    const handleCompositionStart = useCallback(() => {
      setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback(() => {
      setIsComposing(false);
    }, []);

    // Wrap original onKeyDown handler
    const wrappedOnKeyDown = useCallback((e: React.KeyboardEvent) => {
      const isIMEActive = isComposing || e.keyCode === 229;

      // Block Enter key during IME input
      if (e.key === 'Enter' && isIMEActive) {
        return;
      }

      // Execute original handler
      if (props.onKeyDown) {
        props.onKeyDown(e);
      }
    }, [isComposing, props.onKeyDown]);

    // Extend props with event handlers
    const enhancedProps = {
      ...props,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onKeyDown: wrappedOnKeyDown,
    };

    return <WrappedComponent {...enhancedProps} />;
  };
}

