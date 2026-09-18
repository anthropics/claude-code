import { useState, useCallback } from 'react';
import { generateId } from '../utils';
import { TOAST_CONFIG } from '../constants';
import type { Toast, ToastType } from '../types';

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = TOAST_CONFIG.DEFAULT_DURATION
  ) => {
    const id = generateId();
    const toast: Toast = { id, type, message, duration };

    setToasts(prev => {
      const updated = [...prev, toast];
      // Keep only the last N toasts
      return updated.slice(-TOAST_CONFIG.MAX_VISIBLE);
    });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Convenience methods
  const success = useCallback((message: string, duration?: number) =>
    addToast(message, 'success', duration), [addToast]);

  const error = useCallback((message: string, duration?: number) =>
    addToast(message, 'error', duration), [addToast]);

  const warning = useCallback((message: string, duration?: number) =>
    addToast(message, 'warning', duration), [addToast]);

  const info = useCallback((message: string, duration?: number) =>
    addToast(message, 'info', duration), [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  };
}
