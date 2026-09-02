// ============================================
// Core Domain Types
// ============================================

export type Currency = 'EUR' | 'USD';
export type PaymentType = 'Нал' | 'Безнал';
export type Unit = 'кг' | 'фикс';
export type TabType = 'database' | 'calculator' | 'analytics';

export interface Rate {
  id: string;
  item: string;
  route: string;
  rate: number;
  unit: Unit;
  currency: Currency;
  type: PaymentType;
  notes: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export type RateFormData = Omit<Rate, 'id' | 'date' | 'createdAt' | 'updatedAt'>;

export interface RateWithCalculation extends Rate {
  calculatedPrice?: number;
}

// ============================================
// Calculator Types
// ============================================

export interface CalculationResult {
  base: number;
  margin: number;
  total: number;
  beznal: number;
  rub: number;
  weight: number;
  rate: Rate;
}

export interface CalculationHistory {
  id: string;
  timestamp: string;
  result: CalculationResult;
}

// ============================================
// Analytics Types
// ============================================

export interface AnalyticsData {
  totalRates: number;
  avgRate: number;
  totalRoutes: number;
  ratesByPaymentType: Record<PaymentType, number>;
  ratesByCurrency: Record<Currency, number>;
  ratesByMonth: Array<{ month: string; count: number; avgRate: number }>;
  topRoutes: Array<{ route: string; count: number }>;
}

// ============================================
// UI Types
// ============================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

// ============================================
// Sort & Filter Types
// ============================================

export type SortField = 'date' | 'item' | 'rate' | 'route';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface FilterConfig {
  searchTerm: string;
  currency?: Currency;
  paymentType?: PaymentType;
  unit?: Unit;
  dateRange?: {
    start: string;
    end: string;
  };
}

// ============================================
// Storage Types
// ============================================

export interface AppSettings {
  exchangeRate: number;
  elpMarginPerKg: number;
  beznalMarkup: number;
  theme: 'light' | 'dark';
  language: 'ru' | 'en';
}

export interface ExportData {
  version: string;
  exportedAt: string;
  rates: Rate[];
  settings: AppSettings;
}
