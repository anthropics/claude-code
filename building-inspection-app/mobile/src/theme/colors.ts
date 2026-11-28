export const colors = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#dbeafe',

  danger: '#dc2626',
  dangerLight: '#fef2f2',

  success: '#16a34a',
  successLight: '#f0fdf4',

  warning: '#d97706',
  warningLight: '#fffbeb',

  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  white: '#ffffff',
  black: '#000000',

  urgency: {
    välitön: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    '1-2v': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    '3-5v': { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
    seurattava: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    ei_toimenpiteitä: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  } as Record<string, { bg: string; text: string; border: string }>,
};
