import type { AppSettings, Currency, PaymentType, Unit } from '../types';

// ============================================
// Application Constants
// ============================================

export const APP_NAME = 'ELP Cloud';
export const APP_VERSION = '2.0.0';
export const STORAGE_KEY = 'elp-rates-v2';
export const SETTINGS_KEY = 'elp-settings-v2';
export const HISTORY_KEY = 'elp-calc-history';

// ============================================
// Business Logic Constants
// ============================================

export const DEFAULT_SETTINGS: AppSettings = {
  exchangeRate: 105,
  elpMarginPerKg: 2,
  beznalMarkup: 1.1, // 10% markup for non-cash
  theme: 'light',
  language: 'ru',
};

export const EXCHANGE_RATE_RANGE = {
  min: 80,
  max: 150,
  step: 0.5,
};

// ============================================
// Dropdown Options
// ============================================

export const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'USD', label: 'USD', symbol: '$' },
];

export const PAYMENT_TYPE_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: 'Нал', label: 'Наличный' },
  { value: 'Безнал', label: 'Безналичный' },
];

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'кг', label: 'за кг' },
  { value: 'фикс', label: 'фиксированная' },
];

// ============================================
// Demo Data
// ============================================

export const DEMO_RATES = [
  {
    id: '1',
    item: 'Электроника (смартфоны)',
    route: 'Шанхай → Москва (авиа)',
    rate: 4.5,
    unit: 'кг' as Unit,
    currency: 'EUR' as Currency,
    type: 'Нал' as PaymentType,
    notes: 'EX1, маркировка включена, срок 5-7 дней',
    date: '2025-01-04',
    createdAt: '2025-01-04T10:00:00Z',
  },
  {
    id: '2',
    item: 'Одежда (текстиль)',
    route: 'Милан → Санкт-Петербург',
    rate: 3.2,
    unit: 'кг' as Unit,
    currency: 'EUR' as Currency,
    type: 'Безнал' as PaymentType,
    notes: 'Оптовая партия от 500кг, автодоставка',
    date: '2025-01-03',
    createdAt: '2025-01-03T14:30:00Z',
  },
  {
    id: '3',
    item: 'Косметика (премиум)',
    route: 'Париж → Москва',
    rate: 5.8,
    unit: 'кг' as Unit,
    currency: 'EUR' as Currency,
    type: 'Нал' as PaymentType,
    notes: 'Температурный режим +15°C, страховка включена',
    date: '2025-01-02',
    createdAt: '2025-01-02T09:15:00Z',
  },
  {
    id: '4',
    item: 'Автозапчасти',
    route: 'Штутгарт → Екатеринбург',
    rate: 250,
    unit: 'фикс' as Unit,
    currency: 'EUR' as Currency,
    type: 'Безнал' as PaymentType,
    notes: 'Паллета 120x80, до 500кг',
    date: '2025-01-01',
    createdAt: '2025-01-01T16:45:00Z',
  },
  {
    id: '5',
    item: 'Медицинское оборудование',
    route: 'Берлин → Казань',
    rate: 8.2,
    unit: 'кг' as Unit,
    currency: 'EUR' as Currency,
    type: 'Безнал' as PaymentType,
    notes: 'Хрупкий груз, особые условия хранения',
    date: '2024-12-28',
    createdAt: '2024-12-28T11:20:00Z',
  },
  {
    id: '6',
    item: 'Продукты питания',
    route: 'Стамбул → Новосибирск',
    rate: 2.9,
    unit: 'кг' as Unit,
    currency: 'USD' as Currency,
    type: 'Нал' as PaymentType,
    notes: 'Рефрижератор, температура 0-4°C',
    date: '2024-12-25',
    createdAt: '2024-12-25T08:00:00Z',
  },
];

// ============================================
// Keyboard Shortcuts
// ============================================

export const KEYBOARD_SHORTCUTS = {
  NEW_RATE: 'ctrl+n',
  SEARCH: 'ctrl+k',
  EXPORT: 'ctrl+e',
  TOGGLE_TAB: 'ctrl+tab',
} as const;

// ============================================
// Animation Durations
// ============================================

export const ANIMATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

// ============================================
// Toast Configuration
// ============================================

export const TOAST_CONFIG = {
  DEFAULT_DURATION: 4000,
  MAX_VISIBLE: 5,
} as const;
