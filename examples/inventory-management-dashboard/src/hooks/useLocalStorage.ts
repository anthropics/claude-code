import { useState, useEffect, useCallback } from 'react';
import { safeLocalStorage } from '../utils';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Get from local storage then parse stored json or return initialValue
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    return safeLocalStorage.get(key, initialValue);
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  // Return a wrapped version of useState's setter function that persists to localStorage
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function for same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      setStoredValue(valueToStore);
      safeLocalStorage.set(key, valueToStore);

      // Dispatch a custom event so other hooks using the same key update
      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: JSON.stringify(valueToStore),
      }));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const removeValue = useCallback(() => {
    try {
      safeLocalStorage.remove(key);
      setStoredValue(initialValue);

      window.dispatchEvent(new StorageEvent('storage', {
        key,
        newValue: null,
      }));
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for storage changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        setStoredValue(safeLocalStorage.get(key, initialValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue] as const;
}
