import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', text, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <div
      className={`${sizeMap[size]} animate-spin rounded-full border-2 border-blue-100 border-t-blue-600`}
    />
    {text && <p className="text-sm text-gray-500 animate-pulse">{text}</p>}
  </div>
);

export const AIProcessingBadge: React.FC<{ text?: string }> = ({
  text = 'Tekoäly käsittelee...',
}) => (
  <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-medium">
    <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
    {text}
  </div>
);
