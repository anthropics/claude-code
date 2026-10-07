import React from 'react';
import { Database, Edit2, Trash2, ArrowUpDown } from 'lucide-react';
import { cn, formatDate } from '../../../utils';
import type { Rate, SortConfig, SortField } from '../../../types';

interface RateTableProps {
  rates: Rate[];
  sort: SortConfig;
  onSort: (field: SortField) => void;
  onEdit: (rate: Rate) => void;
  onDelete: (id: string) => void;
}

const SortableHeader: React.FC<{
  field: SortField;
  currentSort: SortConfig;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}> = ({ field, currentSort, onSort, children, className }) => (
  <th
    className={cn('p-5 text-[11px] font-black text-gray-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors', className)}
    onClick={() => onSort(field)}
    role="columnheader"
    aria-sort={currentSort.field === field ? (currentSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
  >
    <div className="flex items-center gap-1">
      {children}
      <ArrowUpDown
        size={12}
        className={cn(
          'transition-colors',
          currentSort.field === field ? 'text-blue-600' : 'text-gray-300'
        )}
      />
    </div>
  </th>
);

export const RateTable: React.FC<RateTableProps> = ({
  rates,
  sort,
  onSort,
  onEdit,
  onDelete,
}) => {
  if (rates.length === 0) {
    return (
      <div className="p-16 text-center">
        <Database className="mx-auto mb-4 text-gray-300" size={64} aria-hidden="true" />
        <p className="text-xl text-slate-400 font-bold">База пуста или ничего не найдено</p>
        <p className="text-sm text-slate-300 mt-2">
          Добавьте первую запись или измените поисковый запрос
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" role="grid">
        <thead>
          <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
            <SortableHeader field="item" currentSort={sort} onSort={onSort}>
              Груз / Дата
            </SortableHeader>
            <SortableHeader field="route" currentSort={sort} onSort={onSort}>
              Маршрут
            </SortableHeader>
            <SortableHeader field="rate" currentSort={sort} onSort={onSort} className="text-blue-600">
              Ставка iCar
            </SortableHeader>
            <th className="p-5 text-[11px] font-black text-gray-500 uppercase tracking-wider">
              Примечания
            </th>
            <th className="p-5 text-[11px] font-black text-gray-500 uppercase tracking-wider text-center">
              Действия
            </th>
          </tr>
        </thead>
        <tbody>
          {rates.map(rate => (
            <tr
              key={rate.id}
              className="border-b border-gray-100 hover:bg-blue-50/30 transition-all group"
            >
              <td className="p-5">
                <p className="font-bold text-slate-800 text-base">{rate.item}</p>
                <p className="text-[10px] text-gray-400 font-semibold mt-1">
                  {formatDate(rate.date)}
                </p>
              </td>
              <td className="p-5 text-sm text-gray-700 font-medium">{rate.route || '—'}</td>
              <td className="p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-blue-700 text-lg">
                    {rate.rate} {rate.currency}
                    {rate.unit === 'кг' ? '/кг' : ''}
                  </span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-md text-[9px] font-black uppercase',
                      rate.type === 'Нал'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-purple-100 text-purple-700'
                    )}
                  >
                    {rate.type}
                  </span>
                </div>
              </td>
              <td className="p-5">
                <p className="text-xs text-gray-600 leading-relaxed max-w-xs">
                  {rate.notes || '—'}
                </p>
              </td>
              <td className="p-5">
                <div className="flex gap-2 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEdit(rate)}
                    className="text-blue-400 hover:text-blue-600 transition p-2 hover:bg-blue-50 rounded-lg"
                    aria-label={`Редактировать ${rate.item}`}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => onDelete(rate.id)}
                    className="text-gray-300 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-lg"
                    aria-label={`Удалить ${rate.item}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
