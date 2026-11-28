import { useState, useMemo, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { calculateShipping, generateId, getCurrentTimestamp } from '../utils';
import { HISTORY_KEY, DEFAULT_SETTINGS } from '../constants';
import type { Rate, CalculationResult, CalculationHistory, AppSettings } from '../types';

const MAX_HISTORY_ITEMS = 20;

export function useCalculator(settings: AppSettings = DEFAULT_SETTINGS) {
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [weight, setWeight] = useState<string>('');
  const [history, setHistory, clearHistory] = useLocalStorage<CalculationHistory[]>(HISTORY_KEY, []);

  // Calculate result
  const result = useMemo((): CalculationResult | null => {
    if (!selectedRate) return null;

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return null;

    return calculateShipping(selectedRate, weightNum, settings);
  }, [selectedRate, weight, settings]);

  // Select a rate for calculation
  const selectRate = useCallback((rate: Rate | null) => {
    setSelectedRate(rate);
  }, []);

  // Update weight input
  const updateWeight = useCallback((value: string) => {
    // Allow empty string or valid numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setWeight(value);
    }
  }, []);

  // Save current calculation to history
  const saveToHistory = useCallback(() => {
    if (!result) return false;

    const historyItem: CalculationHistory = {
      id: generateId(),
      timestamp: getCurrentTimestamp(),
      result,
    };

    setHistory(prev => {
      const updated = [historyItem, ...prev];
      // Keep only the last N items
      return updated.slice(0, MAX_HISTORY_ITEMS);
    });

    return true;
  }, [result, setHistory]);

  // Remove item from history
  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  }, [setHistory]);

  // Clear calculation
  const clearCalculation = useCallback(() => {
    setSelectedRate(null);
    setWeight('');
  }, []);

  // Clear all history
  const clearAllHistory = useCallback(() => {
    clearHistory();
  }, [clearHistory]);

  return {
    // State
    selectedRate,
    weight,
    result,
    history,

    // Actions
    selectRate,
    updateWeight,
    saveToHistory,
    removeFromHistory,
    clearCalculation,
    clearAllHistory,

    // Computed
    hasResult: result !== null,
    historyCount: history.length,
  };
}
