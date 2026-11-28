import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FooterProps {
  totalRecords: number;
}

export const Footer: React.FC<FooterProps> = ({ totalRecords }) => {
  return (
    <footer className="mt-auto p-6 text-center border-t border-gray-200 bg-white">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-[11px] text-gray-400 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-green-500" aria-hidden="true" />
          <span>ELP Cloud Infrastructure</span>
        </div>
        <span className="hidden sm:inline" aria-hidden="true">•</span>
        <span>Protected Session</span>
        <span className="hidden sm:inline" aria-hidden="true">•</span>
        <span className="text-blue-600">
          {totalRecords} {getRecordLabel(totalRecords)} в базе
        </span>
      </div>
    </footer>
  );
};

function getRecordLabel(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'записей';
  }

  if (lastDigit === 1) {
    return 'запись';
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'записи';
  }

  return 'записей';
}
