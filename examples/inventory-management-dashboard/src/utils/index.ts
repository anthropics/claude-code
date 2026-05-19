import { format, parseISO, isValid } from 'date-fns';
import { ru } from 'date-fns/locale';
import type {
  Rate,
  CalculationResult,
  AnalyticsData,
  ExportData,
  AppSettings,
  FilterConfig,
  SortConfig
} from '../types';
import { APP_VERSION, CURRENCY_OPTIONS } from '../constants';

// ============================================
// ID Generation
// ============================================

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================
// Date Utilities
// ============================================

export const formatDate = (dateStr: string, formatStr: string = 'd MMM yyyy'): string => {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, formatStr, { locale: ru });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr: string): string => {
  return formatDate(dateStr, 'd MMM yyyy, HH:mm');
};

export const getCurrentDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

// ============================================
// Currency Utilities
// ============================================

export const getCurrencySymbol = (currency: string): string => {
  return CURRENCY_OPTIONS.find(c => c.value === currency)?.symbol || currency;
};

export const formatCurrency = (amount: number, currency: string): string => {
  const symbol = getCurrencySymbol(currency);
  return `${amount.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ${symbol}`;
};

export const formatRub = (amount: number): string => {
  return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
};

// ============================================
// Calculation Utilities
// ============================================

export const calculateShipping = (
  rate: Rate,
  weight: number,
  settings: AppSettings
): CalculationResult => {
  const { exchangeRate, elpMarginPerKg, beznalMarkup } = settings;

  const base = rate.unit === 'фикс' ? rate.rate : rate.rate * weight;
  const margin = elpMarginPerKg * weight;
  const total = base + margin;
  const beznal = total * beznalMarkup;
  const rub = total * exchangeRate;

  return {
    base,
    margin,
    total,
    beznal,
    rub,
    weight,
    rate,
  };
};

// ============================================
// Filter & Sort Utilities
// ============================================

export const filterRates = (rates: Rate[], filter: FilterConfig): Rate[] => {
  return rates.filter(rate => {
    // Text search
    if (filter.searchTerm) {
      const searchLower = filter.searchTerm.toLowerCase();
      const matchesSearch =
        rate.item.toLowerCase().includes(searchLower) ||
        rate.route.toLowerCase().includes(searchLower) ||
        rate.notes.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Currency filter
    if (filter.currency && rate.currency !== filter.currency) {
      return false;
    }

    // Payment type filter
    if (filter.paymentType && rate.type !== filter.paymentType) {
      return false;
    }

    // Unit filter
    if (filter.unit && rate.unit !== filter.unit) {
      return false;
    }

    // Date range filter
    if (filter.dateRange) {
      const rateDate = new Date(rate.date);
      const startDate = new Date(filter.dateRange.start);
      const endDate = new Date(filter.dateRange.end);
      if (rateDate < startDate || rateDate > endDate) {
        return false;
      }
    }

    return true;
  });
};

export const sortRates = (rates: Rate[], sort: SortConfig): Rate[] => {
  return [...rates].sort((a, b) => {
    let comparison = 0;

    switch (sort.field) {
      case 'date':
        comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
        break;
      case 'item':
        comparison = a.item.localeCompare(b.item, 'ru');
        break;
      case 'rate':
        comparison = a.rate - b.rate;
        break;
      case 'route':
        comparison = a.route.localeCompare(b.route, 'ru');
        break;
    }

    return sort.direction === 'desc' ? comparison : -comparison;
  });
};

// ============================================
// Analytics Utilities
// ============================================

export const calculateAnalytics = (rates: Rate[]): AnalyticsData => {
  if (rates.length === 0) {
    return {
      totalRates: 0,
      avgRate: 0,
      totalRoutes: 0,
      ratesByPaymentType: { 'Нал': 0, 'Безнал': 0 },
      ratesByCurrency: { 'EUR': 0, 'USD': 0 },
      ratesByMonth: [],
      topRoutes: [],
    };
  }

  // Basic stats
  const totalRates = rates.length;
  const avgRate = rates.reduce((sum, r) => sum + r.rate, 0) / rates.length;

  // Unique routes
  const uniqueRoutes = new Set(rates.map(r => r.route));
  const totalRoutes = uniqueRoutes.size;

  // Payment type distribution
  const ratesByPaymentType = rates.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) as Record<'Нал' | 'Безнал', number>;

  // Currency distribution
  const ratesByCurrency = rates.reduce((acc, r) => {
    acc[r.currency] = (acc[r.currency] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) as Record<'EUR' | 'USD', number>;

  // Monthly distribution
  const monthlyData = rates.reduce((acc, r) => {
    const month = r.date.substring(0, 7); // YYYY-MM
    if (!acc[month]) {
      acc[month] = { count: 0, totalRate: 0 };
    }
    acc[month].count++;
    acc[month].totalRate += r.rate;
    return acc;
  }, {} as Record<string, { count: number; totalRate: number }>);

  const ratesByMonth = Object.entries(monthlyData)
    .map(([month, data]) => ({
      month: formatDate(`${month}-01`, 'MMM yyyy'),
      count: data.count,
      avgRate: data.totalRate / data.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Top routes
  const routeCounts = rates.reduce((acc, r) => {
    acc[r.route] = (acc[r.route] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topRoutes = Object.entries(routeCounts)
    .map(([route, count]) => ({ route, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRates,
    avgRate,
    totalRoutes,
    ratesByPaymentType,
    ratesByCurrency,
    ratesByMonth,
    topRoutes,
  };
};

// ============================================
// Storage Utilities
// ============================================

export const safeJSONParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
};

export const safeLocalStorage = {
  get: <T>(key: string, fallback: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? safeJSONParse(item, fallback) : fallback;
    } catch {
      return fallback;
    }
  },
  set: <T>(key: string, value: T): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Export/Import Utilities
// ============================================

export const exportToJSON = (rates: Rate[], settings: AppSettings): string => {
  const exportData: ExportData = {
    version: APP_VERSION,
    exportedAt: getCurrentTimestamp(),
    rates,
    settings,
  };
  return JSON.stringify(exportData, null, 2);
};

export const importFromJSON = (jsonString: string): ExportData | null => {
  try {
    const data = JSON.parse(jsonString) as ExportData;
    if (!data.rates || !Array.isArray(data.rates)) {
      throw new Error('Invalid data format');
    }
    return data;
  } catch {
    return null;
  }
};

export const downloadFile = (content: string, filename: string, type: string = 'application/json'): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToCSV = (rates: Rate[]): string => {
  const headers = ['ID', 'Товар', 'Маршрут', 'Ставка', 'Ед.', 'Валюта', 'Тип', 'Примечания', 'Дата'];
  const rows = rates.map(r => [
    r.id,
    `"${r.item.replace(/"/g, '""')}"`,
    `"${r.route.replace(/"/g, '""')}"`,
    r.rate.toString(),
    r.unit,
    r.currency,
    r.type,
    `"${r.notes.replace(/"/g, '""')}"`,
    r.date,
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
};

// ============================================
// Validation Utilities
// ============================================

export const validateRate = (rate: Partial<Rate>): string[] => {
  const errors: string[] = [];

  if (!rate.item?.trim()) {
    errors.push('Название товара обязательно');
  }

  if (rate.rate === undefined || rate.rate === null || isNaN(rate.rate)) {
    errors.push('Укажите корректную ставку');
  } else if (rate.rate < 0) {
    errors.push('Ставка не может быть отрицательной');
  }

  return errors;
};

// ============================================
// Debounce Utility
// ============================================

export const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), wait);
  };
};

// ============================================
// Class Name Utility
// ============================================

export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};
