import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  generateId,
  getCurrentDate,
  getCurrentTimestamp,
  filterRates,
  sortRates,
  validateRate
} from '../utils';
import { STORAGE_KEY, DEMO_RATES } from '../constants';
import type { Rate, RateFormData, FilterConfig, SortConfig } from '../types';

export function useRates() {
  const [rates, setRates, clearRates] = useLocalStorage<Rate[]>(STORAGE_KEY, DEMO_RATES);
  const [isLoading, setIsLoading] = useState(false);

  // Filter and sort state
  const [filter, setFilter] = useState<FilterConfig>({ searchTerm: '' });
  const [sort, setSort] = useState<SortConfig>({ field: 'date', direction: 'desc' });

  // Filtered and sorted rates
  const filteredRates = useMemo(() => {
    const filtered = filterRates(rates, filter);
    return sortRates(filtered, sort);
  }, [rates, filter, sort]);

  // Add a new rate
  const addRate = useCallback((data: RateFormData): { success: boolean; errors: string[] } => {
    const errors = validateRate(data);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    const newRate: Rate = {
      ...data,
      id: generateId(),
      date: getCurrentDate(),
      createdAt: getCurrentTimestamp(),
    };

    setRates(prev => [newRate, ...prev]);
    return { success: true, errors: [] };
  }, [setRates]);

  // Update an existing rate
  const updateRate = useCallback((id: string, data: Partial<Rate>): { success: boolean; errors: string[] } => {
    const existingRate = rates.find(r => r.id === id);
    if (!existingRate) {
      return { success: false, errors: ['Запись не найдена'] };
    }

    const updatedRate = { ...existingRate, ...data };
    const errors = validateRate(updatedRate);
    if (errors.length > 0) {
      return { success: false, errors };
    }

    setRates(prev => prev.map(r =>
      r.id === id
        ? { ...r, ...data, updatedAt: getCurrentTimestamp() }
        : r
    ));
    return { success: true, errors: [] };
  }, [rates, setRates]);

  // Delete a rate
  const deleteRate = useCallback((id: string): boolean => {
    const exists = rates.some(r => r.id === id);
    if (!exists) return false;

    setRates(prev => prev.filter(r => r.id !== id));
    return true;
  }, [rates, setRates]);

  // Get a rate by ID
  const getRateById = useCallback((id: string): Rate | undefined => {
    return rates.find(r => r.id === id);
  }, [rates]);

  // Import rates
  const importRates = useCallback((newRates: Rate[], replace: boolean = false): number => {
    setIsLoading(true);

    try {
      if (replace) {
        setRates(newRates);
        return newRates.length;
      } else {
        // Merge, avoiding duplicates by ID
        const existingIds = new Set(rates.map(r => r.id));
        const uniqueNewRates = newRates.filter(r => !existingIds.has(r.id));
        setRates(prev => [...uniqueNewRates, ...prev]);
        return uniqueNewRates.length;
      }
    } finally {
      setIsLoading(false);
    }
  }, [rates, setRates]);

  // Clear all rates
  const clearAllRates = useCallback(() => {
    clearRates();
  }, [clearRates]);

  // Update search term with debouncing handled by the caller
  const setSearchTerm = useCallback((term: string) => {
    setFilter(prev => ({ ...prev, searchTerm: term }));
  }, []);

  // Toggle sort
  const toggleSort = useCallback((field: SortConfig['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  return {
    // Data
    rates,
    filteredRates,
    isLoading,

    // Filter & Sort
    filter,
    sort,
    setFilter,
    setSort,
    setSearchTerm,
    toggleSort,

    // CRUD Operations
    addRate,
    updateRate,
    deleteRate,
    getRateById,

    // Bulk Operations
    importRates,
    clearAllRates,

    // Stats
    totalCount: rates.length,
    filteredCount: filteredRates.length,
  };
}
