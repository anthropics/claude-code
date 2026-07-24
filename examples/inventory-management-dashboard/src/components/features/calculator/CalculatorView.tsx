import React from 'react';
import { Calculator, Package, History, Trash2, Clock } from 'lucide-react';
import { Select } from '../../ui/Select';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { formatCurrency, formatRub, formatDateTime, cn } from '../../../utils';
import type { Rate, CalculationResult, CalculationHistory, AppSettings } from '../../../types';

interface CalculatorViewProps {
  rates: Rate[];
  selectedRate: Rate | null;
  weight: string;
  result: CalculationResult | null;
  history: CalculationHistory[];
  settings: AppSettings;
  onSelectRate: (rate: Rate | null) => void;
  onWeightChange: (weight: string) => void;
  onSaveToHistory: () => void;
  onRemoveFromHistory: (id: string) => void;
  onClearHistory: () => void;
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  rates,
  selectedRate,
  weight,
  result,
  history,
  settings,
  onSelectRate,
  onWeightChange,
  onSaveToHistory,
  onRemoveFromHistory,
  onClearHistory,
}) => {
  const rateOptions = rates.map(r => ({
    value: r.id,
    label: `${r.item} • ${r.route || 'Без маршрута'} • ${r.rate} ${r.currency}${r.unit === 'кг' ? '/кг' : ''}`,
  }));

  const handleRateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = rates.find(r => r.id === e.target.value) || null;
    onSelectRate(rate);
  };

  return (
    <div
      className="max-w-4xl mx-auto space-y-6"
      role="tabpanel"
      id="calculator-panel"
      aria-labelledby="calculator-tab"
    >
      {/* Main Calculator */}
      <div className="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border-2 border-blue-100">
        <h2 className="text-3xl font-black mb-8 flex items-center gap-3 text-slate-800">
          <div className="p-3 bg-blue-100 rounded-xl">
            <Calculator className="text-blue-600" size={32} />
          </div>
          Калькулятор стоимости
        </h2>

        <div className="space-y-8">
          {/* Rate Selection */}
          <Select
            label="Выберите груз из базы данных"
            options={rateOptions}
            value={selectedRate?.id || ''}
            onChange={handleRateSelect}
            placeholder="-- Выберите товар и маршрут --"
            className="py-5 text-lg font-bold"
          />

          {/* Weight Input */}
          <Input
            label="Вес груза (кг)"
            type="text"
            inputMode="decimal"
            placeholder="Введите вес в килограммах"
            value={weight}
            onChange={e => onWeightChange(e.target.value)}
            leftIcon={<Package size={24} />}
            className="py-5 text-xl font-bold"
          />

          {/* Result */}
          {result ? (
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
              {/* Decorative background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" aria-hidden="true" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" aria-hidden="true" />

              <div className="relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest">
                    Детальный расчет
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSaveToHistory}
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/50"
                  >
                    <History size={16} className="mr-1" />
                    Сохранить
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Base calculation */}
                  <div className="flex justify-between items-center text-base border-b border-slate-700 pb-4">
                    <span className="text-slate-400 font-semibold">
                      База iCar ({result.rate.unit === 'фикс' ? 'фикс' : `${weight}кг × ${result.rate.rate}€`}):
                    </span>
                    <span className="font-black text-xl">
                      {formatCurrency(result.base, result.rate.currency)}
                    </span>
                  </div>

                  {/* ELP Margin */}
                  <div className="flex justify-between items-center bg-blue-900/30 p-4 rounded-xl">
                    <span className="text-blue-300 font-bold">
                      Наценка ELP ({weight}кг × {settings.elpMarginPerKg}€):
                    </span>
                    <span className="text-2xl font-black text-blue-400">
                      +{formatCurrency(result.margin, 'EUR')}
                    </span>
                  </div>

                  {/* Final prices */}
                  <div className="pt-6 border-t-2 border-slate-700">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-slate-800/50 p-6 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2">
                          Клиент (Нал)
                        </p>
                        <p className="text-4xl md:text-5xl font-black text-white">
                          {result.total.toFixed(0)}
                        </p>
                        <p className="text-blue-400 font-bold mt-1">{result.rate.currency}</p>
                      </div>
                      <div className="bg-slate-800/50 p-6 rounded-2xl">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider mb-2">
                          В рублях
                        </p>
                        <p className="text-4xl md:text-5xl font-black text-green-400">
                          {formatRub(result.rub).replace(' ₽', '')}
                        </p>
                        <p className="text-green-300 font-bold mt-1">RUB</p>
                      </div>
                    </div>
                  </div>

                  {/* Beznal price */}
                  <div className="bg-slate-800/70 backdrop-blur p-5 rounded-2xl flex justify-between items-center border border-slate-700">
                    <div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">
                        Безналичный расчет
                      </p>
                      <p className="text-xs text-slate-500 italic">
                        Цена + {((settings.beznalMarkup - 1) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-blue-300">
                        {result.beznal.toFixed(0)}
                      </p>
                      <p className="text-blue-400 text-sm font-bold">{result.rate.currency}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300">
              <Calculator className="mx-auto mb-4 text-gray-300" size={64} aria-hidden="true" />
              <p className="text-gray-400 font-bold text-lg">
                {selectedRate ? 'Введите вес для расчета' : 'Выберите груз для расчета'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-xl border-2 border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <History size={20} className="text-blue-500" />
              История расчетов
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearHistory}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 size={14} className="mr-1" />
              Очистить
            </Button>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {history.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition group"
              >
                <div className="flex-1">
                  <p className="font-bold text-slate-800">{item.result.rate.item}</p>
                  <p className="text-xs text-gray-500">
                    {item.result.weight}кг • {formatCurrency(item.result.total, item.result.rate.currency)} • {formatRub(item.result.rub)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {formatDateTime(item.timestamp)}
                  </span>
                  <button
                    onClick={() => onRemoveFromHistory(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition"
                    aria-label="Удалить из истории"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
