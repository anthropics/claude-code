import React from 'react';
import { Truck, Database, Calculator, BarChart3 } from 'lucide-react';
import { cn } from '../../utils';
import { APP_NAME } from '../../constants';
import type { TabType } from '../../types';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { id: 'database', label: 'База данных', shortLabel: 'База', icon: <Database size={20} /> },
  { id: 'calculator', label: 'Калькулятор', shortLabel: 'Расчет', icon: <Calculator size={20} /> },
  { id: 'analytics', label: 'Аналитика', shortLabel: 'Статистика', icon: <BarChart3 size={20} /> },
];

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 shadow-2xl sticky top-0 z-40 border-b border-slate-700"
      role="navigation"
      aria-label="Основная навигация"
    >
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2.5 rounded-xl shadow-lg">
            <Truck size={26} aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-black text-2xl tracking-tight">{APP_NAME}</h1>
            <p className="text-[9px] text-blue-400 uppercase tracking-widest font-bold">
              Logistics Management System
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 md:gap-3" role="tablist" aria-label="Разделы приложения">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold',
                'focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800',
                activeTab === tab.id
                  ? 'bg-blue-600 shadow-lg shadow-blue-500/50'
                  : 'hover:bg-slate-700/50'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
